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
      name TEXT NOT NULL
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
  // 舊資料庫沒有 spot_name：CREATE TABLE IF NOT EXISTS 不會補欄位，要自己 ALTER。
  const cols = db.prepare("PRAGMA table_info(waypoints)").all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "spot_name")) db.exec("ALTER TABLE waypoints ADD COLUMN spot_name TEXT");
  return db;
}
