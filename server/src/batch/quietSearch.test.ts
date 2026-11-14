import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent, BotSighting, QuietResult, StoredSighting } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-quiet-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const giant = (over: Partial<BotSighting> = {}): BotSighting => ({
  target: "巨大 輝煌蘑菇",
  lat: 25.033964,
  lng: 121.564468,
  spot_name: "範例地點",
  participant_count: 0,
  remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00",
  map_position: [672, 814],
  frame: "sighting-01.png",
  postcard: "postcard-01.png",
  ...over,
});
const answer = (over: Partial<QuietResult> = {}): QuietResult => ({
  quiet_area: true,
  verdict: true,
  reason: "沒人在打，找到 1 顆巨菇",
  giants: [giant()],
  claimed: null,
  unread: 0,
  ...over,
});
/** 依 cli.md：先印 Sighting 陣列，最後一行是單行答案。 */
const quietOut = (a: QuietResult) => JSON.stringify(a.giants, null, 2) + NL + JSON.stringify(a) + NL;

const yes = (a: Partial<QuietResult> = {}): FakeReply => ({
  exitCode: 0,
  stdout: quietOut(answer(a)),
  stderr: ["【無人區】是：找到 1 顆巨菇，花了 2 分 5 秒"],
  files: { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG },
});
const no = (a: Partial<QuietResult> = {}): FakeReply => ({
  exitCode: 1,
  stdout: quietOut(answer({ quiet_area: false, verdict: false, reason: "有人在打", giants: [], claimed: { cell: 45, participant_count: 3 }, ...a })),
  stderr: ["【無人區】不是：第 46 格有人在打（3 人）"],
});
const unknown = (reason = "adb 連不上手機"): FakeReply => ({
  exitCode: 2,
  stdout: quietOut(answer({ quiet_area: null, verdict: null, reason, giants: [] })),
  stderr: ["中止：" + reason],
  files: { "abort.txt": reason + NL },
});

async function setup(text: string, script: (n: number) => FakeReply) {
  const timeline: string[] = [];
  const device = new FakeDevice();
  const bot = new FakeBotRunner((_req, i) => {
    timeline.push(`bot#${i + 1}`);
    return script(i);
  });
  const origTeleport = device.teleport.bind(device);
  device.teleport = async (to) => {
    timeline.push(`teleport ${to.lat},${to.lng}`);
    return origTeleport(to);
  };
  const origStop = device.stop.bind(device);
  device.stop = async () => {
    timeline.push("stop");
    return origStop();
  };
  const app = buildApp({ dataDir: dir, bot, device, waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
  return { app, bot, device, timeline, listId: list.id as number };
}
type App = Awaited<ReturnType<typeof setup>>["app"];

async function runQuiet(app: App, body: object) {
  const res = await app.inject({ method: "POST", url: "/api/batches/quiet-search", payload: body });
  expect(res.statusCode).toBe(201);
  const { batchId } = res.json() as { batchId: number };
  const sse = await app.inject(`/api/batches/${batchId}/events`);
  const events = sse.body
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as BatchEvent);
  return { batchId, events };
}
const results = (events: BatchEvent[]) => events.flatMap((e) => (e.type === "quiet-result" ? [e] : []));

describe("Quiet Giant Search Batch", () => {
  it("依 position 逐點：先 Teleport、等待、再跑 quiet；結束後 stop", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", () => yes());
    await runQuiet(t.app, { listId: t.listId, radius: 300 });
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1", "teleport 2,2", "bot#2", "stop"]);
    expect(t.bot.calls.map((c) => c.command)).toEqual(["quiet", "quiet"]);
    expect(t.bot.calls[0]!.runsDir).toBe(join(dir, "runs"));
  });

  it("半徑：Waypoint 有自己的半徑（匯入 r=）就用它，沒有就用 Batch 預設；不帶 --target", async () => {
    const t = await setup("1,1 r=250 甲" + NL + "2,2 乙", () => yes());
    await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(t.bot.calls[0]!.args).toEqual(["--radius", "250"]);
    expect(t.bot.calls[1]!.args).toEqual(["--radius", "500"]);
  });

  it("exit 0／1／2 各自對應 verdict true／false／null，事件帶該點實際用的半徑", async () => {
    const t = await setup("1,1 r=250 甲" + NL + "2,2 乙" + NL + "3,3 丙", (i) => [yes, no, unknown][i]!());
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events).map((e) => [e.index, e.radius, e.result.verdict, e.result.reason])).toEqual([
      [1, 250, true, "沒人在打，找到 1 顆巨菇"],
      [2, 500, false, "有人在打"],
      [3, 500, null, "adb 連不上手機"],
    ]);
    expect(results(events)[1]!.result.claimed).toEqual({ cell: 45, participant_count: 3 });
    expect(events.at(-1)).toEqual({ type: "finished", status: "done" });
  });

  it("stdout 前面有 Sighting 陣列時仍正確取最後一行；giants 存成 Sighting（有截圖網址），exit 0 的 giants 與答案一致", async () => {
    const two = [giant({ spot_name: "A" }), giant({ spot_name: "B" })];
    const t = await setup("1,1 甲", () => yes({ giants: two, reason: "沒人在打，找到 2 顆巨菇" }));
    const { batchId, events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events)[0]!.result.giants.map((g) => g.spot_name)).toEqual(["A", "B"]);
    const rows = (await t.app.inject(`/api/batches/${batchId}/sightings`)).json() as StoredSighting[];
    expect(rows.map((r) => r.spot_name)).toEqual(["A", "B"]);
    expect(rows[0]!.frameUrl).toMatch(/^\/api\/runs\/fake-run-001\/sighting-01\.png$/);
  });

  it("unread 帶在結果裡（不改變答案）", async () => {
    const t = await setup("1,1 甲", () => yes({ unread: 3 }));
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events)[0]!.result).toMatchObject({ verdict: true, unread: 3 });
  });

  it("bot 的 stderr 逐行經 SSE 推出（含 index）", async () => {
    const t = await setup("1,1 甲", () => no());
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(events.filter((e) => e.type === "stderr")).toEqual([{ type: "stderr", index: 1, line: "【無人區】不是：第 46 格有人在打（3 人）" }]);
  });

  it("exit 2 且 stdout 是空的（argparse 錯誤、冷啟動前就失敗）：該點標灰，原因取自 stderr；繼續下一點", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) =>
      i === 0
        ? { exitCode: 2, stdout: "", stderr: ["usage: mushroom_sweep quiet", "mushroom_sweep quiet: error: --radius 要是正數"], noRunDir: true }
        : yes(),
    );
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events).map((e) => [e.result.verdict, e.result.reason])).toEqual([
      [null, "--radius 要是正數"],
      [true, "沒人在打，找到 1 顆巨菇"],
    ]);
  });

  it("exit code 與 stdout 答案不一致（exit 1 卻說 true）：不信，標灰並說明", async () => {
    const t = await setup("1,1 甲", () => ({ exitCode: 1, stdout: quietOut(answer()), stderr: [] }));
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events)[0]!.result.verdict).toBeNull();
    expect(results(events)[0]!.result.reason).toContain("不一致");
  });

  it("stdout 最後一行不是答案：該點標灰，Batch 不崩", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) => (i === 0 ? { exitCode: 0, stdout: "garbage" } : yes()));
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(results(events).map((e) => e.result.verdict)).toEqual([null, true]);
    expect(results(events)[0]!.result.reason).toContain("JSON");
  });

  it("每個 Waypoint 的結果（exit code、答案、run 資料夾）存進 SQLite", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) => (i === 0 ? yes() : unknown("沒開出遊戲")));
    const { batchId } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    const batch = (await t.app.inject("/api/batches/" + batchId)).json();
    expect(batch).toMatchObject({ feature: "quiet-search", status: "done", params: { listId: t.listId, radius: 500 } });
    expect(batch.runs).toMatchObject([
      { index: 1, exitCode: 0, error: null, runDir: "fake-run-001" },
      { index: 2, exitCode: 2, error: "沒開出遊戲", runDir: "fake-run-002" },
    ]);
    const db = new DatabaseSync(join(dir, "app.db"));
    const rows = db.prepare("SELECT result_json FROM waypoint_runs WHERE batch_id = ? ORDER BY idx").all(batchId) as { result_json: string }[];
    db.close();
    expect(rows.map((r) => (JSON.parse(r.result_json) as QuietResult).verdict)).toEqual([true, null]);
  });

  it("Teleport 失敗：整個 Batch failed，不跑 bot，仍 stop", async () => {
    const t = await setup("1,1 甲", () => yes());
    t.device.failWith = new Error("adb: no devices/emulators found");
    const { events } = await runQuiet(t.app, { listId: t.listId, radius: 500 });
    expect(events.at(-1)).toEqual({ type: "finished", status: "failed", error: "adb: no devices/emulators found" });
    expect(t.bot.calls).toHaveLength(0);
    expect(t.timeline.at(-1)).toBe("stop");
  });

  it("請求不合法：半徑不是正數 400、清單不存在 404，不啟動", async () => {
    const t = await setup("1,1 甲", () => yes());
    const post = (payload: object) => t.app.inject({ method: "POST", url: "/api/batches/quiet-search", payload });
    expect((await post({ listId: t.listId, radius: 0 })).statusCode).toBe(400);
    expect((await post({ listId: t.listId })).statusCode).toBe(400);
    expect((await post({ listId: 9999, radius: 500 })).statusCode).toBe(404);
    expect(t.bot.calls).toHaveLength(0);
  });
});
