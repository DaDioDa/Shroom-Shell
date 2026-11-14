import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent, CheckResult, HistoryDetail } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-check-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const runDirOf = (i: number) => join(dir, "runs", `fake-run-${String(i + 1).padStart(3, "0")}`);
const foundReply = (i: number, over: Partial<Extract<CheckResult, { found: true }>> = {}): FakeReply => ({
  exitCode: 0,
  stdout:
    JSON.stringify({
      found: true, name: "一般 紅色蘑菇", spot_name: "生賀神社", lat: 1, lng: 2, participant_count: 3, remaining_seconds: 5400,
      observed_at: "2026-11-14T21:30:00+08:00", frame: join(runDirOf(i), "frame.png"), postcard: join(runDirOf(i), "postcard.png"), ...over,
    }) + NL,
  files: { "frame.png": TINY_PNG, "postcard.png": TINY_PNG },
});
const missingReply = (unread: number): FakeReply => ({ exitCode: 1, stdout: JSON.stringify({ found: false, spot_name: "生賀神社", unread }) + NL });
const abortReply: FakeReply = {
  exitCode: 2,
  stdout: JSON.stringify({ found: null, spot_name: "生賀神社", reason: "Detail 讀不到座標", name: "一般 紅色蘑菇", participant_count: 3 }) + NL,
};

async function setup(text: string, script: (i: number) => FakeReply) {
  const device = new FakeDevice();
  const bot = new FakeBotRunner((_r, i) => script(i));
  const app = buildApp({ dataDir: dir, bot, device, waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
  return { app, bot, device, listId: list.id as number };
}
const WP2 = "1,2 甲 @生賀神社" + NL + "3,4 乙 @生賀神社";

async function run(t: Awaited<ReturnType<typeof setup>>) {
  const res = await t.app.inject({ method: "POST", url: "/api/batches/postcard-check", payload: { listId: t.listId } });
  expect(res.statusCode).toBe(201);
  const { batchId } = res.json() as { batchId: number };
  const sse = await t.app.inject(`/api/batches/${batchId}/events`);
  const events = sse.body.split("\n\n").filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)) as BatchEvent);
  return { batchId, events, checks: events.flatMap((e) => (e.type === "check-result" ? [e.outcome] : [])) };
}

describe("Postcard Check Batch", () => {
  it("匯入的 @Spot Name 存進 Waypoint；每點跑 check --spot-name", async () => {
    const t = await setup(WP2, (i) => foundReply(i));
    const wps = (await t.app.inject(`/api/lists/${t.listId}/waypoints`)).json();
    expect(wps.map((w: { spotName: string }) => w.spotName)).toEqual(["生賀神社", "生賀神社"]);
    await run(t);
    expect(t.bot.calls.map((c) => [c.command, c.args])).toEqual([["check", ["--spot-name", "生賀神社"]], ["check", ["--spot-name", "生賀神社"]]]);
  });

  it("exit 0：人數 0 與 null 都照 bot 的值保留，圖片網址指向 run 資料夾", async () => {
    const t = await setup(WP2, (i) => foundReply(i, { participant_count: i === 0 ? 0 : null, remaining_seconds: null }));
    const { checks } = await run(t);
    expect(checks.map((c) => (c.result as { participant_count: number | null }).participant_count)).toEqual([0, null]);
    expect(checks[0]).toMatchObject({ index: 1, frameUrl: "/api/runs/fake-run-001/frame.png", postcardUrl: "/api/runs/fake-run-001/postcard.png" });
    const img = await t.app.inject(checks[0]!.frameUrl!);
    expect(img.statusCode).toBe(200);
  });

  it("frame 絕對路徑不在該 run 資料夾底下：不給網址", async () => {
    const t = await setup("1,2 @甲", () => foundReply(0, { frame: join(dir, "..", "evil.png"), postcard: null }));
    const { checks } = await run(t);
    expect(checks[0]).toMatchObject({ frameUrl: null, postcardUrl: null });
  });

  it("exit 1 含 unread；exit 2 含部分欄位與 reason：兩者都是答案，不算 Waypoint 失敗", async () => {
    const t = await setup(WP2, (i) => (i === 0 ? missingReply(2) : abortReply));
    const { checks, events } = await run(t);
    expect(checks.map((c) => c.result)).toEqual([
      { found: false, spot_name: "生賀神社", unread: 2 },
      { found: null, spot_name: "生賀神社", reason: "Detail 讀不到座標", name: "一般 紅色蘑菇", participant_count: 3 },
    ]);
    expect(events.some((e) => e.type === "waypoint-failed")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "finished", status: "done" });
  });

  it("exit 2 且 stdout 空（argparse 錯誤）：標成沒讀完，reason 取自 stderr", async () => {
    const t = await setup("1,2 @甲", () => ({ exitCode: 2, stdout: "", stderr: ["mushroom_sweep check: error: 要有 --spot-name"], noRunDir: true }));
    const { checks } = await run(t);
    expect(checks[0]!.result).toMatchObject({ found: null, reason: "要有 --spot-name" });
  });

  it("缺 Spot Name：400，列出缺的是哪幾個，不碰手機", async () => {
    const t = await setup("1,2 甲 @A" + NL + "3,4 乙" + NL + "5,6 @ ", () => foundReply(0));
    const res = await t.app.inject({ method: "POST", url: "/api/batches/postcard-check", payload: { listId: t.listId } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("乙");
    expect(res.json().missing).toHaveLength(1);
    expect(t.bot.calls).toHaveLength(0);
    expect(t.device.log).toEqual([]);
  });

  it("清單不存在 404；歷史頁還原每點的結果與圖片網址，摘要列出三種數量", async () => {
    const t = await setup(WP2, (i) => (i === 0 ? foundReply(i) : missingReply(0)));
    expect((await t.app.inject({ method: "POST", url: "/api/batches/postcard-check", payload: { listId: 999 } })).statusCode).toBe(404);
    const { batchId } = await run(t);
    const d = (await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail;
    expect(d.summary).toBe("2 個 Waypoint：找到 1、沒找到 1、沒讀完 0");
    expect(d.waypoints[0]!.check).toMatchObject({ result: { found: true }, frameUrl: "/api/runs/fake-run-001/frame.png" });
    expect(d.waypoints[1]!.check).toMatchObject({ result: { found: false }, frameUrl: null });
  });

  it("圖片被上限清掉後：歷史頁的結果標 imagesCleared（卡片顯示「圖片已清除」），即時結果不標", async () => {
    const t = await setup("1,2 甲 @生賀神社", (i) => foundReply(i));
    const { batchId, checks } = await run(t);
    expect(checks[0]!.imagesCleared).toBe(false);
    expect(((await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail).waypoints[0]!.check!.imagesCleared).toBe(false);
    await t.app.inject({ method: "PUT", url: "/api/settings", payload: { runsLimitBytes: 1 } });
    const d = (await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail;
    expect(d.imagesCleared).toBe(true);
    expect(d.waypoints[0]!.check).toMatchObject({ result: { found: true }, frameUrl: null, postcardUrl: null, imagesCleared: true });
  });
});
