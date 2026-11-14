import { sweepRadius, type BotSighting, type QuietResult, type QuietSearchParams, type Waypoint } from "@shell/shared";
import { parseQuietStdout } from "../bot/parseQuiet.js";
import { failureReason, type BatchFeature } from "./runBatch.js";
import { saveSighting } from "./store.js";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

/** Quiet Giant Search：每點 `quiet`；exit 0／1／2 都是 bot 給的答案（2＝無法判斷），由 interpretQuietRun 解讀。 */
export function quietSearchFeature(params: QuietSearchParams): BatchFeature {
  return {
    plan: (w) => ({ command: "quiet", args: quietArgs(params, w) }),
    okExitCodes: [0, 1, 2],
    interpret({ deps, batchId, waypoint, index, result: run, stderr, runName }) {
      const result = interpretQuietRun({ exitCode: run.exitCode, stdout: run.stdout, stderr, runDir: run.runDir });
      const giants: BotSighting[] = result.verdict === null ? [] : result.giants;
      for (const g of giants) {
        const saved = saveSighting(deps.db, batchId, waypoint.id, g, runName, deps.runsDir);
        deps.hub.emit(batchId, { type: "sighting", sighting: saved });
      }
      deps.hub.emit(batchId, { type: "quiet-result", index, waypointId: waypoint.id, radius: sweepRadius(waypoint, params.radius), result });
      // 這點實際用的半徑一起存進 result_json，歷史頁才還原得出來（Waypoint 半徑之後可能被改）。
      return { result: { ...result, radius: sweepRadius(waypoint, params.radius) }, error: result.verdict === null ? result.reason : null, report: false };
    },
  };
}
