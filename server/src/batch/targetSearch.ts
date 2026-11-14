import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BotSighting, TargetSearchParams, Waypoint } from "@shell/shared";
import type { BotRunner } from "../bot/runner.js";
import type { Device } from "../device/device.js";
import { basename } from "node:path";
import type { Db } from "../db/database.js";
import { parseHuntStdout } from "../bot/parseHunt.js";
import type { BatchHub } from "./hub.js";
import { finishBatch, saveSighting, saveWaypointRun } from "./store.js";

export interface BatchDeps {
  db: Db;
  bot: BotRunner;
  device: Device;
  hub: BatchHub;
  /** Teleport 後等多久才呼叫 bot。 */
  waitMs: number;
  runsDir: string;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 從 bot 的 stderr（與 abort.txt）找出給人看的失敗原因。 */
export function failureReason(stderr: string[], runDir: string | null): string {
  for (const line of stderr) {
    const m = line.match(/^(?:中止|原因)：(.+)$/) ?? line.match(/^\s+原因：(.+)$/);
    if (m) return m[1]!.trim();
  }
  const argparse = stderr.find((l) => /error: /.test(l));
  if (argparse) return argparse.replace(/^.*?error: /, "").trim();
  if (runDir) {
    try {
      const first = readFileSync(join(runDir, "abort.txt"), "utf8").split(/\r?\n/)[0]?.trim();
      if (first) return first;
    } catch {
      // 沒有 abort.txt 就往下
    }
  }
  return stderr.filter((l) => l.trim()).at(-1)?.trim() ?? "bot 以 exit 2 結束，沒有說明原因";
}

export function huntArgs(params: TargetSearchParams, waypoint: Waypoint): string[] {
  return [
    "--radius", String(waypoint.radius ?? params.radius),
    ...params.targets.flatMap((t) => ["--target", t]),
    "--skip-crowded", String(params.skipCrowded),
  ];
}

/** 依 Waypoint 順序逐點：Teleport → 等待 → hunt。結束一律 stop。 */
export async function runTargetSearch(
  deps: BatchDeps,
  batchId: number,
  params: TargetSearchParams,
  waypoints: Waypoint[],
): Promise<void> {
  const total = waypoints.length;
  deps.hub.emit(batchId, { type: "started", batchId, total });
  let error: string | null = null;
  try {
    for (const [i, w] of waypoints.entries()) {
      const index = i + 1;
      deps.hub.emit(batchId, { type: "progress", index, total, waypointId: w.id, label: w.label });
      await deps.device.teleport({ lat: w.lat, lng: w.lng });
      await sleep(deps.waitMs);
      const stderr: string[] = [];
      const result = await deps.bot.run({
        command: "hunt",
        args: huntArgs(params, w),
        runsDir: deps.runsDir,
        onStderrLine: (line) => {
          stderr.push(line);
          deps.hub.emit(batchId, { type: "stderr", index, line });
        },
      });
      let sightings: BotSighting[] = [];
      let waypointError: string | null = null;
      try {
        const parsed = parseHuntStdout(result.stdout);
        if (parsed) sightings = parsed;
        else if (result.exitCode === 0) waypointError = "bot 沒有輸出";
      } catch (e) {
        waypointError = (e as Error).message;
      }
      if (result.exitCode !== 0 && !waypointError) waypointError = failureReason(stderr, result.runDir);
      if (waypointError) deps.hub.emit(batchId, { type: "waypoint-failed", index, error: waypointError });
      const runName = result.runDir ? basename(result.runDir) : null;
      for (const s of sightings) {
        const saved = saveSighting(deps.db, batchId, w.id, s, runName, deps.runsDir);
        deps.hub.emit(batchId, { type: "sighting", sighting: saved });
      }
      saveWaypointRun(deps.db, { batchId, waypointId: w.id, index, exitCode: result.exitCode, result: sightings, runDir: runName, error: waypointError });
    }
  } catch (e) {
    error = errorMessage(e);
  }
  // 不論怎麼結束都恢復真實 GPS。
  try {
    await deps.device.stop();
  } catch (e) {
    error ??= "恢復真實 GPS 失敗：" + errorMessage(e);
  }
  const status = error ? "failed" : "done";
  finishBatch(deps.db, batchId, status, error);
  deps.hub.emit(batchId, error ? { type: "finished", status, error } : { type: "finished", status });
}
