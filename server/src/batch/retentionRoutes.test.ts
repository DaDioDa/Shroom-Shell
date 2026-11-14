import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BotSighting } from "@shell/shared";
import { buildApp, type AppOptions } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG } from "../bot/fakeBot.js";
import { openDb } from "../db/database.js";

const NL = String.fromCharCode(10);
const PNG = TINY_PNG.length;
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-retention-routes-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const giant = (): BotSighting => ({
  target: "巨大 輝煌蘑菇", lat: 25.03, lng: 121.56, spot_name: "範例地點", participant_count: 0, remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00", map_position: [1, 2], frame: "sighting-01.png", postcard: "postcard-01.png",
});
const reply = { exitCode: 0, stdout: JSON.stringify([giant()]), stderr: [], files: { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG } };

function build(opts: AppOptions = {}) {
  const app = buildApp({ dataDir: dir, bot: new FakeBotRunner(() => reply), device: new FakeDevice(), waitMs: 0, ...opts });
  apps.push(app);
  return app;
}
type App = ReturnType<typeof build>;

async function runHunt(app: App, listId: number): Promise<number> {
  const res = await app.inject({ method: "POST", url: "/api/batches/target-search", payload: { listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 } });
  const { batchId } = res.json() as { batchId: number };
  await app.inject(`/api/batches/${batchId}/events`);
  return batchId;
}
async function listWith2Waypoints(app: App): Promise<number> {
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "清單A" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,1 甲" + NL + "2,2 乙" } });
  return list.id;
}
const detail = async (app: App, id: number) => (await app.inject(`/api/history/${id}`)).json();

describe("run 資料夾上限：觸發時機", () => {
  it("每個 Batch 結束後檢查一次：超過上限就清最舊的，文字結果還在", async () => {
    // 每個 Batch 兩個 Waypoint、每個 run 資料夾 2 張圖 → 4 張；上限 6 張。
    const app = build({ runsLimitBytes: 6 * PNG });
    const listId = await listWith2Waypoints(app);
    const first = await runHunt(app, listId);
    expect((await detail(app, first)).imagesCleared).toBe(false);
    const second = await runHunt(app, listId);
    const d1 = await detail(app, first);
    const d2 = await detail(app, second);
    expect(d1.imagesCleared).toBe(true);
    expect(d2.imagesCleared).toBe(false);
    expect(existsSync(join(dir, "runs", "fake-run-001"))).toBe(false);
    expect(existsSync(join(dir, "runs", "fake-run-003"))).toBe(true);
    // 文字結果還在，只是沒有圖。
    const s = d1.waypoints[0].sightings[0];
    expect(s).toMatchObject({ target: "巨大 輝煌蘑菇", spot_name: "範例地點", frameUrl: null, postcardUrl: null, imagesCleared: true });
    expect(d2.waypoints[0].sightings[0]).toMatchObject({ imagesCleared: false });
    expect((await app.inject("/api/history")).json().find((r: { id: number }) => r.id === first)).toMatchObject({ imagesCleared: true });
  });

  it("App 啟動時檢查一次", async () => {
    const seeded = openDb(dir);
    seeded.exec("INSERT INTO waypoint_lists (name) VALUES ('清單')");
    for (const n of ["run-a", "run-b"]) {
      mkdirSync(join(dir, "runs", n), { recursive: true });
      writeFileSync(join(dir, "runs", n, "sighting-01.png"), Buffer.alloc(100));
      const id = Number(seeded.prepare("INSERT INTO batches (list_id, feature, params, status, created_at) VALUES (1, 'target-search', '{}', 'done', 'x')").run().lastInsertRowid);
      seeded.prepare("INSERT INTO waypoint_runs (batch_id, waypoint_id, idx, exit_code, result_json, run_dir) VALUES (?, 1, 1, 0, '[]', ?)").run(id, n);
    }
    seeded.close();
    const app = build({ runsLimitBytes: 150 });
    expect(existsSync(join(dir, "runs", "run-a"))).toBe(false);
    expect(existsSync(join(dir, "runs", "run-b"))).toBe(true);
    const rows = (await app.inject("/api/history")).json() as { id: number; imagesCleared: boolean }[];
    expect(rows.map((r) => [r.id, r.imagesCleared])).toEqual([[2, false], [1, true]]);
  });
});

describe("run 資料夾上限：設定", () => {
  it("預設 1 GB，可用 PUT /api/settings 調整並保存；套用後立刻檢查", async () => {
    const app = build();
    expect((await app.inject("/api/settings")).json()).toEqual({ runsLimitBytes: 1024 ** 3 });
    const listId = await listWith2Waypoints(app);
    const id = await runHunt(app, listId);
    const put = await app.inject({ method: "PUT", url: "/api/settings", payload: { runsLimitBytes: PNG } });
    expect(put.statusCode).toBe(200);
    expect((await app.inject("/api/settings")).json()).toEqual({ runsLimitBytes: PNG });
    expect((await detail(app, id)).imagesCleared).toBe(true);
    await app.close();
    apps.length = 0;
    const again = build();
    expect((await again.inject("/api/settings")).json()).toEqual({ runsLimitBytes: PNG });
  });

  it("不合理的上限回 400", async () => {
    const app = build();
    for (const bad of [0, -1, "1", null, Number.NaN]) {
      const res = await app.inject({ method: "PUT", url: "/api/settings", payload: { runsLimitBytes: bad } });
      expect(res.statusCode).toBe(400);
    }
  });
});
