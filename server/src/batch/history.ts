import { rmSync } from "node:fs";
import { sweepRadius, type HistoryDetail, type HistoryRow, type BatchPoint, type HistoryWaypoint, type CheckResult, type QuietResult } from "@shell/shared";
import type { Db } from "../db/database.js";
import { safeRunPath } from "./runPath.js";
import { listSightings } from "./store.js";
import { toOutcome } from "./postcardCheck.js";
import { abortShotUrl } from "./runBatch.js";

export { safeRunPath };

/** 這些狀態的 Batch 還在動（或馬上要動），不能刪。 */
const isQuiet = (feature: string) => feature === "quiet-search" || feature === "discovery";

export const BUSY_STATUSES = ["running", "queued"];

interface BatchRow {
  id: number;
  list_id: number | null;
  feature: string;
  params: string;
  status: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  list_name: string | null;
  images_cleared: number;
}
interface RunRow {
  idx: number;
  waypoint_id: number | null;
  lat: number;
  lng: number;
  label: string;
  radius: number | null;
  exit_code: number | null;
  result_json: string | null;
  run_dir: string | null;
  error: string | null;
}

const SELECT_BATCH = `SELECT b.*, COALESCE(l.name, b.list_name) AS list_name FROM batches b LEFT JOIN waypoint_lists l ON l.id = b.list_id`;

function parseJson<T>(text: string | null): T | null {
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function loadRuns(db: Db, batchId: number): RunRow[] {
  return db
    .prepare(
      `SELECT idx, waypoint_id, lat, lng, label, radius, exit_code, result_json, run_dir, error
       FROM waypoint_runs WHERE batch_id = ? ORDER BY idx`,
    )
    .all(batchId) as unknown as RunRow[];
}

function summarize(db: Db, b: BatchRow): string {
  const runs = loadRuns(db, b.id);
  const total = (db.prepare("SELECT COUNT(*) AS n FROM waypoint_runs WHERE batch_id = ?").get(b.id) as { n: number }).n;
  if (b.feature === "postcard-check") {
    const c = { found: 0, missing: 0, unfinished: 0 };
    for (const r of runs) {
      const f = parseJson<CheckResult>(r.result_json)?.found;
      c[f === true ? "found" : f === false ? "missing" : "unfinished"]++;
    }
    return `${total} 個 Waypoint：找到 ${c.found}、沒找到 ${c.missing}、沒讀完 ${c.unfinished}`;
  }
  if (isQuiet(b.feature)) {
    const counts = { yes: 0, no: 0, unknown: 0 };
    for (const r of runs) {
      const v = parseJson<QuietResult>(r.result_json)?.verdict;
      counts[v === true ? "yes" : v === false ? "no" : "unknown"]++;
    }
    return `${total} 個 Waypoint：是 ${counts.yes}、不是 ${counts.no}、無法判斷 ${counts.unknown}`;
  }
  const n = (db.prepare("SELECT COUNT(*) AS n FROM sightings WHERE batch_id = ?").get(b.id) as { n: number }).n;
  return `${total} 個 Waypoint，找到 ${n} 筆 Sighting`;
}

const toRow = (db: Db, b: BatchRow): HistoryRow => ({
  id: b.id,
  feature: b.feature,
  listId: b.list_id,
  listName: b.list_name,
  status: b.status,
  error: b.error,
  createdAt: b.created_at,
  finishedAt: b.finished_at,
  summary: summarize(db, b),
  imagesCleared: b.images_cleared === 1,
});

/** 所有功能的 Batch，新的在前。 */
export function listHistory(db: Db): HistoryRow[] {
  const rows = db.prepare(`${SELECT_BATCH} ORDER BY b.id DESC`).all() as unknown as BatchRow[];
  return rows.map((b) => toRow(db, b));
}

export function getHistory(db: Db, id: number, runsDir: string): HistoryDetail | null {
  const b = db.prepare(`${SELECT_BATCH} WHERE b.id = ?`).get(id) as unknown as BatchRow | undefined;
  if (!b) return null;
  const params = parseJson<{ radius?: number }>(b.params);
  const sightings = listSightings(db, id, runsDir);
  const waypoints = loadRuns(db, id).map((r): HistoryWaypoint => {
    // 位置、標籤、半徑都是執行當時記下的（waypoint_runs），不回查 waypoints 表。
    const point: BatchPoint = { lat: r.lat, lng: r.lng, label: r.label, radius: r.radius, waypointId: r.waypoint_id };
    // result_json 是 QuietResult 加上這點實際用的半徑（點沒有半徑時用 Batch 預設）。
    const stored = isQuiet(b.feature) ? parseJson<QuietResult & { radius?: number }>(r.result_json) : null;
    const { radius: storedRadius, ...result } = stored ?? ({} as QuietResult & { radius?: number });
    const radius = storedRadius ?? sweepRadius({ radius: r.radius }, params?.radius ?? 0);
    const checkResult = b.feature === "postcard-check" ? parseJson<CheckResult>(r.result_json) : null;
    const abortUrl = abortShotUrl(runsDir, r.run_dir);
    return {
      index: r.idx,
      waypointId: r.waypoint_id,
      point,
      label: r.label || `${r.lat}, ${r.lng}`,
      exitCode: r.exit_code,
      error: r.error,
      runDir: r.run_dir,
      abortUrl,
      sightings: sightings.filter((s) => s.waypointId === r.waypoint_id),
      check: b.feature === "postcard-check" && checkResult ? toOutcome(runsDir, r.run_dir, r.idx, point, checkResult, abortUrl, b.images_cleared === 1) : null,
      quiet: stored ? { radius, result: result as QuietResult } : null,
    };
  });
  return { ...toRow(db, b), params, waypoints };
}

export type DeleteOutcome = "deleted" | "not-found" | "busy";

/** 刪 Batch：run 資料夾（只刪 runsDir 底下的）與 DB 紀錄。執行中或排隊中的不刪。 */
export function deleteBatch(db: Db, id: number, runsDir: string): DeleteOutcome {
  const b = db.prepare("SELECT status FROM batches WHERE id = ?").get(id) as { status: string } | undefined;
  if (!b) return "not-found";
  if (BUSY_STATUSES.includes(b.status)) return "busy";
  const names = db
    .prepare("SELECT run_dir FROM waypoint_runs WHERE batch_id = ? UNION SELECT run_dir FROM sightings WHERE batch_id = ?")
    .all(id, id) as unknown as { run_dir: string | null }[];
  // 先刪資料夾：失敗時 DB 還在，可以重試；反過來會留下沒人記得的資料夾。
  for (const { run_dir } of names) {
    const path = safeRunPath(runsDir, run_dir);
    if (path) rmSync(path, { recursive: true, force: true });
  }
  db.prepare("DELETE FROM batches WHERE id = ?").run(id); // waypoint_runs、sightings 由 ON DELETE CASCADE 帶走
  return "deleted";
}
