import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

/** 開啟（必要時建立）dataDir 下的 SQLite。dataDir 傳 ":memory:" 則用記憶體資料庫。 */
export function openDb(dataDir: string): Db {
  let file = ":memory:";
  if (dataDir !== ":memory:") {
    mkdirSync(dataDir, { recursive: true });
    file = join(dataDir, "app.db");
  }
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS waypoint_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      feature TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS waypoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES waypoint_lists(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      radius REAL,
      spot_name TEXT
    );
  `);
  // 之後新增的表。不做舊資料遷移：表的結構一律以這裡為準（舊的 data/app.db 要清掉重來）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER REFERENCES waypoint_lists(id) ON DELETE SET NULL,
      list_name TEXT,
      feature TEXT NOT NULL,
      params TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT,
      images_cleared INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS waypoint_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      waypoint_id INTEGER,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      radius REAL,
      idx INTEGER NOT NULL,
      exit_code INTEGER,
      result_json TEXT,
      run_dir TEXT,
      error TEXT,
      duration_ms INTEGER
    );
    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      waypoint_id INTEGER,
      target TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      spot_name TEXT NOT NULL,
      participant_count INTEGER,
      remaining_seconds INTEGER,
      observed_at TEXT NOT NULL,
      map_x INTEGER,
      map_y INTEGER,
      frame TEXT,
      postcard TEXT,
      run_dir TEXT,
      run_idx INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS target_names (
      name TEXT PRIMARY KEY,
      last_used TEXT NOT NULL
    );
  `);
  return db;
}
