import type { BotSighting, BatchPoint, StoredSighting, TargetSearchParams } from "@shell/shared";
import { HuntStderrReader, parseHuntStdout } from "../bot/parseHunt.js";
import type { BatchFeature } from "./runBatch.js";
import { deleteSighting, saveSighting, setSightingRunDir, updateSighting } from "./store.js";

export { failureReason } from "./runBatch.js";

export function huntArgs(params: TargetSearchParams, point: BatchPoint): string[] {
  return [
    "--radius", String(point.radius ?? params.radius),
    ...params.targets.flatMap((t) => ["--target", t]),
    "--skip-crowded", String(params.skipCrowded),
  ];
}

/** bot 印的路徑 → 檔名與它所在的資料夾名（Windows 與 POSIX 的分隔都接受）。 */
function splitPath(p: string): { dir: string | null; file: string } {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return { file: parts.at(-1) ?? p, dir: parts.length >= 2 ? parts.at(-2)! : null };
}

/**
 * Target Search：每點 `hunt`。
 * Sweep 進行中 bot 每找到一顆就在 stderr 印出來，這時先存一筆 Sighting 並推給網頁（地圖、卡片馬上看得到）；
 * bot 結束後以 stdout 的 Sighting 陣列為準，補齊或修正先存的那筆。
 */
export function targetSearchFeature(params: TargetSearchParams): BatchFeature {
  // 目前這個 Waypoint 的 stderr 解析狀態，與 Sweep 中先存下的 Sighting。
  let live: { index: number; reader: HuntStderrReader; saved: StoredSighting[] } | null = null;
  const liveFor = (index: number) => (live?.index === index ? live : (live = { index, reader: new HuntStderrReader(), saved: [] }));

  return {
    plan: (w) => ({ command: "hunt", args: huntArgs(params, w) }),
    onStderrLine({ deps, batchId, point, index }, line) {
      const l = liveFor(index);
      const s = l.reader.feed(line);
      if (!s) return;
      const postcard = s.postcardPath ? splitPath(s.postcardPath) : null;
      const saved = saveSighting(
        deps.db,
        batchId,
        point.waypointId ?? null,
        index,
        {
          target: s.target,
          lat: s.lat,
          lng: s.lng,
          spot_name: s.spot_name,
          participant_count: s.participant_count,
          remaining_seconds: s.remaining_seconds,
          observed_at: s.observed_at,
          map_position: null,
          // cli.md 的 run 資料夾命名；猜錯只是暫時沒有圖，bot 結束後由 stdout 補正。
          frame: `sighting-${String(l.saved.length + 1).padStart(2, "0")}.png`,
          postcard: postcard?.file ?? null,
        },
        postcard?.dir ?? null,
        deps.runsDir,
      );
      l.saved.push(saved);
      deps.hub.emit(batchId, { type: "sighting", sighting: saved });
    },
    interpret({ deps, batchId, point, index, result, runName }) {
      let sightings: BotSighting[] = [];
      let error: string | null = null;
      let parsed = false;
      try {
        const out = parseHuntStdout(result.stdout);
        if (out) {
          sightings = out;
          parsed = true;
        } else if (result.exitCode === 0) error = "bot 沒有輸出";
      } catch (e) {
        error = (e as Error).message;
      }
      const pending = live?.index === index ? [...live.saved] : [];
      live = null;
      for (const s of sightings) {
        const k = pending.findIndex((p) => p.target === s.target && p.spot_name === s.spot_name);
        const saved =
          k >= 0
            ? updateSighting(deps.db, pending.splice(k, 1)[0]!.id, s, runName, deps.runsDir)
            : saveSighting(deps.db, batchId, point.waypointId ?? null, index, s, runName, deps.runsDir);
        deps.hub.emit(batchId, { type: "sighting", sighting: saved });
      }
      // 先存的卻沒對上：stdout 正常時以它為準、刪掉；stdout 沒有或壞掉（中止）時留著，補上 run 資料夾讓截圖找得到。
      for (const p of pending) {
        if (parsed) {
          deleteSighting(deps.db, p.id);
          deps.hub.emit(batchId, { type: "sighting-removed", id: p.id });
        } else if (runName) {
          deps.hub.emit(batchId, { type: "sighting", sighting: setSightingRunDir(deps.db, p.id, runName, deps.runsDir) });
        }
      }
      return { result: sightings, error };
    },
  };
}
