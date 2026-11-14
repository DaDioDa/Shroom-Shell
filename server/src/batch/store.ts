import type { BatchStatus, BotSighting, StoredSighting } from "@shell/shared";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { Db } from "../db/database.js";

interface SightingRow {
  id: number;
  batch_id: number;
  waypoint_id: number;
  target: string;
  lat: number;
  lng: number;
  spot_name: string;
  participant_count: number | null;
  remaining_seconds: number | null;
  observed_at: string;
  map_x: number | null;
  map_y: number | null;
  frame: string | null;
  postcard: string | null;
  run_dir: string | null;
  images_cleared: number;
}

/** run 資料夾裡有這個檔才給網址（檔案被清掉或 bot 沒截到就是 null）。 */
function runFileUrl(runsDir: string, runDir: string | null, file: string | null): string | null {
  if (!runDir || !file) return null;
  const name = basename(file); // bot 的欄位是檔名；保險起見絕對路徑也只取檔名
  return existsSync(join(runsDir, runDir, name)) ? `/api/runs/${runDir}/${name}` : null;
}

const toStored = (r: SightingRow, runsDir: string): StoredSighting => ({
  id: r.id,
  batchId: r.batch_id,
  waypointId: r.waypoint_id,
  target: r.target,
  lat: r.lat,
  lng: r.lng,
  spot_name: r.spot_name,
  participant_count: r.participant_count,
  remaining_seconds: r.remaining_seconds,
  observed_at: r.observed_at,
  map_position: [r.map_x ?? 0, r.map_y ?? 0],
  frame: r.frame,
  postcard: r.postcard,
  frameUrl: runFileUrl(runsDir, r.run_dir, r.frame),
  postcardUrl: runFileUrl(runsDir, r.run_dir, r.postcard),
  imagesCleared: r.images_cleared === 1,
});

const SELECT_SIGHTING = "SELECT s.*, b.images_cleared FROM sightings s JOIN batches b ON b.id = s.batch_id";

export function createBatch(db: Db, feature: string, params: { listId: number }, status: BatchStatus = "queued"): number {
  const r = db
    .prepare("INSERT INTO batches (list_id, feature, params, status, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(params.listId, feature, JSON.stringify(params), status, new Date().toISOString());
  return Number(r.lastInsertRowid);
}

export function saveSighting(
  db: Db,
  batchId: number,
  waypointId: number,
  s: BotSighting,
  runDir: string | null,
  runsDir: string,
): StoredSighting {
  const r = db
    .prepare(
      `INSERT INTO sightings (batch_id, waypoint_id, target, lat, lng, spot_name, participant_count,
         remaining_seconds, observed_at, map_x, map_y, frame, postcard, run_dir)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      batchId, waypointId, s.target, s.lat, s.lng, s.spot_name, s.participant_count, s.remaining_seconds,
      s.observed_at, s.map_position[0], s.map_position[1], s.frame, s.postcard, runDir,
    );
  return getSighting(db, Number(r.lastInsertRowid), runsDir);
}

export function getSighting(db: Db, id: number, runsDir: string): StoredSighting {
  return toStored(db.prepare(`${SELECT_SIGHTING} WHERE s.id = ?`).get(id) as unknown as SightingRow, runsDir);
}

export function listSightings(db: Db, batchId: number, runsDir: string): StoredSighting[] {
  const rows = db.prepare(`${SELECT_SIGHTING} WHERE s.batch_id = ? ORDER BY s.id`).all(batchId) as unknown as SightingRow[];
  return rows.map((r) => toStored(r, runsDir));
}

/** 所有 Batch 的 Sighting（地圖用，新的在前）。 */
export function listAllSightings(db: Db, runsDir: string): StoredSighting[] {
  const rows = db.prepare(`${SELECT_SIGHTING} ORDER BY s.id DESC`).all() as unknown as SightingRow[];
  return rows.map((r) => toStored(r, runsDir));
}

export function rememberTargets(db: Db, targets: string[]): void {
  const now = new Date().toISOString();
  const up = db.prepare(
    "INSERT INTO target_names (name, last_used) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET last_used = excluded.last_used",
  );
  for (const t of targets) up.run(t, now);
}

/** 過去用過的 Target 名稱，最近用的在前。 */
export function listTargets(db: Db): string[] {
  const rows = db.prepare("SELECT name FROM target_names ORDER BY last_used DESC, name").all() as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

export function saveWaypointRun(
  db: Db,
  run: { batchId: number; waypointId: number; index: number; exitCode: number | null; result: unknown; runDir: string | null; error: string | null; durationMs?: number | null },
): void {
  db.prepare(
    "INSERT INTO waypoint_runs (batch_id, waypoint_id, idx, exit_code, result_json, run_dir, error, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(run.batchId, run.waypointId, run.index, run.exitCode, JSON.stringify(run.result), run.runDir, run.error, run.durationMs ?? null);
}

export function setBatchStatus(db: Db, batchId: number, status: BatchStatus): void {
  db.prepare("UPDATE batches SET status = ? WHERE id = ?").run(status, batchId);
}

export function finishBatch(db: Db, batchId: number, status: BatchStatus, error: string | null): void {
  db.prepare("UPDATE batches SET status = ?, error = ?, finished_at = ? WHERE id = ?").run(
    status, error, new Date().toISOString(), batchId,
  );
}

export interface BatchRecord {
  id: number;
  listId: number;
  feature: string;
  params: unknown;
  status: string;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  runs: { index: number; waypointId: number; exitCode: number | null; runDir: string | null; error: string | null }[];
}

export function getBatch(db: Db, id: number): BatchRecord | null {
  const b = db.prepare("SELECT * FROM batches WHERE id = ?").get(id) as
    | { id: number; list_id: number; feature: string; params: string; status: string; error: string | null; created_at: string; finished_at: string | null }
    | undefined;
  if (!b) return null;
  const runs = db.prepare("SELECT * FROM waypoint_runs WHERE batch_id = ? ORDER BY idx").all(id) as unknown as {
    idx: number; waypoint_id: number; exit_code: number | null; run_dir: string | null; error: string | null;
  }[];
  return {
    id: b.id,
    listId: b.list_id,
    feature: b.feature,
    params: JSON.parse(b.params),
    status: b.status,
    error: b.error,
    createdAt: b.created_at,
    finishedAt: b.finished_at,
    runs: runs.map((r) => ({ index: r.idx, waypointId: r.waypoint_id, exitCode: r.exit_code, runDir: r.run_dir, error: r.error })),
  };
}

/** 過去 quiet（Quiet Giant Search 與 Discovery）每點的平均耗時；沒有紀錄就是 null。被強制停止的點不算。 */
export function quietAverageMs(db: Db): number | null {
  const r = db
    .prepare(
      `SELECT AVG(r.duration_ms) AS avg FROM waypoint_runs r JOIN batches b ON b.id = r.batch_id
       WHERE b.feature IN ('quiet-search', 'discovery') AND r.duration_ms IS NOT NULL AND r.exit_code IS NOT NULL`,
    )
    .get() as { avg: number | null };
  return r.avg === null ? null : Math.round(r.avg);
}
