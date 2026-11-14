import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG } from "../bot/fakeBot.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-listdel-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const sighting = {
  target: "巨大 輝煌蘑菇", lat: 25.03, lng: 121.56, spot_name: "範例地點", participant_count: 0, remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00", map_position: [1, 2], frame: "sighting-01.png", postcard: null,
};

async function setup(hang = false) {
  const bot = new FakeBotRunner(() => ({ exitCode: 0, stdout: JSON.stringify([sighting]), stderr: [], files: { "sighting-01.png": TINY_PNG }, hang }));
  const app = buildApp({ dataDir: dir, bot, device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "清單A", feature: "target-search" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,1 甲" } });
  return { app, listId: list.id as number };
}
const startHunt = async (app: Awaited<ReturnType<typeof setup>>["app"], listId: number) =>
  ((await app.inject({ method: "POST", url: "/api/batches/target-search", payload: { listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 } })).json() as { batchId: number }).batchId;

describe("刪除 Waypoint List", () => {
  it("清單刪掉後 Batch 歷史、Sighting 與 run 資料夾都還在，清單名稱留著", async () => {
    const { app, listId } = await setup();
    const id = await startHunt(app, listId);
    await app.inject(`/api/batches/${id}/events`);
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${listId}` })).statusCode).toBe(204);

    const rows = (await app.inject("/api/history")).json() as { id: number; listId: number | null; listName: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, listId: null, listName: "清單A" });
    const d = (await app.inject(`/api/history/${id}`)).json();
    expect(d.listName).toBe("清單A");
    expect(d.waypoints[0].sightings).toHaveLength(1);
    expect(existsSync(join(dir, "runs", "fake-run-001"))).toBe(true);
  });

  it("清單改名後，歷史顯示改過的名稱；刪掉後留最後的名稱", async () => {
    const { app, listId } = await setup();
    const id = await startHunt(app, listId);
    await app.inject(`/api/batches/${id}/events`);
    await app.inject({ method: "PATCH", url: `/api/lists/${listId}`, payload: { name: "新名字" } });
    expect(((await app.inject("/api/history")).json() as { listName: string }[])[0]!.listName).toBe("新名字");
    await app.inject({ method: "DELETE", url: `/api/lists/${listId}` });
    expect(((await app.inject("/api/history")).json() as { listName: string }[])[0]!.listName).toBe("新名字");
  });

  it("清單有執行中的 Batch：409，清單還在", async () => {
    const { app, listId } = await setup(true);
    const id = await startHunt(app, listId);
    const res = await app.inject({ method: "DELETE", url: `/api/lists/${listId}` });
    expect(res.statusCode).toBe(409);
    expect((await app.inject("/api/lists?feature=target-search")).json()).toHaveLength(1);
    await app.inject({ method: "POST", url: `/api/batches/${id}/cancel`, payload: { mode: "force" } });
    await app.inject(`/api/batches/${id}/events`);
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${listId}` })).statusCode).toBe(204);
  });

  it("清單有排隊中的 Batch：409", async () => {
    const { app, listId } = await setup(true);
    const first = await startHunt(app, listId);
    const second = await startHunt(app, listId);
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${listId}` })).statusCode).toBe(409);
    await app.inject({ method: "POST", url: `/api/batches/${second}/cancel`, payload: {} });
    await app.inject({ method: "POST", url: `/api/batches/${first}/cancel`, payload: { mode: "force" } });
    await app.inject(`/api/batches/${first}/events`);
  });

});
