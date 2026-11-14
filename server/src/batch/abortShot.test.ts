import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, type FakeReply } from "../bot/fakeBot.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-abort-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const ABORT = "/api/runs/fake-run-001/abort.png";
const aborted: FakeReply = {
  exitCode: 2, stdout: "", stderr: ["中止：找不到 Postcard"], files: { "abort.png": TINY_PNG, "abort.txt": "找不到 Postcard\n" },
};

async function run(url: string, extra: object, reply: FakeReply, text = url.endsWith("postcard-check") ? "1,1 @甲" : "1,1") {
  const app = buildApp({ dataDir: dir, bot: new FakeBotRunner(() => reply), device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L", feature: url.split("/").pop() } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
  const { batchId } = (await app.inject({ method: "POST", url, payload: { listId: list.id, ...extra } })).json() as { batchId: number };
  const body = (await app.inject(`/api/batches/${batchId}/events`)).body;
  const events = body.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)) as BatchEvent);
  const history = (await app.inject(`/api/history/${batchId}`)).json();
  return { events, history };
}

describe("單點 exit 2 的 abort.png", () => {
  it("Quiet：即時事件與歷史頁都有截圖網址", async () => {
    const { events, history } = await run("/api/batches/quiet-search", { radius: 300 }, aborted);
    const q = events.find((e) => e.type === "quiet-result");
    expect(q).toMatchObject({ screenshotUrl: ABORT });
    expect(history.waypoints[0].abortUrl).toBe(ABORT);
  });

  it("Postcard Check：即時事件與歷史頁都有截圖網址", async () => {
    const { events, history } = await run("/api/batches/postcard-check", {}, aborted);
    const c = events.find((e) => e.type === "check-result");
    expect(c).toMatchObject({ outcome: { abortUrl: ABORT } });
    expect(history.waypoints[0].check.abortUrl).toBe(ABORT);
    expect(history.waypoints[0].abortUrl).toBe(ABORT);
  });

  it("Target：歷史頁看得到截圖網址", async () => {
    const { history } = await run("/api/batches/target-search", { targets: ["巨大 *"], radius: 500, skipCrowded: 0 }, aborted);
    expect(history.waypoints[0].abortUrl).toBe(ABORT);
  });

  it("沒有 abort.png 就是 null", async () => {
    const { events, history } = await run("/api/batches/quiet-search", { radius: 300 }, { exitCode: 2, stdout: "", stderr: ["中止：x"] });
    expect(events.find((e) => e.type === "quiet-result")).not.toHaveProperty("screenshotUrl");
    expect(history.waypoints[0].abortUrl).toBeNull();
  });
});
