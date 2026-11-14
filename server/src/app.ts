import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { parseWaypointText, type ImportResult, type Waypoint, type WaypointList } from "@shell/shared";
import { openDb } from "./db/database.js";

export interface AppOptions {
  /** 資料目錄（SQLite 放這裡）。預設取環境變數 DATA_DIR，再退回 repo 根目錄的 data/。 */
  dataDir?: string;
}

export function defaultDataDir(): string {
  return process.env.DATA_DIR ?? fileURLToPath(new URL("../../data", import.meta.url));
}

interface WaypointRow {
  id: number;
  list_id: number;
  position: number;
  lat: number;
  lng: number;
  label: string;
  radius: number | null;
}

const toWaypoint = (r: WaypointRow): Waypoint => ({
  id: r.id,
  listId: r.list_id,
  position: r.position,
  lat: r.lat,
  lng: r.lng,
  label: r.label,
  radius: r.radius,
});

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const db = openDb(opts.dataDir ?? defaultDataDir());
  const app = Fastify();
  app.addHook("onClose", async () => db.close());

  const listExists = (id: number) => db.prepare("SELECT 1 FROM waypoint_lists WHERE id = ?").get(id) !== undefined;
  const parseName = (body: unknown): string | null => {
    const name = (body as { name?: unknown } | null)?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  };
  const getList = (id: number) =>
    db
      .prepare(
        `SELECT l.id, l.name, (SELECT COUNT(*) FROM waypoints w WHERE w.list_id = l.id) AS waypointCount
         FROM waypoint_lists l WHERE l.id = ?`,
      )
      .get(id) as unknown as WaypointList;

  app.get("/api/lists", async () =>
    db
      .prepare(
        `SELECT l.id, l.name, (SELECT COUNT(*) FROM waypoints w WHERE w.list_id = l.id) AS waypointCount
         FROM waypoint_lists l ORDER BY l.id`,
      )
      .all() as unknown as WaypointList[],
  );

  app.post("/api/lists", async (req, reply) => {
    const name = parseName(req.body);
    if (!name) return reply.code(400).send({ error: "name 必填" });
    const { lastInsertRowid } = db.prepare("INSERT INTO waypoint_lists (name) VALUES (?)").run(name);
    return reply.code(201).send(getList(Number(lastInsertRowid)));
  });

  app.patch<{ Params: { id: string } }>("/api/lists/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const name = parseName(req.body);
    if (!name) return reply.code(400).send({ error: "name 必填" });
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    db.prepare("UPDATE waypoint_lists SET name = ? WHERE id = ?").run(name, id);
    return getList(id);
  });

  app.delete<{ Params: { id: string } }>("/api/lists/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    db.prepare("DELETE FROM waypoint_lists WHERE id = ?").run(id);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>("/api/lists/:id/waypoints", async (req, reply) => {
    const id = Number(req.params.id);
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    const rows = db
      .prepare("SELECT * FROM waypoints WHERE list_id = ? ORDER BY position, id")
      .all(id) as unknown as WaypointRow[];
    return rows.map(toWaypoint);
  });

  app.post<{ Params: { id: string } }>("/api/lists/:id/import", async (req, reply) => {
    const id = Number(req.params.id);
    const text = (req.body as { text?: unknown } | null)?.text;
    if (typeof text !== "string") return reply.code(400).send({ error: "text 必填" });
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    const { waypoints, errors } = parseWaypointText(text);
    const start = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM waypoints WHERE list_id = ?").get(id) as {
      n: number;
    }).n;
    const insert = db.prepare("INSERT INTO waypoints (list_id, position, lat, lng, label) VALUES (?, ?, ?, ?, ?)");
    const imported: Waypoint[] = waypoints.map((w, i) => {
      const r = insert.run(id, start + i, w.lat, w.lng, w.label);
      return { id: Number(r.lastInsertRowid), listId: id, position: start + i, lat: w.lat, lng: w.lng, label: w.label, radius: null };
    });
    const result: ImportResult = { imported, errors };
    return result;
  });

  return app;
}
