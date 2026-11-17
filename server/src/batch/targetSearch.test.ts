import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent, BotSighting, StoredSighting } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, sightingStderr, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-batch-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const sighting = (over: Partial<BotSighting> = {}): BotSighting => ({
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
const found = (...s: BotSighting[]): FakeReply => ({
  exitCode: 0,
  stdout: JSON.stringify(s, null, 2),
  stderr: s.flatMap((x) => sightingStderr(x, x.postcard)),
  files: { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG },
});

/** 建立開著假 bot／假手機的 app，並把 Waypoint 匯入一份新清單。 */
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
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L", feature: "target-search" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
  return { app, bot, device, timeline, listId: list.id as number };
}

function setWaypointRadius(label: string, radius: number): void {
  const db = new DatabaseSync(join(dir, "app.db"));
  db.prepare("UPDATE waypoints SET radius = ? WHERE label = ?").run(radius, label);
  db.close();
}

type App = Awaited<ReturnType<typeof setup>>["app"];

/** 啟動 Target Search，讀 SSE 到結束（stream 在 finished 後關閉），回傳所有事件。 */
async function runBatch(app: App, body: object) {
  const res = await app.inject({ method: "POST", url: "/api/batches/target-search", payload: body });
  expect(res.statusCode).toBe(201);
  const { batchId } = res.json() as { batchId: number };
  const sse = await app.inject(`/api/batches/${batchId}/events`);
  const events = sse.body
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as BatchEvent);
  return { batchId, events, sse };
}

describe("Target Search Batch", () => {
  it("依 position 逐點：先 Teleport、等待、再跑 hunt；結束後 stop", async () => {
    const t = await setup("1,1 甲\n2,2 乙\n3,3 丙", () => found());
    await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1", "teleport 2,2", "bot#2", "teleport 3,3", "bot#3", "stop"]);
  });

  it("hunt 的參數：Waypoint 有半徑用自己的，沒有就用 Batch 預設；帶 Target 與 --skip-crowded", async () => {
    const t = await setup("1,1 甲\n2,2 乙", () => found());
    setWaypointRadius("乙", 250); // 半徑編輯是別張票；這裡直接寫 DB 當前置條件
    await runBatch(t.app, { listId: t.listId, targets: ["巨大 *", "一般 紅色蘑菇"], radius: 500, skipCrowded: 5 });
    expect(t.bot.calls.map((c) => c.command)).toEqual(["hunt", "hunt"]);
    expect(t.bot.calls[0]!.args).toEqual([
      "--radius", "500", "--target", "巨大 *", "--target", "一般 紅色蘑菇", "--skip-crowded", "5",
    ]);
    expect(t.bot.calls[1]!.args.slice(0, 2)).toEqual(["--radius", "250"]);
    expect(t.bot.calls[0]!.runsDir).toBe(join(dir, "runs"));
  });

  it("解析 stdout 的 Sighting 存進 SQLite；重開 App 後還在", async () => {
    const t = await setup("1,1 甲\n2,2 乙", (i) =>
      found(sighting({ spot_name: `地點${i + 1}`, participant_count: i === 0 ? 0 : 3, remaining_seconds: i === 0 ? null : 5400 })),
    );
    const { batchId } = await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    await t.app.close();

    const again = buildApp({ dataDir: dir, bot: t.bot, device: t.device, waitMs: 0 });
    apps.push(again);
    const rows = (await again.inject(`/api/batches/${batchId}/sightings`)).json() as StoredSighting[];
    expect(rows.map((r) => [r.spot_name, r.participant_count, r.remaining_seconds, r.target])).toEqual([
      ["地點1", 0, null, "巨大 輝煌蘑菇"],
      ["地點2", 3, 5400, "巨大 輝煌蘑菇"],
    ]);
    expect(rows[0]).toMatchObject({ lat: 25.033964, lng: 121.564468, observed_at: "2026-11-14T14:08:00+08:00", map_position: [672, 814], batchId });
    expect(rows[0]!.waypointId).not.toBe(rows[1]!.waypointId);
  });

  it("hunt 印 []（沒找到）：Batch 照樣跑完，沒有 Sighting，也不算失敗", async () => {
    const t = await setup("1,1 甲", () => ({ exitCode: 0, stdout: "[]\n", stderr: ["【結束】找到 0 顆，花了 0 分 40 秒"] }));
    const { batchId, events } = await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    expect((await t.app.inject(`/api/batches/${batchId}/sightings`)).json()).toEqual([]);
    expect(events.map((e) => e.type)).not.toContain("waypoint-failed");
    expect(events.at(-1)).toEqual({ type: "finished", status: "done" });
  });

  it("SSE：started、每點 progress、bot 的 stderr 逐行、Sighting、finished", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) => found(sighting({ spot_name: "地點" + (i + 1) })));
    const { batchId, events, sse } = await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    expect(sse.headers["content-type"]).toContain("text/event-stream");
    const compact = events.map((e) =>
      e.type === "stderr" ? `stderr#${e.index} ${e.line}` : e.type === "sighting" ? `sighting ${e.sighting.spot_name}` : e.type === "progress" ? `progress ${e.index}/${e.total} ${e.label}` : e.type,
    );
    expect(compact).toEqual([
      "started",
      "progress 1/2 甲",
      "stderr#1 【找到 Target】巨大 輝煌蘑菇｜地點1",
      "stderr#1   參與人數 0｜尚未開始倒數",
      "stderr#1   地圖 https://maps.google.com/?q=25.033964,121.564468",
      "stderr#1   Postcard postcard-01.png",
      "sighting 地點1", // Sweep 中從 stderr 先存的
      "sighting 地點1", // bot 結束後用 stdout 補齊同一筆
      "progress 2/2 乙",
      "stderr#2 【找到 Target】巨大 輝煌蘑菇｜地點2",
      "stderr#2   參與人數 0｜尚未開始倒數",
      "stderr#2   地圖 https://maps.google.com/?q=25.033964,121.564468",
      "stderr#2   Postcard postcard-01.png",
      "sighting 地點2",
      "sighting 地點2",
      "finished",
    ]);
    expect(events[0]).toEqual({ type: "started", batchId, total: 2 });
    // 晚來的連線（Batch 已結束）也能從頭重播
    const late = await t.app.inject("/api/batches/" + batchId + "/events");
    expect(late.body).toBe(sse.body);
  });

  it("截圖與 Postcard 由後端從 DATA_DIR 下的 run 資料夾提供", async () => {
    const t = await setup("1,1 甲", () => found(sighting({ postcard: null })));
    const { batchId } = await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    const [s] = (await t.app.inject("/api/batches/" + batchId + "/sightings")).json() as StoredSighting[];
    expect(s!.postcardUrl).toBeNull(); // bot 沒截到 Postcard
    expect(s!.frameUrl).toMatch(/^\/api\/runs\/[\w.-]+\/sighting-01\.png$/);
    const img = await t.app.inject(s!.frameUrl!);
    expect(img.statusCode).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    expect(img.rawPayload.equals(TINY_PNG)).toBe(true);
  });

  it("run 資料夾的檔案只能在該資料夾內取；找不到或想跳出去都是 404", async () => {
    const t = await setup("1,1 甲", () => found());
    await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    expect((await t.app.inject("/api/runs/fake-run-001/nope.png")).statusCode).toBe(404);
    expect((await t.app.inject("/api/runs/fake-run-001/..%2F..%2Fapp.db")).statusCode).toBe(404);
    expect((await t.app.inject("/api/runs/..%2F/app.db")).statusCode).toBe(404);
  });
});

describe("Target Search Batch：Sweep 中即時回報 Sighting", () => {
  const body = (listId: number) => ({ listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
  const sightingEvents = (events: BatchEvent[]) => events.flatMap((e) => (e.type === "sighting" ? [e.sighting] : []));

  it("stderr 一印出 Sighting 就存下並推送（截圖網址取自 Postcard 路徑）；bot 結束後用 stdout 補齊同一筆，不重複", async () => {
    const s = sighting({ remaining_seconds: 5400, observed_at: new Date().toISOString() });
    const t = await setup("1,1 甲", () => ({
      ...found(s),
      stderr: sightingStderr(s, join(dir, "runs", "fake-run-001", "postcard-01.png")),
    }));
    const { batchId, events } = await runBatch(t.app, body(t.listId));
    const [early, final] = sightingEvents(events);
    expect(early).toMatchObject({ target: "巨大 輝煌蘑菇", spot_name: "範例地點", lat: 25.033964, lng: 121.564468, participant_count: 0, waypointId: expect.any(Number) });
    expect(early!.remaining_seconds).toBeGreaterThan(5300);
    expect(early!.postcardUrl).toBe("/api/runs/fake-run-001/postcard-01.png");
    expect(early!.frameUrl).toBe("/api/runs/fake-run-001/sighting-01.png");
    expect(final).toMatchObject({ id: early!.id, observed_at: s.observed_at, remaining_seconds: 5400, map_position: [672, 814] });
    expect((await t.app.inject(`/api/batches/${batchId}/sightings`)).json()).toHaveLength(1);
  });

  it("中止（exit 2、stdout 為空）：Sweep 中已找到的 Sighting 留著，截圖照樣找得到", async () => {
    const t = await setup("1,1 甲", () => ({
      exitCode: 2,
      stdout: "",
      stderr: [...sightingStderr(sighting(), "postcard-01.png"), "中止：畫面卡住"],
      files: { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG },
    }));
    const { batchId, events } = await runBatch(t.app, body(t.listId));
    expect(events.find((e) => e.type === "waypoint-failed")).toMatchObject({ error: "畫面卡住" });
    const rows = (await t.app.inject(`/api/batches/${batchId}/sightings`)).json() as StoredSighting[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ spot_name: "範例地點", frameUrl: "/api/runs/fake-run-001/sighting-01.png", postcardUrl: "/api/runs/fake-run-001/postcard-01.png" });
  });

  it("先存的那筆在 stdout 裡沒有：刪掉並推 sighting-removed", async () => {
    const t = await setup("1,1 甲", () => ({ exitCode: 0, stdout: "[]", stderr: sightingStderr(sighting(), null) }));
    const { batchId, events } = await runBatch(t.app, body(t.listId));
    const [early] = sightingEvents(events);
    expect(events).toContainEqual({ type: "sighting-removed", id: early!.id });
    expect((await t.app.inject(`/api/batches/${batchId}/sightings`)).json()).toEqual([]);
  });
});

describe("手動 Teleport（移到某筆 Sighting）", () => {
  it("把手機的模擬 GPS 設到指定座標", async () => {
    const t = await setup("1,1 甲", () => found());
    const res = await t.app.inject({ method: "POST", url: "/api/teleport", payload: { lat: 25.03, lng: 121.56 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ lat: 25.03, lng: 121.56 });
    expect(t.device.log).toEqual(["teleport 25.03,121.56"]);
  });

  it("座標不合法：400，不動手機", async () => {
    const t = await setup("1,1 甲", () => found());
    for (const payload of [{}, { lat: "1", lng: 2 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }]) {
      expect((await t.app.inject({ method: "POST", url: "/api/teleport", payload })).statusCode).toBe(400);
    }
    expect(t.device.log).toEqual([]);
  });

  it("有 Batch 在跑：409，不動手機", async () => {
    const t = await setup("1,1 甲", () => ({ exitCode: 0, stdout: "", hang: true }));
    const { batchId } = (await t.app.inject({ method: "POST", url: "/api/batches/target-search", payload: { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 } })).json() as { batchId: number };
    const res = await t.app.inject({ method: "POST", url: "/api/teleport", payload: { lat: 5, lng: 6 } });
    expect(res.statusCode).toBe(409);
    await t.app.inject({ method: "POST", url: `/api/batches/${batchId}/cancel`, payload: { mode: "force" } });
    await t.app.inject(`/api/batches/${batchId}/events`); // 等 Batch 收尾
    expect(t.device.log).not.toContain("teleport 5,6");
  });

  it("手機錯誤：500 並帶原因", async () => {
    const t = await setup("1,1 甲", () => found());
    t.device.failWith = new Error("adb: no devices/emulators found");
    const res = await t.app.inject({ method: "POST", url: "/api/teleport", payload: { lat: 1, lng: 2 } });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "adb: no devices/emulators found" });
  });
});

describe("Target Search Batch：bot 失敗（exit 2）", () => {
  const body = (listId: number) => ({ listId, targets: ["巨大 輝煌菇"], radius: 500, skipCrowded: 0 });

  it("Target 名稱寫錯（argparse 錯誤、stdout 為空）：顯示 bot 的錯誤訊息，繼續下一點，最後仍 stop", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", () => ({
      exitCode: 2,
      stdout: "",
      stderr: ["usage: mushroom_sweep hunt [-h] --radius METERS", "mushroom_sweep hunt: error: 找不到 Target「巨大 輝煌菇」"],
      noRunDir: true,
    }));
    const { events, batchId } = await runBatch(t.app, body(t.listId));
    const failed = events.filter((e) => e.type === "waypoint-failed");
    expect(failed).toEqual([
      { type: "waypoint-failed", index: 1, error: "找不到 Target「巨大 輝煌菇」" },
      { type: "waypoint-failed", index: 2, error: "找不到 Target「巨大 輝煌菇」" },
    ]);
    expect(t.bot.calls).toHaveLength(2);
    expect(t.timeline.at(-1)).toBe("stop");
    expect((await t.app.inject("/api/batches/" + batchId + "/sightings")).json()).toEqual([]);
  });

  it("冷啟動就中止（stdout 為空、有 run 資料夾）：錯誤取自「中止：」那行；不是「沒找到」", async () => {
    const t = await setup("1,1 甲", () => ({
      exitCode: 2,
      stdout: "",
      stderr: ["中止：adb 連不上手機", "  截圖：runs/x/abort.png"],
      files: { "abort.txt": "adb 連不上手機\n" },
    }));
    const { events } = await runBatch(t.app, body(t.listId));
    expect(events.find((e) => e.type === "waypoint-failed")).toEqual({ type: "waypoint-failed", index: 1, error: "adb 連不上手機" });
    expect(events.at(-1)).toEqual({ type: "finished", status: "done" });
  });

  it("stdout 不是合法 Sighting 陣列時，該點標成失敗而不是整個 Batch 崩掉", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) => (i === 0 ? { exitCode: 0, stdout: "garbage" } : found(sighting())));
    const { events, batchId } = await runBatch(t.app, body(t.listId));
    expect(events.find((e) => e.type === "waypoint-failed")).toMatchObject({ index: 1, error: expect.stringContaining("JSON") });
    expect((await t.app.inject("/api/batches/" + batchId + "/sightings")).json()).toHaveLength(1);
  });
});

describe("Target Search Batch：手機錯誤與紀錄", () => {
  const body = (listId: number) => ({ listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });

  it("Teleport 失敗（找不到裝置等）：整個 Batch 標成 failed 並顯示原因，不再跑 bot，但仍 stop 恢復真實 GPS", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", () => found());
    t.device.failWith = new Error("adb: no devices/emulators found");
    const { events, batchId } = await runBatch(t.app, body(t.listId));
    expect(events.at(-1)).toEqual({ type: "finished", status: "failed", error: "adb: no devices/emulators found" });
    expect(t.bot.calls).toHaveLength(0);
    expect(t.device.log.at(-1)).toBe("stop");
    const batch = (await t.app.inject("/api/batches/" + batchId)).json();
    expect(batch).toMatchObject({ id: batchId, status: "failed", error: "adb: no devices/emulators found" });
  });

  it("每個 Waypoint 的執行結果（exit code、run 資料夾、錯誤）存進 SQLite，重開後還在", async () => {
    const t = await setup("1,1 甲" + NL + "2,2 乙", (i) =>
      i === 0 ? found(sighting()) : { exitCode: 2, stdout: "", stderr: ["中止：沒開出遊戲"], files: { "abort.txt": "沒開出遊戲" + NL } },
    );
    const { batchId } = await runBatch(t.app, body(t.listId));
    await t.app.close();
    const again = buildApp({ dataDir: dir, bot: t.bot, device: t.device, waitMs: 0 });
    apps.push(again);
    const batch = (await again.inject("/api/batches/" + batchId)).json();
    expect(batch).toMatchObject({ status: "done", error: null, listId: t.listId });
    expect(batch.runs).toMatchObject([
      { index: 1, exitCode: 0, error: null, runDir: "fake-run-001" },
      { index: 2, exitCode: 2, error: "沒開出遊戲", runDir: "fake-run-002" },
    ]);
    expect((await again.inject("/api/batches/9999")).statusCode).toBe(404);
  });

  it("Target 自動提示：回傳過去用過的名稱（最近用的在前、不重複）", async () => {
    const t = await setup("1,1 甲", () => found());
    expect((await t.app.inject("/api/targets")).json()).toEqual([]);
    await runBatch(t.app, { ...body(t.listId), targets: ["巨大 輝煌蘑菇", "一般 紅色蘑菇"] });
    await runBatch(t.app, { ...body(t.listId), targets: ["巨大 *", "一般 紅色蘑菇"] });
    expect((await t.app.inject("/api/targets")).json()).toEqual(["一般 紅色蘑菇", "巨大 *", "巨大 輝煌蘑菇"]);
  });

  it("請求不合法（沒有 Target、清單不存在、半徑不是正數）：400／404，不啟動 Batch", async () => {
    const t = await setup("1,1 甲", () => found());
    const post = (payload: object) => t.app.inject({ method: "POST", url: "/api/batches/target-search", payload });
    expect((await post({ ...body(t.listId), targets: [] })).statusCode).toBe(400);
    expect((await post({ ...body(t.listId), targets: ["  "] })).statusCode).toBe(400);
    expect((await post({ ...body(t.listId), radius: 0 })).statusCode).toBe(400);
    expect((await post({ ...body(t.listId), skipCrowded: -1 })).statusCode).toBe(400);
    expect((await post({ ...body(9999) })).statusCode).toBe(404);
    expect(t.bot.calls).toHaveLength(0);
  });
});

describe("Target Search Batch：bot 本身起不來", () => {
  it("bot 丟例外（例如找不到 python）：Batch 標成 failed 並顯示原因，仍 stop", async () => {
    const t = await setup("1,1 甲", () => {
      throw new Error("spawn python.exe ENOENT");
    });
    const { events } = await runBatch(t.app, { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
    expect(events.at(-1)).toEqual({ type: "finished", status: "failed", error: "spawn python.exe ENOENT" });
    expect(t.timeline.at(-1)).toBe("stop");
  });
});
