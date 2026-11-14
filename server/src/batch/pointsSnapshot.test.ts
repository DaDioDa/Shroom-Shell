import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice } from "../bot/fakeBot.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-points-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const noGiants = JSON.stringify({ quiet_area: true, verdict: false, reason: "沒有巨菇", giants: [], claimed: null, unread: 0 });

async function setup() {
  const bot = new FakeBotRunner(() => ({ exitCode: 1, stdout: "[]\n" + noGiants + "\n", stderr: [] }));
  const app = buildApp({ dataDir: dir, bot, device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "清單A" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,1 r=300 甲\n2,2 乙" } });
  const batchId = ((await app.inject({ method: "POST", url: "/api/batches/quiet-search", payload: { listId: list.id, radius: 500 } })).json() as { batchId: number }).batchId;
  await app.inject(`/api/batches/${batchId}/events`); // 讀到 finished 才回
  return { app, listId: list.id as number, batchId };
}

const expectedPoints = [
  { lat: 1, lng: 1, label: "甲", radius: 300 },
  { lat: 2, lng: 2, label: "乙", radius: null },
];

describe("每次執行記下當時的點", () => {
  it("刪掉清單後，歷史詳情仍有每筆執行的 lat、lng、label、radius", async () => {
    const { app, listId, batchId } = await setup();
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${listId}` })).statusCode).toBe(204);
    const d = (await app.inject(`/api/history/${batchId}`)).json();
    expect(d.waypoints).toHaveLength(2);
    expect(d.waypoints.map((w: { point: object }) => w.point)).toMatchObject(expectedPoints);
  });

  it("刪掉單一 Waypoint 後，歷史詳情仍有每筆執行的 lat、lng、label、radius", async () => {
    const { app, listId, batchId } = await setup();
    const wps = (await app.inject(`/api/lists/${listId}/waypoints`)).json() as { id: number }[];
    for (const w of wps) expect((await app.inject({ method: "DELETE", url: `/api/waypoints/${w.id}` })).statusCode).toBe(204);
    const d = (await app.inject(`/api/history/${batchId}`)).json();
    expect(d.waypoints.map((w: { point: object }) => w.point)).toMatchObject(expectedPoints);
    expect(d.waypoints[0].label).toBe("甲");
  });

  it("Waypoint 之後被改過，歷史仍是當時的點", async () => {
    const { app, listId, batchId } = await setup();
    const [first] = (await app.inject(`/api/lists/${listId}/waypoints`)).json() as { id: number }[];
    await app.inject({ method: "PATCH", url: `/api/waypoints/${first!.id}`, payload: { label: "改名", radius: 900 } });
    const d = (await app.inject(`/api/history/${batchId}`)).json();
    expect(d.waypoints[0].point).toMatchObject({ lat: 1, lng: 1, label: "甲", radius: 300, waypointId: first!.id });
  });
});
