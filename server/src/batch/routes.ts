import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { QuietSearchParams, TargetSearchParams, Waypoint } from "@shell/shared";
import type { Db } from "../db/database.js";
import { BatchHub } from "./hub.js";
import { createBatch, getBatch, listSightings, listTargets, rememberTargets } from "./store.js";
import { runQuietSearch } from "./quietSearch.js";
import { runTargetSearch, type BatchDeps } from "./targetSearch.js";

function parseParams(body: unknown): TargetSearchParams | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const targets = Array.isArray(b.targets) ? b.targets.filter((t): t is string => typeof t === "string").map((t) => t.trim()) : [];
  if (typeof b.listId !== "number" || targets.length === 0 || targets.some((t) => !t)) return null;
  if (typeof b.radius !== "number" || !(b.radius > 0)) return null;
  if (typeof b.skipCrowded !== "number" || !(b.skipCrowded >= 0)) return null;
  return { listId: b.listId, targets, radius: b.radius, skipCrowded: b.skipCrowded };
}

export function registerBatchRoutes(app: FastifyInstance, db: Db, deps: Omit<BatchDeps, "hub" | "db">): void {
  const hub = new BatchHub();
  const full: BatchDeps = { ...deps, db, hub };

  app.post("/api/batches/target-search", async (req, reply) => {
    const body = parseParams(req.body);
    if (!body) return reply.code(400).send({ error: "需要 listId、至少一個 targets、radius > 0、skipCrowded >= 0" });
    if (db.prepare("SELECT 1 FROM waypoint_lists WHERE id = ?").get(body.listId) === undefined) {
      return reply.code(404).send({ error: "找不到清單" });
    }
    rememberTargets(db, body.targets);
    const waypoints = db
      .prepare("SELECT id, list_id AS listId, position, lat, lng, label, radius FROM waypoints WHERE list_id = ? ORDER BY position, id")
      .all(body.listId) as unknown as Waypoint[];
    const batchId = createBatch(db, "target-search", body);
    hub.open(batchId);
    void runTargetSearch(full, batchId, body, waypoints);
    return reply.code(201).send({ batchId });
  });

  app.post("/api/batches/quiet-search", async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.listId !== "number" || typeof b.radius !== "number" || !(b.radius > 0)) {
      return reply.code(400).send({ error: "需要 listId 與 radius > 0" });
    }
    const params: QuietSearchParams = { listId: b.listId, radius: b.radius };
    if (db.prepare("SELECT 1 FROM waypoint_lists WHERE id = ?").get(params.listId) === undefined) {
      return reply.code(404).send({ error: "找不到清單" });
    }
    const waypoints = db
      .prepare("SELECT id, list_id AS listId, position, lat, lng, label, radius, spot_name AS spotName FROM waypoints WHERE list_id = ? ORDER BY position, id")
      .all(params.listId) as unknown as Waypoint[];
    const batchId = createBatch(db, "quiet-search", params);
    hub.open(batchId);
    void runQuietSearch(full, batchId, params, waypoints);
    return reply.code(201).send({ batchId });
  });

  app.get("/api/targets",async () => listTargets(db));

  app.get<{ Params: { id: string } }>("/api/batches/:id", async (req, reply) => {
    return getBatch(db, Number(req.params.id)) ?? reply.code(404).send({ error: "找不到 Batch" });
  });

  app.get<{ Params: { id: string } }>("/api/batches/:id/sightings", async (req) => listSightings(db, Number(req.params.id), deps.runsDir));

  // run 資料夾裡的截圖。名稱只允許單一路徑段，避免跳出 runs/。
  const SAFE_NAME = /^[\w][\w.-]*$/;
  const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
  app.get<{ Params: { run: string; file: string } }>("/api/runs/:run/:file", async (req, reply) => {
    const { run, file } = req.params;
    if (!SAFE_NAME.test(run) || !SAFE_NAME.test(file)) return reply.code(404).send({ error: "找不到檔案" });
    const path = join(deps.runsDir, run, file);
    if (!existsSync(path)) return reply.code(404).send({ error: "找不到檔案" });
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
    return reply.type(MIME[ext] ?? "application/octet-stream").send(createReadStream(path));
  });

  app.get<{ Params: { id: string } }>("/api/batches/:id/events", async (req, reply) => {
    const stream = new PassThrough();
    const unsubscribe = hub.subscribe(Number(req.params.id), (e) => {
      stream.write(`data: ${JSON.stringify(e)}\n\n`);
      if (e.type === "finished") stream.end();
    });
    if (!unsubscribe) return reply.code(404).send({ error: "找不到 Batch" });
    stream.on("close", unsubscribe);
    return reply.header("content-type", "text/event-stream").header("cache-control", "no-cache").send(stream);
  });
}
