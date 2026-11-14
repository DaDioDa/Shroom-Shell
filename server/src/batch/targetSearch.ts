import type { BotSighting, BatchPoint, TargetSearchParams } from "@shell/shared";
import { parseHuntStdout } from "../bot/parseHunt.js";
import type { BatchFeature } from "./runBatch.js";
import { saveSighting } from "./store.js";

export { failureReason } from "./runBatch.js";

export function huntArgs(params: TargetSearchParams, point: BatchPoint): string[] {
  return [
    "--radius", String(point.radius ?? params.radius),
    ...params.targets.flatMap((t) => ["--target", t]),
    "--skip-crowded", String(params.skipCrowded),
  ];
}

/** Target Search：每點 `hunt`，stdout 是 Sighting 的 JSON 陣列。 */
export function targetSearchFeature(params: TargetSearchParams): BatchFeature {
  return {
    plan: (w) => ({ command: "hunt", args: huntArgs(params, w) }),
    interpret({ deps, batchId, point, index, result, runName }) {
      let sightings: BotSighting[] = [];
      let error: string | null = null;
      try {
        const parsed = parseHuntStdout(result.stdout);
        if (parsed) sightings = parsed;
        else if (result.exitCode === 0) error = "bot 沒有輸出";
      } catch (e) {
        error = (e as Error).message;
      }
      for (const s of sightings) {
        const saved = saveSighting(deps.db, batchId, point.waypointId ?? null, index, s, runName, deps.runsDir);
        deps.hub.emit(batchId, { type: "sighting", sighting: saved });
      }
      return { result: sightings, error };
    },
  };
}
