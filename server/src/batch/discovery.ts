import { sweepRadius, type QuietResult } from "@shell/shared";
import type { Db } from "../db/database.js";
import { quietSearchFeature } from "./quietSearch.js";
import type { BatchFeature } from "./runBatch.js";

export const discoveryListName = (regionName: string) => `Discovery：${regionName}`;

/** 把答案是 true 的點加進「Discovery：<名稱>」清單（沒有就建立，有就附加；同座標同半徑不重複加）。 */
export function collectDiscovered(db: Db, regionName: string, point: { lat: number; lng: number }, radius: number): void {
  const name = discoveryListName(regionName);
  const found = db.prepare("SELECT id FROM waypoint_lists WHERE name = ? ORDER BY id LIMIT 1").get(name) as { id: number } | undefined;
  const listId = found?.id ?? Number(db.prepare("INSERT INTO waypoint_lists (name) VALUES (?)").run(name).lastInsertRowid);
  const dup = db
    .prepare("SELECT 1 FROM waypoints WHERE list_id = ? AND lat = ? AND lng = ? AND radius = ?")
    .get(listId, point.lat, point.lng, radius);
  if (dup !== undefined) return;
  const pos = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM waypoints WHERE list_id = ?").get(listId) as { n: number }).n;
  db.prepare("INSERT INTO waypoints (list_id, position, lat, lng, label, radius) VALUES (?, ?, ?, ?, '', ?)").run(
    listId, pos, point.lat, point.lng, radius,
  );
}

/** Discovery：就是 Quiet Giant Search，只多一步「true 的點收進 Discovery 清單」。 */
export function discoveryFeature(params: { listId: number; radius: number; regionName: string }): BatchFeature {
  const quiet = quietSearchFeature({ listId: params.listId, radius: params.radius });
  return {
    ...quiet,
    interpret(ctx) {
      const out = quiet.interpret(ctx);
      if ((out.result as QuietResult).verdict === true) {
        const p = ctx.point;
        collectDiscovered(ctx.deps.db, params.regionName, p, sweepRadius({ radius: p.radius ?? null }, params.radius));
      }
      return out;
    },
  };
}
