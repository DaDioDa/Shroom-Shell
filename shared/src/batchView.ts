import type { CheckOutcome } from "./postcardCheck.js";
import type { BatchEvent, BatchPoint, BatchStatus, QuietResult, StoredSighting } from "./types.js";

/** Quiet Giant Search 一個 Waypoint 的結果（供地圖畫正方形與結果卡片）。 */
export interface QuietOutcome {
  index: number;
  waypointId: number | null;
  /** 執行當時的點（畫 Sweep 方格用，不回查目前清單）。 */
  point: BatchPoint;
  radius: number;
  result: QuietResult;
  /** 這點中止時的 abort.png 網址。 */
  screenshotUrl?: string;
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
  failures: { index: number; error: string; screenshotUrl?: string }[];
  quietResults: QuietOutcome[];
  checkResults: CheckOutcome[];
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
  quietResults: [],
  checkResults: [],
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
    case "quiet-result":
      return { ...v, quietResults: [...v.quietResults, { index: e.index, waypointId: e.waypointId, point: e.point, radius: e.radius, result: e.result, ...(e.screenshotUrl ? { screenshotUrl: e.screenshotUrl } : {}) }] };
    case "check-result":
      return { ...v, checkResults: [...v.checkResults, e.outcome] };
    case "finished":
      return { ...v, status: e.status, error: e.error ?? null };
  }
}

/** 三個功能分頁共用的狀態文字（queued、running、done、cancelled、failed 都要正確）。 */
export function batchStatusText(v: BatchView, found?: number): string {
  const hits = found === undefined ? "" : `，找到 ${found} 筆`;
  switch (v.status) {
    case "queued":
      return `排隊中：前面還有 ${v.queuePosition ?? 1} 個 Batch，輪到才會開始`;
    case "running":
      return `進度：第 ${v.index} / ${v.total} 個 Waypoint${v.label ? `（${v.label}）` : ""}`;
    case "done":
      return `完成：共 ${v.total} 個 Waypoint${hits}`;
    case "cancelled":
      return `已取消：跑了 ${v.index} / ${v.total} 個 Waypoint${hits}${v.error ? `。${v.error}` : ""}`;
    case "failed":
      return `失敗：${v.error ?? "未知錯誤"}`;
    default:
      return "";
  }
}
