import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { ensureColumn, openDb } from "./database.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-db-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** ticket 02 時代的資料庫：只有 waypoint_lists 與 waypoints，裡面已有資料。 */
function createLegacyDb(): void {
  const db = new DatabaseSync(join(dir, "app.db"));
  db.exec(`
    CREATE TABLE waypoint_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE waypoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES waypoint_lists(id) ON DELETE CASCADE,
      position INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
      label TEXT NOT NULL DEFAULT '', radius REAL
    );
    INSERT INTO waypoint_lists (name) VALUES ('舊清單');
    INSERT INTO waypoints (list_id, position, lat, lng, label) VALUES (1, 0, 25.1, 121.5, '舊點');
  `);
  db.close();
}

describe("既有的 data/app.db", () => {
  it("舊資料庫直接開得起來：舊資料還在，Batch 用的新表也能用", async () => {
    createLegacyDb();
    const app = buildApp({
      dataDir: dir,
      bot: { run: async () => ({ exitCode: 0, stdout: "[]", runDir: null }) },
      device: { teleport: async () => {}, stop: async () => {} },
      waitMs: 0,
    });
    expect((await app.inject("/api/lists")).json()).toEqual([{ id: 1, name: "舊清單", waypointCount: 1 }]);
    const res = await app.inject({
      method: "POST",
      url: "/api/batches/target-search",
      payload: { listId: 1, targets: ["巨大 *"], radius: 500, skipCrowded: 0 },
    });
    expect(res.statusCode).toBe(201);
    const { batchId } = res.json();
    expect((await app.inject(`/api/batches/${batchId}/events`)).body).toContain('"status":"done"');
    await app.close();
  });

  it("ensureColumn：表缺欄位時補上，已有就不動（可重複呼叫）", () => {
    createLegacyDb();
    const db = openDb(dir);
    ensureColumn(db, "waypoints", "note", "TEXT");
    ensureColumn(db, "waypoints", "note", "TEXT");
    db.prepare("UPDATE waypoints SET note = ? WHERE id = 1").run("備註");
    expect(db.prepare("SELECT label, note FROM waypoints").get()).toEqual({ label: "舊點", note: "備註" });
    db.close();
  });
});
