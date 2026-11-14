import { describe, expect, it } from "vitest";
import type { BatchEvent, StoredSighting } from "./types.js";
import { initialBatchView, reduceBatchView } from "./batchView.js";

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
      { type: "quiet-result", index: 1, waypointId: 9, radius: 250, result },
    ];
    expect(run(events).quietResults).toEqual([{ index: 1, waypointId: 9, radius: 250, result }]);
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
});
