import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent, HistoryDetail, QuietResult, Region, WaypointList } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-discovery-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const M_PER_DEG_LAT = 111_320;
function region(widthM: number, heightM: number, lat = 25, lng = 121): Region {
  const dLat = heightM / M_PER_DEG_LAT / 2;
  const dLng = widthM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)) / 2;
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

const answer = (verdict: boolean | null): QuietResult => ({
  quiet_area: verdict, verdict, reason: verdict === true ? "找到巨菇" : verdict === false ? "有人在打" : "adb 連不上手機",
  giants: [], claimed: null, unread: 0,
});
const reply = (verdict: boolean | null): FakeReply => ({
  exitCode: verdict === true ? 0 : verdict === false ? 1 : 2,
  stdout: "[]" + NL + JSON.stringify(answer(verdict)) + NL,
  stderr: [],
});

function setup(script: (i: number) => FakeReply | Promise<FakeReply>) {
  const device = new FakeDevice();
  const bot = new FakeBotRunner((_r, i) => script(i));
  const app = buildApp({ dataDir: dir, bot, device, waitMs: 0 });
  apps.push(app);
  return { app, bot, device };
}
type App = ReturnType<typeof setup>["app"];

const start = (app: App, body: object) => app.inject({ method: "POST", url: "/api/batches/discovery", payload: body });
async function events(app: App, batchId: number) {
  const sse = await app.inject(`/api/batches/${batchId}/events`);
  return sse.body.split(NL + NL).filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)) as BatchEvent);
}
async function lists(app: App) {
  return (await app.inject("/api/lists?feature=quiet-search")).json() as WaypointList[];
}
const body = (over: object = {}) => ({ name: "北區", region: region(3000, 2000), radius: 500, spacing: 1000, ...over });

describe("Discovery Batch", () => {
  it("依蛇形順序逐點 Teleport、每點跑 quiet --radius 500；格子顏色用 quiet-result 的 verdict", async () => {
    const t = setup((i) => reply([true, false, null, true, false, false][i]!));
    const res = await start(t.app, body());
    expect(res.statusCode).toBe(201);
    const ev = await events(t.app, res.json().batchId);
    const lngs = t.device.log.filter((l) => l.startsWith("teleport")).map((l) => Number(l.split(",")[1]));
    expect(lngs).toHaveLength(6);
    expect(lngs[0]).toBeLessThan(lngs[2]!); // 南排由西往東
    expect(lngs[3]).toBeGreaterThan(lngs[5]!); // 北排由東往西
    expect(t.bot.calls.map((c) => [c.command, ...c.args])).toEqual(Array(6).fill(["quiet", "--radius", "500"]));
    const q = ev.flatMap((e) => (e.type === "quiet-result" ? [e.result.verdict] : []));
    expect(q).toEqual([true, false, null, true, false, false]);
    expect(ev.at(-1)).toEqual({ type: "finished", status: "done" });
    expect(t.device.log.at(-1)).toBe("stop");
  });

  it("Discovery 不建立任何清單（包括 true 的點），回應只有 batchId", async () => {
    const t = setup((i) => reply([true, false, null, true, false, false][i]!));
    const before = (await lists(t.app)).length;
    const res = await start(t.app, body({ radius: 400 }));
    expect(res.json()).toEqual({ batchId: expect.any(Number) });
    await events(t.app, res.json().batchId);
    expect(await lists(t.app)).toHaveLength(before);
    const all = (await t.app.inject("/api/lists?feature=quiet-search")).json() as WaypointList[];
    expect(all.some((l) => l.name.startsWith("Discovery"))).toBe(false);
  });

  it("執行紀錄存每格位置，標籤「格 N」，沒有 waypointId；Batch 沒有清單", async () => {
    const t = setup(() => reply(true));
    const { batchId } = (await start(t.app, body())).json();
    await events(t.app, batchId);
    const d = (await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail;
    const teleported = t.device.log.filter((l) => l.startsWith("teleport")).map((l) => l.slice(9).split(",").map(Number));
    expect(d.waypoints.map((w) => w.label)).toEqual(["格 1", "格 2", "格 3", "格 4", "格 5", "格 6"]);
    expect(d.waypoints.map((w) => w.waypointId)).toEqual(Array(6).fill(null));
    expect(d.waypoints.map((w) => [w.point.lat, w.point.lng])).toEqual(teleported);
    expect(d.listId).toBeNull();
    expect(d.listName).toBe("北區"); // 歷史列表顯示 Region 名稱
  });

  it("歷史詳情附 Region、半徑、間距與名稱", async () => {
    const t = setup(() => reply(false));
    const r = region(3000, 2000);
    const { batchId } = (await start(t.app, body({ name: "北區", region: r, radius: 400, spacing: 1000 }))).json();
    await events(t.app, batchId);
    const d = (await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail;
    expect(d.discovery).toEqual({ name: "北區", region: r, radius: 400, spacing: 1000 });
    const q = (await t.app.inject("/api/lists?feature=quiet-search")).json();
    expect(q).toEqual([]);
  });

  it("名稱留空時後端自動命名「探索 YYYY-MM-DD HH:mm」", async () => {
    const t = setup(() => reply(false));
    for (const name of [undefined, "", "  "]) {
      const { batchId } = (await start(t.app, body({ name, region: region(1000, 1000) }))).json();
      await events(t.app, batchId);
      const d = (await t.app.inject(`/api/history/${batchId}`)).json() as HistoryDetail;
      expect(d.discovery!.name).toMatch(/^探索 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });

  it("佇列項目沒有清單，顯示 Region 名稱", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const t = setup(async () => {
      await gate;
      return reply(false);
    });
    const { batchId } = (await start(t.app, body({ region: region(1000, 1000) }))).json();
    await new Promise((r) => setTimeout(r, 30));
    const q = (await t.app.inject("/api/queue")).json();
    expect(q.running).toMatchObject({ batchId, feature: "discovery", listId: null, listName: "北區" });
    release();
    await events(t.app, batchId);
  });

  it("Quiet 結果的 Batch 與 Quiet Giant Search 共用佇列；Batch 的 feature 是 discovery", async () => {
    const t = setup(() => reply(false));
    const { batchId } = (await start(t.app, body({ region: region(1000, 1000) }))).json();
    await events(t.app, batchId);
    expect((await t.app.inject(`/api/batches/${batchId}`)).json().feature).toBe("discovery");
  });

  it("歷史頁把 Discovery 當 Quiet 摘要（是／不是／無法判斷）", async () => {
    const t = setup((i) => reply([true, false, null][i]!));
    const { batchId } = (await start(t.app, body({ region: region(3000, 1000) }))).json();
    await events(t.app, batchId);
    const rows = (await t.app.inject("/api/history")).json() as { id: number; summary: string }[];
    expect(rows.find((r) => r.id === batchId)!.summary).toBe("3 個 Waypoint：是 1、不是 1、無法判斷 1");
  });

  it("超過 10 km 拒絕並說明原因，不建 Batch、不碰手機", async () => {
    const t = setup(() => reply(false));
    const res = await start(t.app, body({ region: region(10_500, 2000) }));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/10 km/);
    expect(t.bot.calls).toHaveLength(0);
    expect(t.device.log).toEqual([]);
  });

  it("超過 30 點要 confirmed 才開始", async () => {
    const t = setup(() => reply(false));
    const big = body({ region: region(6000, 6000) }); // 36 點
    const refused = await start(t.app, big);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ needsConfirm: true, points: 36 });
    expect(t.bot.calls).toHaveLength(0);
    const ok = await start(t.app, { ...big, confirmed: true });
    expect(ok.statusCode).toBe(201);
    await events(t.app, ok.json().batchId);
    expect(t.bot.calls).toHaveLength(36);
  });

  it("參數不合法回 400", async () => {
    const t = setup(() => reply(false));
    for (const bad of [{ radius: 0 }, { spacing: -1 }, { region: { south: 1 } }]) {
      expect((await start(t.app, body(bad))).statusCode).toBe(400);
    }
  });
});

describe("預估時間的實測來源", () => {
  it("沒有 quiet 紀錄時 avgMsPerPoint 是 null", async () => {
    const t = setup(() => reply(false));
    expect((await t.app.inject("/api/quiet-stats")).json()).toEqual({ avgMsPerPoint: null });
  });

  it("跑過 quiet 之後回傳每點平均耗時（含 Teleport 與等待）", async () => {
    const t = setup(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return reply(false);
    });
    const { batchId } = (await start(t.app, body({ region: region(2000, 1000) }))).json();
    await events(t.app, batchId);
    const { avgMsPerPoint } = (await t.app.inject("/api/quiet-stats")).json();
    expect(avgMsPerPoint).toBeGreaterThanOrEqual(40);
    expect(avgMsPerPoint).toBeLessThan(2000);
  });
});
