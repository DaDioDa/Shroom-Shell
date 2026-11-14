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
  // 之後新增的表。既有的 data/app.db 開起來時補上；已存在的表若要加欄位，用 ensureColumn。
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
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS waypoint_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      waypoint_id INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      exit_code INTEGER,
      result_json TEXT,
      run_dir TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS sightings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      waypoint_id INTEGER NOT NULL,
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
      run_dir TEXT
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
  // 舊資料庫沒有 spot_name：CREATE TABLE IF NOT EXISTS 不會補欄位，要自己 ALTER。
  ensureColumn(db, "waypoints", "spot_name", "TEXT");
  // 圖片已清除（run 資料夾因超過上限被刪）：0／1。
  ensureColumn(db, "batches", "images_cleared", "INTEGER NOT NULL DEFAULT 0");
  migrateBatchesKeepHistory(db);
  // 每點實測耗時（毫秒，含 Teleport 與等待），Discovery 用它估時間。
  ensureColumn(db, "waypoint_runs", "duration_ms", "INTEGER");
  return db;
}

/** 既有資料庫的表缺欄位時補上（`CREATE TABLE IF NOT EXISTS` 不會改已存在的表）。 */
export function ensureColumn(db: Db, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

/**
 * 舊版 batches.list_id 是 NOT NULL ＋ ON DELETE CASCADE（刪清單會帶走 Batch 歷史），且沒有清單名稱快照。
 * SQLite 不能直接改外鍵，所以重建表並保留資料；重建期間要關外鍵，否則 DROP 會連帶刪掉 waypoint_runs、sightings。
 */
function migrateBatchesKeepHistory(db: Db): void {
  const cols = db.prepare("PRAGMA table_info(batches)").all() as unknown as { name: string }[];
  const fks = db.prepare("PRAGMA foreign_key_list(batches)").all() as unknown as { table: string; on_delete: string }[];
  const listFk = fks.find((f) => f.table === "waypoint_lists");
  if (cols.some((c) => c.name === "list_name") && listFk?.on_delete === "SET NULL") return;
  ensureColumn(db, "batches", "images_cleared", "INTEGER NOT NULL DEFAULT 0");
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE batches_new (
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
      INSERT INTO batches_new (id, list_id, list_name, feature, params, status, error, created_at, finished_at, images_cleared)
        SELECT b.id, b.list_id, (SELECT l.name FROM waypoint_lists l WHERE l.id = b.list_id), b.feature, b.params, b.status,
               b.error, b.created_at, b.finished_at, b.images_cleared
        FROM batches b;
      DROP TABLE batches;
      ALTER TABLE batches_new RENAME TO batches;
    `);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
