import type { BotSighting } from "./types.js";
import { describeSighting } from "./sightingCard.js";

/** 到期時間（epoch 毫秒）= observed_at + remaining_seconds。尚未開始倒數或時間讀不出來時為 null。 */
export function sightingExpiresAt(s: Pick<BotSighting, "observed_at" | "remaining_seconds">): number | null {
  if (s.remaining_seconds === null) return null;
  const observed = Date.parse(s.observed_at);
  return Number.isNaN(observed) ? null : observed + s.remaining_seconds * 1000;
}

/** 剛好到期那一刻起算已到期。沒有到期時間的（尚未倒數）不算過期。 */
export function isSightingExpired(s: Pick<BotSighting, "observed_at" | "remaining_seconds">, nowMs: number): boolean {
  const at = sightingExpiresAt(s);
  return at !== null && at <= nowMs;
}

/** 地圖要畫的 Sighting：預設只留沒過期的，showAll 時全留。 */
export function visibleSightings<T extends Pick<BotSighting, "observed_at" | "remaining_seconds">>(
  sightings: T[],
  nowMs: number,
  showAll: boolean,
): T[] {
  return showAll ? sightings : sightings.filter((s) => !isSightingExpired(s, nowMs));
}

/** 地圖標記的樣式與 tooltip：過期的標「已過期」，尚未倒數的帶「N 分鐘前看到」。 */
export function sightingMarker(
  s: Pick<BotSighting, "target" | "spot_name" | "observed_at" | "remaining_seconds" | "lat" | "lng" | "participant_count">,
  nowMs: number,
): { expired: boolean; tooltip: string } {
  const expired = isSightingExpired(s, nowMs);
  const d = describeSighting(s as BotSighting, nowMs);
  const parts = [`${s.target}｜${s.spot_name}`];
  if (expired) parts.push("已過期");
  if (d.seen) parts.push(d.seen);
  return { expired, tooltip: parts.join("｜") };
}
