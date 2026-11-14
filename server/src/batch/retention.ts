import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../db/database.js";
import { safeRunPath } from "./runPath.js";

export const DEFAULT_RUNS_LIMIT_BYTES = 1024 ** 3;

const LIMIT_KEY = "runs_limit_bytes";

/** 設定裡的上限；沒設過就用 fallback。 */
export function getRunsLimit(db: Db, fallback: number): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(LIMIT_KEY) as { value: string } | undefined;
  const n = Number(row?.value);
  return row && n > 0 ? n : fallback;
}

export function setRunsLimit(db: Db, bytes: number): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(LIMIT_KEY, String(bytes));
}

/** 資料夾（含子層）的總位元組數；不存在就是 0。 */
export function dirSize(path: string): number {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.size;
  return readdirSync(path).reduce((sum, name) => sum + dirSize(join(path, name)), 0);
}

/**
 * run 資料夾總量超過 limitBytes 時，從最舊的 Batch 開始刪它的 run 資料夾，直到低於上限。
 * 只刪資料夾；SQLite 的文字結果保留，Batch 標記 images_cleared。
 * 執行中／排隊中的 Batch（busyBatchIds 或 DB 狀態）不刪。回傳被清掉圖片的 Batch id（由舊到新）。
 */
export function enforceRunsLimit(opts: { db: Db; runsDir: string; limitBytes: number; busyBatchIds: ReadonlySet<number> }): number[] {
  const { db, runsDir, limitBytes, busyBatchIds } = opts;
  let total = dirSize(runsDir);
  if (total <= limitBytes) return [];
  const batches = db
    .prepare("SELECT id FROM batches WHERE images_cleared = 0 AND status NOT IN ('running', 'queued') ORDER BY id")
    .all() as unknown as { id: number }[];
  const names = db.prepare("SELECT run_dir FROM waypoint_runs WHERE batch_id = ? UNION SELECT run_dir FROM sightings WHERE batch_id = ?");
  const cleared: number[] = [];
  for (const { id } of batches) {
    if (total <= limitBytes) break;
    if (busyBatchIds.has(id)) continue;
    const dirs = (names.all(id, id) as unknown as { run_dir: string | null }[]).flatMap(({ run_dir }) => {
      const path = safeRunPath(runsDir, run_dir);
      return path ? [path] : [];
    });
    for (const path of new Set(dirs)) {
      total -= dirSize(path);
      rmSync(path, { recursive: true, force: true });
    }
    db.prepare("UPDATE batches SET images_cleared = 1 WHERE id = ?").run(id);
    cleared.push(id);
  }
  return cleared;
}
