import { basename } from "node:path";
import { sweepRadius, type BotSighting, type QuietResult, type QuietSearchParams, type Waypoint } from "@shell/shared";
import { parseQuietStdout } from "../bot/parseQuiet.js";
import { failureReason, type BatchDeps } from "./targetSearch.js";
import { recordWaypointRunRadius } from "./history.js";
import { finishBatch, saveSighting, saveWaypointRun } from "./store.js";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 功能只負責「這一點跑什麼指令」：`quiet --radius <R>`（`--runs-dir` 由 runner 加）。 */
export function quietArgs(params: QuietSearchParams, waypoint: Waypoint): string[] {
  return ["--radius", String(sweepRadius(waypoint, params.radius))];
}

const EXPECTED_VERDICT: Record<number, boolean | null> = { 0: true, 1: false, 2: null };

const unknown = (reason: string): QuietResult => ({ quiet_area: null, verdict: null, reason, giants: [], claimed: null, unread: 0 });

/** 一次 `quiet` 的 exit code、stdout、stderr → 答案。看不懂或前後矛盾一律是「無法判斷」。 */
export function interpretQuietRun(run: { exitCode: number; stdout: string; stderr: string[]; runDir: string | null }): QuietResult {
  let parsed: QuietResult | null;
  try {
    parsed = parseQuietStdout(run.stdout);
  } catch (e) {
    return unknown(errorMessage(e));
  }
  if (!parsed) return unknown(failureReason(run.stderr, run.runDir));
  if (!(run.exitCode in EXPECTED_VERDICT) || EXPECTED_VERDICT[run.exitCode] !== parsed.verdict) {
    return unknown(`exit code ${run.exitCode} 與 stdout 的答案（verdict: ${String(parsed.verdict)}）不一致`);
  }
  return parsed;
}

/** 依 Waypoint 順序逐點：Teleport → 等待 → quiet。結束一律 stop。 */
export async function runQuietSearch(
  deps: BatchDeps,
  batchId: number,
  params: QuietSearchParams,
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
      const run = await deps.bot.run({
        command: "quiet",
        args: quietArgs(params, w),
        runsDir: deps.runsDir,
        onStderrLine: (line) => {
          stderr.push(line);
          deps.hub.emit(batchId, { type: "stderr", index, line });
        },
      });
      const result = interpretQuietRun({ exitCode: run.exitCode, stdout: run.stdout, stderr, runDir: run.runDir });
      const runName = run.runDir ? basename(run.runDir) : null;
      const giants: BotSighting[] = result.verdict === null ? [] : result.giants;
      for (const g of giants) {
        const saved = saveSighting(deps.db, batchId, w.id, g, runName, deps.runsDir);
        deps.hub.emit(batchId, { type: "sighting", sighting: saved });
      }
      deps.hub.emit(batchId, { type: "quiet-result", index, waypointId: w.id, radius: sweepRadius(w, params.radius), result });
      saveWaypointRun(deps.db, {
        batchId, waypointId: w.id, index, exitCode: run.exitCode, result,
        runDir: runName, error: result.verdict === null ? result.reason : null,
      });
      recordWaypointRunRadius(deps.db, batchId, index, sweepRadius(w, params.radius));
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
