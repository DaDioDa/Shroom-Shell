import type { BatchEvent, BatchStatus, StoredSighting } from "./types.js";

export interface BatchView {
  batchId: number | null;
  status: BatchStatus | "idle";
  total: number;
  /** 目前是第幾個 Waypoint（從 1 起算）。 */
  index: number;
  label: string;
  stderr: string[];
  sightings: StoredSighting[];
  failures: { index: number; error: string; screenshotUrl?: string }[];
  error: string | null;
  /** 排隊中時，前面還有幾個要等（1＝下一個就輪到）。 */
  queuePosition: number | null;
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
  error: null,
  queuePosition: null,
};

export function reduceBatchView(v: BatchView, e: BatchEvent): BatchView {
  switch (e.type) {
    case "queued":
      return { ...initialBatchView, batchId: e.batchId, status: "queued", queuePosition: e.position };
    case "started":
      return { ...initialBatchView, batchId: e.batchId, status: "running", total: e.total };
    case "progress":
      return { ...v, index: e.index, total: e.total, label: e.label };
    case "stderr":
      return { ...v, stderr: [...v.stderr, e.line] };
    case "sighting":
      return { ...v, sightings: [...v.sightings, e.sighting] };
    case "waypoint-failed":
      return {
        ...v,
        failures: [...v.failures, { index: e.index, error: e.error, ...(e.screenshotUrl ? { screenshotUrl: e.screenshotUrl } : {}) }],
      };
    case "finished":
      return { ...v, status: e.status, error: e.error ?? null };
  }
}
