import type { BotSighting } from "./types.js";

export type ExpiryState = "unclaimed" | "active" | "expired";

export interface SightingDescription {
  participants: string;
  /** 到期時間、已到期，或「尚未開始倒數」。 */
  expiry: string;
  state: ExpiryState;
  /** 尚未開始倒數時顯示「N 分鐘前看到」，其他情況為 null。 */
  seen: string | null;
  mapUrl: string;
}

/** 以 observed_at 自己的時區顯示 `YYYY-MM-DD HH:mm`，不受執行環境時區影響。 */
function formatInOffset(epochMs: number, observedAt: string): string {
  const m = observedAt.match(/([+-])(\d{2}):?(\d{2})$/);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const d = new Date(epochMs + offsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function describeSighting(s: BotSighting, nowMs: number): SightingDescription {
  const participants =
    s.participant_count === null ? "人數不明" : s.participant_count === 0 ? "無人" : `${s.participant_count} 人`;
  const mapUrl = `https://maps.google.com/?q=${s.lat},${s.lng}`;
  const observed = Date.parse(s.observed_at);

  if (s.remaining_seconds === null) {
    const minutes = Math.max(0, Math.floor((nowMs - observed) / 60_000));
    return { participants, expiry: "尚未開始倒數", state: "unclaimed", seen: `${minutes} 分鐘前看到`, mapUrl };
  }
  const expiresAt = observed + s.remaining_seconds * 1000;
  const text = formatInOffset(expiresAt, s.observed_at);
  if (expiresAt <= nowMs) return { participants, expiry: `已到期（${text}）`, state: "expired", seen: null, mapUrl };
  return { participants, expiry: `到期 ${text}`, state: "active", seen: null, mapUrl };
}
