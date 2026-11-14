import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { CheckOutcome, CheckResult } from "@shell/shared";
import { parseCheckStdout } from "../bot/parseCheck.js";
import { failureReason, type BatchFeature } from "./runBatch.js";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** bot 給的 frame／postcard 是絕對路徑：只有真的在 runsDir/<run> 底下、而且檔案還在才給網址。 */
export function checkImageUrl(runsDir: string, runName: string | null, absPath: string | null): string | null {
  if (!runName || !absPath) return null;
  const full = resolve(absPath);
  if (dirname(full) !== resolve(join(runsDir, runName)) || !existsSync(full)) return null;
  return `/api/runs/${runName}/${basename(full)}`;
}

export function toOutcome(runsDir: string, runName: string | null, index: number, waypointId: number, result: CheckResult, abortUrl: string | null = null): CheckOutcome {
  const found = result.found === true ? result : null;
  return {
    index,
    waypointId,
    result,
    frameUrl: checkImageUrl(runsDir, runName, found?.frame ?? null),
    postcardUrl: checkImageUrl(runsDir, runName, found?.postcard ?? null),
    abortUrl,
  };
}

const EXPECTED: Record<number, boolean | null> = { 0: true, 1: false, 2: null };

/** exit code 與 stdout 看不懂或矛盾時，一律當「沒讀完」。 */
export function interpretCheckRun(run: { exitCode: number; stdout: string; stderr: string[]; runDir: string | null }, spotName: string): CheckResult {
  const unfinished = (reason: string): CheckResult => ({ found: null, spot_name: spotName, reason });
  let parsed: CheckResult | null;
  try {
    parsed = parseCheckStdout(run.stdout);
  } catch (e) {
    return unfinished(errorMessage(e));
  }
  if (!parsed) return unfinished(failureReason(run.stderr, run.runDir));
  if (EXPECTED[run.exitCode] !== parsed.found) return unfinished(`exit code ${run.exitCode} 與 stdout 的答案（found: ${String(parsed.found)}）不一致`);
  return parsed;
}

/** Postcard Check：每點 `check --spot-name "<Spot Name>"`；exit 0／1／2 都是答案。 */
export function postcardCheckFeature(): BatchFeature {
  return {
    plan: (w) => ({ command: "check", args: ["--spot-name", w.spotName ?? ""] }),
    okExitCodes: [0, 1, 2],
    interpret({ deps, batchId, waypoint, index, result: run, stderr, runName, abortShotUrl }) {
      const result = interpretCheckRun({ exitCode: run.exitCode, stdout: run.stdout, stderr, runDir: run.runDir }, waypoint.spotName ?? "");
      deps.hub.emit(batchId, { type: "check-result", outcome: toOutcome(deps.runsDir, runName, index, waypoint.id, result, abortShotUrl) });
      return { result, error: result.found === null ? result.reason : null, report: false };
    },
  };
}
