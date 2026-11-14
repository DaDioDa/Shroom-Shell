import { rmSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { sweepRadius, type HistoryDetail, type HistoryRow, type HistoryWaypoint, type QuietResult } from "@shell/shared";
import type { Db } from "../db/database.js";
import { listSightings } from "./store.js";

/** 這些狀態的 Batch 還在動（或馬上要動），不能刪。 */
export const BUSY_STATUSES = ["running", "queued"];

interface BatchRow {
  id: number;
  list_id: number;
  feature: string;
  params: string;
  status: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  list_name: string | null;
}
interface RunRow {
  idx: number;
  waypoint_id: number;
  exit_code: number | null;
  result_json: string | null;
  run_dir: string | null;
  error: string | null;
  wp_label: string | null;
  wp_lat: number | null;
  wp_lng: number | null;
  wp_radius: number | null;
}

const SELECT_BATCH = `SELECT b.*, l.name AS list_name FROM batches b LEFT JOIN waypoint_lists l ON l.id = b.list_id`;

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
      `SELECT r.idx, r.waypoint_id, r.exit_code, r.result_json, r.run_dir, r.error,
              w.label AS wp_label, w.lat AS wp_lat, w.lng AS wp_lng, w.radius AS wp_radius
       FROM waypoint_runs r LEFT JOIN waypoints w ON w.id = r.waypoint_id
       WHERE r.batch_id = ? ORDER BY r.idx`,
    )
    .all(batchId) as unknown as RunRow[];
}

function summarize(db: Db, b: BatchRow): string {
  const runs = loadRuns(db, b.id);
  const total = (db.prepare("SELECT COUNT(*) AS n FROM waypoint_runs WHERE batch_id = ?").get(b.id) as { n: number }).n;
  if (b.feature === "quiet-search") {
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
    // result_json 是 QuietResult 加上這點用的半徑；舊資料沒有半徑就退回 Waypoint 目前的半徑或 Batch 預設。
    const stored = b.feature === "quiet-search" ? parseJson<QuietResult & { radius?: number }>(r.result_json) : null;
    const { radius: storedRadius, ...result } = stored ?? ({} as QuietResult & { radius?: number });
    const radius = storedRadius ?? sweepRadius({ radius: r.wp_radius }, params?.radius ?? 0);
    return {
      index: r.idx,
      waypointId: r.waypoint_id,
      label: r.wp_label || (r.wp_lat === null ? "（已刪除的 Waypoint）" : `${r.wp_lat}, ${r.wp_lng}`),
      exitCode: r.exit_code,
      error: r.error,
      runDir: r.run_dir,
      sightings: sightings.filter((s) => s.waypointId === r.waypoint_id),
      quiet: stored ? { radius, result: result as QuietResult } : null,
    };
  });
  return { ...toRow(db, b), params, waypoints };
}

export type DeleteOutcome = "deleted" | "not-found" | "busy";

/** run 資料夾名稱只認單一路徑段，而且解析後必須真的在 runsDir 底下。 */
export function safeRunPath(runsDir: string, name: string | null): string | null {
  if (!name || name === "." || name === ".." || basename(name) !== name || name.includes("/") || name.includes("\\")) return null;
  const root = resolve(runsDir);
  const full = resolve(join(root, name));
  return full.startsWith(root + sep) ? full : null;
}

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
