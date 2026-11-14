import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { FastifyInstance } from "fastify";
import { planDiscovery, type CancelMode, type QuietSearchParams, type Region, TargetSearchParams, Waypoint } from "@shell/shared";
import type { Db } from "../db/database.js";
import { BatchHub } from "./hub.js";
import { BatchQueue } from "./queue.js";
import { runBatch, type BatchDeps, type BatchFeature } from "./runBatch.js";
import { createBatch, finishBatch, getBatch, listSightings, listTargets, quietAverageMs, rememberTargets } from "./store.js";
import { discoveryFeature } from "./discovery.js";
import { quietSearchFeature } from "./quietSearch.js";
import { targetSearchFeature } from "./targetSearch.js";

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
  const queue = new BatchQueue();
  // 上次伺服器結束時還沒跑完的 Batch 不會再繼續；標成失敗，免得永遠卡在排隊／執行中。
  db.prepare("UPDATE batches SET status = 'failed', error = ?, finished_at = ? WHERE status IN ('queued', 'running')").run(
    "伺服器重新啟動，這個 Batch 被中斷", new Date().toISOString(),
  );

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
    start(batchId, "target-search", body.listId, targetSearchFeature(body), waypoints);
    return reply.code(201).send({ batchId });
  });

  /** 所有功能共用：排進同一個佇列，輪到時交給 runBatch。 */
  function start(batchId: number, name: string, listId: number, feature: BatchFeature, waypoints: Waypoint[]) {
    const listName = (db.prepare("SELECT name FROM waypoint_lists WHERE id = ?").get(listId) as { name: string }).name;
    hub.open(batchId);
    const position = queue.enqueue({
      item: { batchId, feature: name, listId, listName },
      run: (control) => runBatch(full, batchId, feature, waypoints, control),
      onRemoved: () => cancelQueued(batchId),
    });
    if (position > 0) hub.emit(batchId, { type: "queued", batchId, position });
  }

  function cancelQueued(batchId: number) {
    finishBatch(db, batchId, "cancelled", "在排隊時被移出佇列");
    hub.emit(batchId, { type: "finished", status: "cancelled", error: "在排隊時被移出佇列" });
  }

  app.get("/api/queue", async () => queue.snapshot());

  app.post<{ Params: { id: string } }>("/api/batches/:id/cancel", async (req, reply) => {
    const id = Number(req.params.id);
    const mode = ((req.body ?? {}) as { mode?: unknown }).mode ?? "after-waypoint";
    if (mode !== "after-waypoint" && mode !== "force") return reply.code(400).send({ error: "mode 只能是 after-waypoint 或 force" });
    if (!getBatch(db, id)) return reply.code(404).send({ error: "找不到 Batch" });
    if (queue.cancel(id, mode as CancelMode) === "unknown") return reply.code(409).send({ error: "這個 Batch 已經結束" });
    return { ok: true };
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
    start(batchId, "quiet-search", params.listId, quietSearchFeature(params), waypoints);
    return reply.code(201).send({ batchId });
  });

  app.get("/api/quiet-stats", async () => ({ avgMsPerPoint: quietAverageMs(db) }));

  // Discovery：Region 鋪成格子（存成一份「Discovery 鋪點」清單當 Batch 的輸入），之後就是一個 quiet Batch。
  app.post("/api/batches/discovery", async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = (b.region ?? {}) as Record<string, unknown>;
    const name = typeof b.name === "string" ? b.name.trim() : "";
    const nums = [r.south, r.west, r.north, r.east];
    if (!name || !nums.every((n) => typeof n === "number" && Number.isFinite(n)) || typeof b.radius !== "number" || !(b.radius > 0) || typeof b.spacing !== "number" || !(b.spacing > 0)) {
      return reply.code(400).send({ error: "需要 name、region（south／west／north／east）、radius > 0、spacing > 0" });
    }
    const plan = planDiscovery({ region: r as unknown as Region, spacingM: b.spacing, avgMsPerPoint: quietAverageMs(db) });
    if (!plan.ok) return reply.code(400).send({ error: plan.reason });
    if (plan.needsConfirm && b.confirmed !== true) {
      return reply.code(409).send({ error: `這會跑 ${plan.points.length} 個點，需要再確認一次`, needsConfirm: true, points: plan.points.length, estimateMs: plan.estimateMs });
    }
    // 每次另開一份鋪點清單（不覆蓋舊的，舊 Batch 的歷史才對得上）。
    const stamp = new Date().toLocaleString("sv-SE", { hour12: false }).slice(0, 16);
    const gridId = Number(db.prepare("INSERT INTO waypoint_lists (name) VALUES (?)").run(`Discovery 鋪點：${name}（${stamp}）`).lastInsertRowid);
    const ins = db.prepare("INSERT INTO waypoints (list_id, position, lat, lng, label) VALUES (?, ?, ?, ?, ?)");
    plan.points.forEach((p, i) => ins.run(gridId, i, p.lat, p.lng, `格 ${i + 1}`));
    const waypoints = db
      .prepare("SELECT id, list_id AS listId, position, lat, lng, label, radius, spot_name AS spotName FROM waypoints WHERE list_id = ? ORDER BY position, id")
      .all(gridId) as unknown as Waypoint[];
    const params = { listId: gridId, radius: b.radius, regionName: name, region: r, spacing: b.spacing };
    const batchId = createBatch(db, "discovery", params);
    start(batchId, "discovery", gridId, discoveryFeature(params), waypoints);
    return reply.code(201).send({ batchId, listId: gridId });
  });

  app.get("/api/targets", async () => listTargets(db));

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
