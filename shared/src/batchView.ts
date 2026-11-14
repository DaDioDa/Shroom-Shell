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
  failures: { index: number; error: string }[];
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
    case "finished":
      return { ...v, status: e.status, error: e.error ?? null };
  }
}
