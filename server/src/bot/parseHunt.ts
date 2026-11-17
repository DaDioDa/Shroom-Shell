import type { BotSighting } from "@shell/shared";

export function isSighting(v: unknown): v is BotSighting {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.target === "string" &&
    typeof s.lat === "number" &&
    typeof s.lng === "number" &&
    typeof s.spot_name === "string" &&
    typeof s.observed_at === "string" &&
    (s.participant_count === null || typeof s.participant_count === "number") &&
    (s.remaining_seconds === null || typeof s.remaining_seconds === "number")
  );
}

/** Sweep 進行中從 stderr 讀到的一筆 Sighting：沒有 map_position、frame，Postcard 是 bot 印的路徑。 */
export interface LiveSighting {
  target: string;
  spot_name: string;
  lat: number;
  lng: number;
  participant_count: number | null;
  remaining_seconds: number | null;
  /** 讀到這筆的時間（本機時區的 ISO 8601）。 */
  observed_at: string;
  /** bot 印的 Postcard 路徑（通常是絕對路徑）；沒截到為 null。 */
  postcardPath: string | null;
}

/** 本機時區、含時差的 ISO 8601（例如 2026-11-14T14:08:00+08:00）。 */
export function localIso(d: Date): string {
  const p = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(off / 60)}:${p(off % 60)}`;
}

/**
 * `hunt` 在 Sweep 進行中每找到一顆 Target 就在 stderr 印四行（cli.md「每筆 Sighting」）：
 *
 *     【找到 Target】巨大 輝煌蘑菇｜範例地點
 *       參與人數 0｜尚未開始倒數        （或「到期 2026-11-14 22:30」、「參與人數 不明」）
 *       地圖 https://maps.google.com/?q=25.033964,121.564468
 *       Postcard F:\...\runs\20261114-140728\postcard-01.png   （或「（沒有）」）
 *
 * 一行一行餵進來，讀到 Postcard 那行就湊成一筆。缺地圖座標的不算（放不上地圖）。
 */
export class HuntStderrReader {
  private pending: Partial<LiveSighting> | null = null;
  constructor(private readonly now: () => Date = () => new Date()) {}

  feed(line: string): LiveSighting | null {
    const head = line.match(/^【找到 Target】(.+?)｜(.+)$/);
    if (head) {
      this.pending = { target: head[1]!.trim(), spot_name: head[2]!.trim() };
      return null;
    }
    const p = this.pending;
    if (!p) return null;
    const status = line.match(/^\s+參與人數 (\d+|不明)｜(.+)$/);
    if (status) {
      p.participant_count = status[1] === "不明" ? null : Number(status[1]);
      p.remaining_seconds = this.remaining(status[2]!.trim());
      return null;
    }
    const map = line.match(/^\s+地圖 \S*?[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (map) {
      p.lat = Number(map[1]);
      p.lng = Number(map[2]);
      return null;
    }
    const postcard = line.match(/^\s+Postcard (.+)$/);
    if (!postcard) return null;
    this.pending = null;
    if (p.lat === undefined || p.lng === undefined) return null;
    const path = postcard[1]!.trim();
    return {
      target: p.target!,
      spot_name: p.spot_name!,
      lat: p.lat,
      lng: p.lng,
      participant_count: p.participant_count ?? null,
      remaining_seconds: p.remaining_seconds ?? null,
      observed_at: localIso(this.now()),
      postcardPath: path === "（沒有）" ? null : path,
    };
  }

  /** 「到期 YYYY-MM-DD HH:MM」（bot 所在機器的時間，也就是本機）→ 剩幾秒；尚未開始倒數或看不懂為 null。 */
  private remaining(text: string): number | null {
    const m = text.match(/^到期 (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m) return null;
    const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
    const expires = new Date(y, mo - 1, d, h, mi).getTime();
    return Math.max(0, Math.round((expires - this.now().getTime()) / 1000));
  }
}

/**
 * 解析 `hunt` 的 stdout。
 * - Sighting 陣列：正常結果（`[]` 表示沒找到）
 * - 空白：冷啟動就中止，回 null
 */
export function parseHuntStdout(stdout: string): BotSighting[] | null {
  const text = stdout.trim();
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`bot stdout 不是合法 JSON：${text.slice(0, 80)}`);
  }
  if (!Array.isArray(data)) throw new Error("bot stdout 不是 Sighting 陣列");
  if (!data.every(isSighting)) throw new Error("bot stdout 有格式不對的 Sighting");
  return data;
}
