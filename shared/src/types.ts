import type { CheckOutcome } from "./postcardCheck.js";

/** Waypoint List 所屬的功能：建立時決定，之後不能改。 */
export const LIST_FEATURES = ["postcard-check", "quiet-search", "target-search"] as const;
export type ListFeature = (typeof LIST_FEATURES)[number];
export const isListFeature = (v: unknown): v is ListFeature => (LIST_FEATURES as readonly unknown[]).includes(v);

export interface WaypointList {
  id: number;
  name: string;
  feature: ListFeature;
  waypointCount: number;
}

export interface Waypoint {
  id: number;
  listId: number;
  position: number;
  lat: number;
  lng: number;
  label: string;
  radius: number | null;
  /** 遊戲內 Spot 的名稱（ticket 05 Postcard Check 會用）。 */
  spotName: string | null;
}

export interface ImportLineError {
  line: number;
  text: string;
  reason: string;
}

export interface ImportResult {
  imported: Waypoint[];
  errors: ImportLineError[];
}

/** bot `hunt` stdout 的一筆 Sighting（格式見 pikmin_bloom_bot 的 cli.md）。 */
export interface BotSighting {
  target: string;
  lat: number;
  lng: number;
  spot_name: string;
  /** 0 = 無人（Unclaimed Mushroom），null = 讀不到。 */
  participant_count: number | null;
  /** null = 尚未開始倒數。 */
  remaining_seconds: number | null;
  /** 含時區的 ISO 8601。 */
  observed_at: string;
  map_position: [number, number];
  /** run 資料夾內的檔名。 */
  frame: string | null;
  postcard: string | null;
}

/** 存進 SQLite、由後端提供給網頁的 Sighting。 */
export interface StoredSighting extends BotSighting {
  id: number;
  batchId: number;
  waypointId: number;
  /** 後端提供的截圖網址；run 資料夾裡沒有該檔就是 null。 */
  frameUrl: string | null;
  postcardUrl: string | null;
  /** 所屬 Batch 的 run 資料夾已因超過上限被清掉（圖片不在了，文字結果還在）。 */
  imagesCleared: boolean;
}

/** queued＝排隊中；cancelled＝被取消（排隊時移出、跑完這點就停、強制停止）。 */
export type BatchStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** 取消方式：after-waypoint＝跑完目前這點就停；force＝立刻 kill bot。 */
export type CancelMode = "after-waypoint" | "force";

export interface QueueItem {
  batchId: number;
  feature: string;
  listId: number;
  listName: string;
}

export interface QueueSnapshot {
  running: QueueItem | null;
  queued: QueueItem[];
}

export interface TargetSearchParams {
  listId: number;
  targets: string[];
  /** Waypoint 沒有自己的半徑時用這個（公尺）。 */
  radius: number;
  /** 0 = 不略過。 */
  skipCrowded: number;
}

/** Batch 進行中經 SSE 推給網頁的事件。 */
export type BatchEvent =
  | { type: "queued"; batchId: number; position: number }
  | { type: "started"; batchId: number; total: number }
  | { type: "progress"; index: number; total: number; waypointId: number; label: string }
  | { type: "stderr"; index: number; line: string }
  | { type: "sighting"; sighting: StoredSighting }
  | { type: "waypoint-failed"; index: number; error: string; screenshotUrl?: string }
  /** Quiet Giant Search：一個 Waypoint 的答案。radius 是這點實際用的半徑（公尺）。 */
  | { type: "quiet-result"; index: number; waypointId: number; radius: number; result: QuietResult; screenshotUrl?: string }
  /** Postcard Check：一個 Waypoint 的答案。 */
  | { type: "check-result"; outcome: CheckOutcome }
  | { type: "finished"; status: BatchStatus; error?: string };

/** bot `quiet` stdout 最後一行的答案（格式見 pikmin_bloom_bot 的 cli.md）。 */
export interface QuietResult {
  /** true＝沒人在打；false＝有人在打；null＝中止。 */
  quiet_area: boolean | null;
  /** true＝沒人在打且有巨菇；false＝有人在打或沒有巨菇；null＝無法判斷。 */
  verdict: boolean | null;
  reason: string;
  giants: BotSighting[];
  /** 觸發 false 的那顆有人打的蘑菇；cell 從 0 起算，人數讀不到為 null。 */
  claimed: { cell: number; participant_count: number | null } | null;
  /** 讀不到名稱的蘑菇數，不影響答案。 */
  unread: number;
}

export interface QuietSearchParams {
  listId: number;
  /** Waypoint 沒有自己的半徑時用這個（公尺）。 */
  radius: number;
}

/** 歷史頁列表的一列（所有功能的 Batch）。 */
export interface HistoryRow {
  id: number;
  feature: string;
  /** 清單被刪掉後是 null；listName 仍是刪除前的名稱。 */
  listId: number | null;
  listName: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  summary: string;
  /** run 資料夾已清除，只剩文字結果。 */
  imagesCleared: boolean;
}

/** 可在設定調整的項目。 */
export interface Settings {
  /** run 資料夾總量上限（bytes）。 */
  runsLimitBytes: number;
}

/** 歷史頁裡一個 Waypoint 的結果。quiet 只有 Quiet Giant Search 的 Batch 才有。 */
export interface HistoryWaypoint {
  index: number;
  waypointId: number;
  label: string;
  exitCode: number | null;
  error: string | null;
  runDir: string | null;
  /** 這點中止時的 abort.png 網址（run 資料夾還在、有這個檔才有）。 */
  abortUrl: string | null;
  sightings: StoredSighting[];
  quiet: { radius: number; result: QuietResult } | null;
  /** 只有 Postcard Check 的 Batch 才有。 */
  check: CheckOutcome | null;
}

export interface HistoryDetail extends HistoryRow {
  params: unknown;
  waypoints: HistoryWaypoint[];
}
