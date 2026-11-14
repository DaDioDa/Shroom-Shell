import type { BatchEvent, BatchStatus, QuietResult, StoredSighting } from "./types.js";

/** Quiet Giant Search 一個 Waypoint 的結果（供地圖畫正方形與結果卡片）。 */
export interface QuietOutcome {
  index: number;
  waypointId: number;
  radius: number;
  result: QuietResult;
}

export interface BatchView {
  batchId: number | null;
  status: BatchStatus | "idle";
  total: number;
  /** 目前是第幾個 Waypoint（從 1 起算）。 */
  index: number;
  label: string;
  stderr: string[];
  sightings: StoredSighting[];
  failures: { index: number; error: string }[];
  quietResults: QuietOutcome[];
  error: string | null;
}

export const initialBatchView: BatchView = {
  batchId: null,
  status: "idle",
  total: 0,
  index: 0,
  label: "",
  stderr: [],
  sightings: [],
  failures: [],
  quietResults: [],
  error: null,
};

export function reduceBatchView(v: BatchView, e: BatchEvent): BatchView {
  switch (e.type) {
    case "started":
      return { ...initialBatchView, batchId: e.batchId, status: "running", total: e.total };
    case "progress":
      return { ...v, index: e.index, total: e.total, label: e.label };
    case "stderr":
      return { ...v, stderr: [...v.stderr, e.line] };
    case "sighting":
      return { ...v, sightings: [...v.sightings, e.sighting] };
    case "waypoint-failed":
      return { ...v, failures: [...v.failures, { index: e.index, error: e.error }] };
    case "quiet-result":
      return { ...v, quietResults: [...v.quietResults, { index: e.index, waypointId: e.waypointId, radius: e.radius, result: e.result }] };
    case "finished":
      return { ...v, status: e.status, error: e.error ?? null };
  }
}
