import { describe, expect, it } from "vitest";
import type { BatchEvent, StoredSighting } from "./types.js";
import { batchStatusText, initialBatchView, reduceBatchView, type BatchView } from "./batchView.js";

const sighting = { id: 1, target: "巨大 *" } as StoredSighting;
const run = (events: BatchEvent[]) => events.reduce(reduceBatchView, initialBatchView);

describe("reduceBatchView", () => {
  it("started / progress 記下進度", () => {
    const v = run([
      { type: "started", batchId: 7, total: 3 },
      { type: "progress", index: 2, total: 3, waypointId: 5, label: "乙" },
    ]);
    expect(v).toMatchObject({ batchId: 7, status: "running", total: 3, index: 2, label: "乙" });
  });

  it("stderr 逐行累積、sighting 累積成卡片、失敗的 Waypoint 留下原因", () => {
    const v = run([
      { type: "started", batchId: 1, total: 2 },
      { type: "stderr", index: 1, line: "第一行" },
      { type: "stderr", index: 1, line: "第二行" },
      { type: "sighting", sighting },
      { type: "waypoint-failed", index: 2, error: "bad target" },
    ]);
    expect(v.stderr).toEqual(["第一行", "第二行"]);
    expect(v.sightings).toEqual([sighting]);
    expect(v.failures).toEqual([{ index: 2, error: "bad target" }]);
  });

  it("quiet-result 依序累積（地圖正方形與結果卡片的來源）；新的 started 會清掉", () => {
    const result = { quiet_area: false, verdict: false, reason: "有人在打", giants: [], claimed: { cell: 3, participant_count: null }, unread: 1 };
    const events: BatchEvent[] = [
      { type: "started", batchId: 1, total: 1 },
      { type: "quiet-result", index: 1, waypointId: 9, point: { lat: 1, lng: 2, label: "甲", radius: 250, waypointId: 9 }, radius: 250, result },
    ];
    expect(run(events).quietResults).toEqual([{ index: 1, waypointId: 9, point: { lat: 1, lng: 2, label: "甲", radius: 250, waypointId: 9 }, radius: 250, result }]);
    expect(run([...events, { type: "started", batchId: 2, total: 1 }]).quietResults).toEqual([]);
  });

  it("finished 帶出狀態與錯誤；新的 started 會清掉上一輪", () => {
    const done = run([
      { type: "started", batchId: 1, total: 1 },
      { type: "stderr", index: 1, line: "x" },
      { type: "finished", status: "failed", error: "沒有裝置" },
    ]);
    expect(done).toMatchObject({ status: "failed", error: "沒有裝置" });
    const next = reduceBatchView(done, { type: "started", batchId: 2, total: 5 });
    expect(next).toMatchObject({ batchId: 2, status: "running", total: 5, stderr: [], sightings: [], error: null });
  });

  it("queued：排隊中、記下順位；輪到時 started 變 running", () => {
    const q = run([{ type: "queued", batchId: 4, position: 2 }]);
    expect(q).toMatchObject({ batchId: 4, status: "queued", queuePosition: 2 });
    expect(reduceBatchView(q, { type: "started", batchId: 4, total: 3 })).toMatchObject({ status: "running", queuePosition: null });
  });

  it("waypoint-failed 帶截圖網址；cancelled 是一種結束", () => {
    const v = run([
      { type: "started", batchId: 1, total: 2 },
      { type: "waypoint-failed", index: 1, error: "遊戲沒有回應", screenshotUrl: "/api/runs/r/abort.png" },
      { type: "finished", status: "cancelled" },
    ]);
    expect(v.failures).toEqual([{ index: 1, error: "遊戲沒有回應", screenshotUrl: "/api/runs/r/abort.png" }]);
    expect(v.status).toBe("cancelled");
  });
});

describe("batchStatusText（三個功能分頁共用）", () => {
  const v = (over: Partial<BatchView>): BatchView => ({ ...initialBatchView, ...over });
  it("queued：排隊中，不是「失敗：null」", () => {
    expect(batchStatusText(v({ status: "queued", queuePosition: 2 }))).toBe("排隊中：前面還有 2 個 Batch，輪到才會開始");
  });
  it("cancelled：已取消，不是「失敗：null」", () => {
    const t = batchStatusText(v({ status: "cancelled", index: 1, total: 3 }));
    expect(t).toContain("已取消");
    expect(t).not.toContain("null");
  });
  it("running／done／failed", () => {
    expect(batchStatusText(v({ status: "running", index: 1, total: 3, label: "甲" }))).toBe("進度：第 1 / 3 個 Waypoint（甲）");
    expect(batchStatusText(v({ status: "done", total: 3 }))).toBe("完成：共 3 個 Waypoint");
    expect(batchStatusText(v({ status: "failed", error: "壞了" }))).toBe("失敗：壞了");
  });
});
