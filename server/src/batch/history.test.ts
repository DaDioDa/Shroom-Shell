import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BotSighting, QuietResult } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-history-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const giant = (over: Partial<BotSighting> = {}): BotSighting => ({
  target: "巨大 輝煌蘑菇", lat: 25.03, lng: 121.56, spot_name: "範例地點", participant_count: 0, remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00", map_position: [1, 2], frame: "sighting-01.png", postcard: "postcard-01.png", ...over,
});
const files = { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG };
const hunt = (...s: BotSighting[]): FakeReply => ({ exitCode: 0, stdout: JSON.stringify(s), stderr: [], files });
const quietAnswer = (over: Partial<QuietResult> = {}): QuietResult => ({
  quiet_area: true, verdict: true, reason: "沒人在打，找到 1 顆巨菇", giants: [giant()], claimed: null, unread: 0, ...over,
});
const quiet = (exitCode: number, a: QuietResult): FakeReply => ({
  exitCode, stdout: JSON.stringify(a.giants) + NL + JSON.stringify(a) + NL, stderr: [], files,
});

/** script 回傳的 Promise 讓測試能把 bot 卡在執行中。 */
async function setup(script: (cmd: string, i: number) => FakeReply | Promise<FakeReply>, text = "1,1 甲" + NL + "2,2 乙") {
  const bot = new FakeBotRunner((req, i) => script(req.command, i));
  const app = buildApp({ dataDir: dir, bot, device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  const mk = async (feature: string) => {
    const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "清單A", feature } })).json();
    await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
    return list.id as number;
  };
  return { app, listId: await mk("target-search"), quietListId: await mk("quiet-search") };
}
type App = Awaited<ReturnType<typeof setup>>["app"];

async function start(app: App, url: string, body: object, wait = true): Promise<number> {
  const res = await app.inject({ method: "POST", url, payload: body });
  expect(res.statusCode).toBe(201);
  const { batchId } = res.json() as { batchId: number };
  if (wait) await app.inject(`/api/batches/${batchId}/events`); // 讀到 finished 才回
  return batchId;
}
const startHunt = (app: App, listId: number, wait = true) =>
  start(app, "/api/batches/target-search", { listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 }, wait);
const startQuiet = (app: App, listId: number, wait = true) =>
  start(app, "/api/batches/quiet-search", { listId, radius: 300 }, wait);

describe("歷史 API", () => {
  it("列出所有功能的 Batch：功能、清單名稱、開始／結束時間、結果摘要", async () => {
    const t = await setup((cmd, i) => (cmd === "hunt" ? hunt(giant(), giant({ spot_name: "B" })) : i % 2 ? quiet(1, quietAnswer({ quiet_area: false, verdict: false, giants: [], claimed: { cell: 1, participant_count: 2 }, reason: "有人在打" })) : quiet(0, quietAnswer())));
    const h = await startHunt(t.app, t.listId);
    const q = await startQuiet(t.app, t.quietListId);
    const rows = (await t.app.inject("/api/history")).json() as Record<string, unknown>[];
    expect(rows.map((r) => r.id)).toEqual([q, h]); // 新的在前
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[h]).toMatchObject({ feature: "target-search", listName: "清單A", status: "done", summary: "2 個 Waypoint，找到 4 筆 Sighting" });
    expect(byId[q]).toMatchObject({ feature: "quiet-search", listName: "清單A", status: "done", summary: "2 個 Waypoint：是 1、不是 1、無法判斷 0" });
    expect(typeof byId[h]!.createdAt).toBe("string");
    expect(typeof byId[h]!.finishedAt).toBe("string");
  });

  it("Target 的單一 Batch：每個 Waypoint 的結果與 Sighting（含截圖網址）", async () => {
    const t = await setup((_c, i) => (i === 0 ? hunt(giant({ spot_name: "A" })) : { exitCode: 2, stdout: "", stderr: ["error: 壞了"], noRunDir: true }));
    const id = await startHunt(t.app, t.listId);
    const d = (await t.app.inject(`/api/history/${id}`)).json();
    expect(d.feature).toBe("target-search");
    expect(d.waypoints.map((w: { index: number; label: string; error: string | null }) => [w.index, w.label, w.error])).toEqual([
      [1, "甲", null],
      [2, "乙", "壞了"],
    ]);
    expect(d.waypoints[0].sightings.map((s: BotSighting) => s.spot_name)).toEqual(["A"]);
    expect(d.waypoints[0].sightings[0].frameUrl).toBe("/api/runs/fake-run-001/sighting-01.png");
    expect(d.waypoints[1].sightings).toEqual([]);
  });

  it("Quiet 的單一 Batch：重新從 DB 讀得出每點的答案、半徑、reason、claimed、unread", async () => {
    const t = await setup((_c, i) =>
      i === 0 ? quiet(0, quietAnswer({ unread: 2 })) : quiet(1, quietAnswer({ quiet_area: false, verdict: false, giants: [], reason: "有人在打", claimed: { cell: 45, participant_count: 3 } })),
      "1,1 r=250 甲" + NL + "2,2 乙",
    );
    const id = await startQuiet(t.app, t.quietListId);
    const d = (await t.app.inject(`/api/history/${id}`)).json();
    expect(d.waypoints.map((w: { quiet: unknown }) => w.quiet)).toEqual([
      { radius: 250, result: quietAnswer({ unread: 2 }) },
      { radius: 300, result: quietAnswer({ quiet_area: false, verdict: false, giants: [], reason: "有人在打", claimed: { cell: 45, participant_count: 3 } }) },
    ]);
    expect(d.waypoints[0].sightings).toHaveLength(1);
  });

  it("找不到 Batch 回 404", async () => {
    const t = await setup(() => hunt());
    expect((await t.app.inject("/api/history/999")).statusCode).toBe(404);
  });
});

describe("刪除 Batch", () => {
  it("DB 紀錄（waypoint_runs、sightings）與 run 資料夾一起刪；別的 Batch 不受影響", async () => {
    const t = await setup((_c, i) => hunt(giant({ spot_name: `S${i}` })));
    const a = await startHunt(t.app, t.listId); // fake-run-001、002
    const b = await startHunt(t.app, t.listId); // fake-run-003、004
    const runs = join(dir, "runs");
    expect([1, 2, 3, 4].map((n) => existsSync(join(runs, `fake-run-00${n}`)))).toEqual([true, true, true, true]);

    expect((await t.app.inject({ method: "DELETE", url: `/api/batches/${a}` })).statusCode).toBe(204);

    expect([1, 2, 3, 4].map((n) => existsSync(join(runs, `fake-run-00${n}`)))).toEqual([false, false, true, true]);
    expect((await t.app.inject(`/api/history/${a}`)).statusCode).toBe(404);
    expect(((await t.app.inject("/api/history")).json() as { id: number }[]).map((r) => r.id)).toEqual([b]);
    const db = new DatabaseSync(join(dir, "app.db"));
    expect(db.prepare("SELECT COUNT(*) n FROM sightings WHERE batch_id = ?").get(a)).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) n FROM waypoint_runs WHERE batch_id = ?").get(a)).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) n FROM sightings WHERE batch_id = ?").get(b)).toEqual({ n: 2 });
    db.close();
  });

  it("run 資料夾已被清掉（超量清理）也能刪", async () => {
    const t = await setup(() => hunt(giant()));
    const id = await startHunt(t.app, t.listId);
    rmSync(join(dir, "runs"), { recursive: true, force: true });
    expect((await t.app.inject({ method: "DELETE", url: `/api/batches/${id}` })).statusCode).toBe(204);
  });

  it("執行中的 Batch 不能刪：回 409，DB 與資料夾都還在；跑完後可以刪", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const t = await setup(async () => {
      await gate;
      return hunt(giant());
    }, "1,1 甲");
    const id = await startHunt(t.app, t.listId, false);
    const res = await t.app.inject({ method: "DELETE", url: `/api/batches/${id}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("執行");
    expect((await t.app.inject(`/api/history/${id}`)).statusCode).toBe(200);
    release();
    await t.app.inject(`/api/batches/${id}/events`);
    expect((await t.app.inject({ method: "DELETE", url: `/api/batches/${id}` })).statusCode).toBe(204);
  });

  it("排隊中的 Batch 也不能刪", async () => {
    const t = await setup(() => hunt());
    const id = await startHunt(t.app, t.listId);
    const db = new DatabaseSync(join(dir, "app.db"));
    db.prepare("UPDATE batches SET status = 'queued' WHERE id = ?").run(id);
    db.close();
    expect((await t.app.inject({ method: "DELETE", url: `/api/batches/${id}` })).statusCode).toBe(409);
  });

  it("不存在的 Batch 回 404", async () => {
    const t = await setup(() => hunt());
    expect((await t.app.inject({ method: "DELETE", url: "/api/batches/999" })).statusCode).toBe(404);
  });

  it("路徑安全：DB 裡的 run_dir 若想跳出 runs/（../、絕對路徑），只刪 DB，不碰外面的檔案", async () => {
    const t = await setup(() => hunt(giant()), "1,1 甲");
    const id = await startHunt(t.app, t.listId);
    const outside = join(dir, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "keep.txt"), "別刪我");
    const abs = mkdtempSync(join(tmpdir(), "shell-abs-"));
    writeFileSync(join(abs, "keep.txt"), "別刪我");
    const db = new DatabaseSync(join(dir, "app.db"));
    db.prepare("UPDATE waypoint_runs SET run_dir = ? WHERE batch_id = ?").run("../outside", id);
    db.prepare("UPDATE sightings SET run_dir = ? WHERE batch_id = ?").run(abs, id);
    db.close();
    expect((await t.app.inject({ method: "DELETE", url: `/api/batches/${id}` })).statusCode).toBe(204);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
    expect(existsSync(join(abs, "keep.txt"))).toBe(true);
    rmSync(abs, { recursive: true, force: true });
  });
});

describe("GET /api/sightings", () => {
  it("回傳 SQLite 裡所有 Batch 的 Sighting，不限目前跟隨的那個", async () => {
    const t = await setup((cmd) => (cmd === "hunt" ? hunt(giant({ spot_name: "A" })) : hunt(giant({ spot_name: "B" }))));
    await startHunt(t.app, t.listId);
    await startHunt(t.app, t.listId);
    const all = (await t.app.inject("/api/sightings")).json() as { spot_name: string; batchId: number }[];
    expect(new Set(all.map((s) => s.batchId)).size).toBe(2);
    expect(all.length).toBe(4);
  });
});
