import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import {
  parseMapsLink,
  parseWaypointText,
  type ParsedWaypoint,
  type ParseError,
  isListFeature, type ImportResult, type Waypoint, type WaypointList } from "@shell/shared";
import { openDb } from "./db/database.js";
import { registerBatchRoutes } from "./batch/routes.js";
import { RealBotRunner, type BotRunner } from "./bot/runner.js";
import type { Device } from "./device/device.js";
import { Teleporter } from "./device/teleporter.js";
import { Adb, adbOptionsFromEnv } from "./device/adb.js";
import { join } from "node:path";
import { DEFAULT_RUNS_LIMIT_BYTES } from "./batch/retention.js";

export interface AppOptions {
  /** 資料目錄（SQLite 放這裡）。預設取環境變數 DATA_DIR，再退回 repo 根目錄的 data/。 */
  dataDir?: string;
  /** 跑 bot 的介面；預設是真 bot。測試與沒接手機時傳假的。 */
  bot?: BotRunner;
  /** 手機；預設是透過 adb 的 Teleporter。 */
  device?: Device;
  /** Teleport 後等多久才呼叫 bot（毫秒）。預設取環境變數 TELEPORT_WAIT_MS，再退回 5000。 */
  waitMs?: number;
  /** run 資料夾總量上限（bytes）的預設值。取環境變數 RUNS_LIMIT_BYTES，再退回 1 GB；設定裡存過的值優先。 */
  runsLimitBytes?: number;
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
  spot_name: string | null;
}

const toWaypoint = (r: WaypointRow): Waypoint => ({
  spotName: r.spot_name,
  id: r.id,
  listId: r.list_id,
  position: r.position,
  lat: r.lat,
  lng: r.lng,
  label: r.label,
  radius: r.radius,
});

/** 匯入文字：每行是 `lat,lng [標籤]` 或 Google Maps 連結。 */
function parseImportText(text: string): { waypoints: ParsedWaypoint[]; errors: ParseError[] } {
  const waypoints: ParsedWaypoint[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (/^(https?:[/][/]|(maps[.]app[.])?goo[.]gl)/i.test(line)) {
      const r = parseMapsLink(line);
      if (r.ok) waypoints.push({ lat: r.lat, lng: r.lng, label: "", radius: null });
      else errors.push({ line: i + 1, text: raw, reason: r.reason });
      return;
    }
    const one = parseWaypointText(raw);
    waypoints.push(...one.waypoints);
    errors.push(...one.errors.map((e) => ({ ...e, line: i + 1 })));
  });
  return { waypoints, errors };
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const dataDir = opts.dataDir ?? defaultDataDir();
  const db = openDb(dataDir);
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
        `SELECT l.id, l.name, l.feature, (SELECT COUNT(*) FROM waypoints w WHERE w.list_id = l.id) AS waypointCount
         FROM waypoint_lists l WHERE l.id = ?`,
      )
      .get(id) as unknown as WaypointList;

  app.get<{ Querystring: { feature?: string } }>("/api/lists", async (req, reply) => {
    const feature = req.query.feature;
    if (!isListFeature(feature)) return reply.code(400).send({ error: "feature 必填，要是 postcard-check、quiet-search 或 target-search" });
    return db
      .prepare(
        `SELECT l.id, l.name, l.feature, (SELECT COUNT(*) FROM waypoints w WHERE w.list_id = l.id) AS waypointCount
         FROM waypoint_lists l WHERE l.feature = ? ORDER BY l.id`,
      )
      .all(feature) as unknown as WaypointList[];
  });

  app.post("/api/lists", async (req, reply) => {
    const name = parseName(req.body);
    if (!name) return reply.code(400).send({ error: "name 必填" });
    const feature = (req.body as { feature?: unknown } | null)?.feature;
    if (!isListFeature(feature)) return reply.code(400).send({ error: "feature 必填，要是 postcard-check、quiet-search 或 target-search" });
    const { lastInsertRowid } = db.prepare("INSERT INTO waypoint_lists (name, feature) VALUES (?, ?)").run(name, feature);
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
    const busy = db.prepare("SELECT COUNT(*) AS n FROM batches WHERE list_id = ? AND status IN ('running', 'queued')").get(id) as { n: number };
    if (busy.n > 0) return reply.code(409).send({ error: "這個清單有執行中或排隊中的 Batch，不能刪除" });
    // Batch 歷史留著：先把清單目前的名稱記進 Batch，再刪清單（batches.list_id 會變 NULL）。
    db.prepare("UPDATE batches SET list_name = (SELECT name FROM waypoint_lists WHERE id = ?) WHERE list_id = ?").run(id, id);
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
    const { waypoints, errors } = parseImportText(text);
    const start = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM waypoints WHERE list_id = ?").get(id) as {
      n: number;
    }).n;
    const insert = db.prepare("INSERT INTO waypoints (list_id, position, lat, lng, label, radius, spot_name) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const imported: Waypoint[] = waypoints.map((w, i) => {
      const r = insert.run(id, start + i, w.lat, w.lng, w.label, w.radius, w.spotName ?? null);
      return { id: Number(r.lastInsertRowid), listId: id, position: start + i, lat: w.lat, lng: w.lng, label: w.label, radius: w.radius, spotName: w.spotName ?? null };
    });
    const result: ImportResult = { imported, errors };
    return result;
  });

  const getWaypoint = (id: number) =>
    db.prepare("SELECT * FROM waypoints WHERE id = ?").get(id) as unknown as WaypointRow | undefined;
  const isCoord = (lat: unknown, lng: unknown) =>
    typeof lat === "number" && typeof lng === "number" && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  app.post<{ Params: { id: string } }>("/api/lists/:id/waypoints", async (req, reply) => {
    const id = Number(req.params.id);
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    const b = (req.body ?? {}) as { lat?: unknown; lng?: unknown; label?: unknown };
    if (!isCoord(b.lat, b.lng)) return reply.code(400).send({ error: "lat／lng 不合法" });
    const label = typeof b.label === "string" ? b.label.trim() : "";
    const pos = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM waypoints WHERE list_id = ?").get(id) as {
      n: number;
    }).n;
    const r = db
      .prepare("INSERT INTO waypoints (list_id, position, lat, lng, label) VALUES (?, ?, ?, ?, ?)")
      .run(id, pos, b.lat as number, b.lng as number, label);
    return reply.code(201).send(toWaypoint(getWaypoint(Number(r.lastInsertRowid))!));
  });

  app.patch<{ Params: { id: string } }>("/api/waypoints/:id", async (req, reply) => {
    const id = Number(req.params.id);
    const row = getWaypoint(id);
    if (!row) return reply.code(404).send({ error: "找不到 Waypoint" });
    const b = (req.body ?? {}) as { label?: unknown; radius?: unknown; spotName?: unknown };
    const label = typeof b.label === "string" ? b.label.trim() : row.label;
    const radius = b.radius === null ? null : typeof b.radius === "number" && b.radius > 0 ? b.radius : row.radius;
    const spotName =
      b.spotName === null ? null : typeof b.spotName === "string" ? b.spotName.trim() || null : row.spot_name;
    db.prepare("UPDATE waypoints SET label = ?, radius = ?, spot_name = ? WHERE id = ?").run(label, radius, spotName, id);
    return toWaypoint(getWaypoint(id)!);
  });

  app.delete<{ Params: { id: string } }>("/api/waypoints/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!getWaypoint(id)) return reply.code(404).send({ error: "找不到 Waypoint" });
    db.prepare("DELETE FROM waypoints WHERE id = ?").run(id);
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string } }>("/api/lists/:id/order", async (req, reply) => {
    const id = Number(req.params.id);
    if (!listExists(id)) return reply.code(404).send({ error: "找不到清單" });
    const ids = (req.body as { ids?: unknown } | null)?.ids;
    const current = (db.prepare("SELECT id FROM waypoints WHERE list_id = ?").all(id) as unknown as { id: number }[]).map((r) => r.id);
    const valid =
      Array.isArray(ids) &&
      ids.length === current.length &&
      new Set(ids).size === ids.length &&
      ids.every((x) => typeof x === "number" && current.includes(x));
    if (!valid) return reply.code(400).send({ error: "ids 必須剛好是這個清單的所有 Waypoint" });
    const upd = db.prepare("UPDATE waypoints SET position = ? WHERE id = ?");
    (ids as number[]).forEach((wid, i) => upd.run(i, wid));
    const rows = db.prepare("SELECT * FROM waypoints WHERE list_id = ? ORDER BY position, id").all(id) as unknown as WaypointRow[];
    return rows.map(toWaypoint);
  });

  registerBatchRoutes(app, db, {
    bot: opts.bot ?? new RealBotRunner(),
    device: opts.device ?? new Teleporter(new Adb(adbOptionsFromEnv())),
    waitMs: opts.waitMs ?? Number(process.env.TELEPORT_WAIT_MS ?? 5000),
    runsDir: join(dataDir, "runs"),
    runsLimitBytes: opts.runsLimitBytes ?? (Number(process.env.RUNS_LIMIT_BYTES) > 0 ? Number(process.env.RUNS_LIMIT_BYTES) : DEFAULT_RUNS_LIMIT_BYTES),
  });

  return app;
}
