/** bot `check` stdout 的單行 JSON（格式見 pikmin_bloom_bot 的 cli.md）。frame／postcard 是絕對路徑。 */
export type CheckResult =
  | {
      found: true;
      name: string;
      spot_name: string;
      lat: number;
      lng: number;
      /** 0＝Unclaimed，null＝讀不到。 */
      participant_count: number | null;
      /** null＝尚未開始倒數。 */
      remaining_seconds: number | null;
      observed_at: string;
      frame: string;
      postcard: string | null;
    }
  | { found: false; spot_name: string; unread: number }
  | {
      found: null;
      spot_name: string;
      reason: string;
      /** 以下只有讀到才有。 */
      name?: string;
      participant_count?: number | null;
      lat?: number;
      lng?: number;
    };

/** 一個 Waypoint 的 Postcard Check 結果；圖片網址由後端依 run 資料夾補上（檔案不在就是 null）。 */
export interface CheckOutcome {
  index: number;
  waypointId: number;
  result: CheckResult;
  frameUrl: string | null;
  postcardUrl: string | null;
}

export interface PostcardCheckParams {
  listId: number;
}

export type CheckKind = "found" | "missing" | "unfinished";

export interface CheckDescription {
  kind: CheckKind;
  title: string;
  /** 找到：到期時間或「尚未開始倒數」；其他：一句說明。 */
  message: string;
  /** 找到：Participant Count 的文字；其他為 null。 */
  participants: string | null;
  note: string | null;
  /** 中止時已讀到的欄位（種類、人數），照樣顯示。 */
  partial: string[];
  mapUrl: string | null;
}

const countText = (n: number | null) => (n === null ? "人數不明" : n === 0 ? "無人" : `${n} 人`);

/** 以 observed_at 自己的時區顯示 `YYYY-MM-DD HH:mm`。 */
function formatInOffset(epochMs: number, observedAt: string): string {
  const m = observedAt.match(/([+-])(\d{2}):?(\d{2})$/);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const d = new Date(epochMs + offsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** `check` 的答案 → 卡片要顯示的文字。 */
export function describePostcardCheck(r: CheckResult, nowMs: number): CheckDescription {
  if (r.found === true) {
    let message = "尚未開始倒數";
    if (r.remaining_seconds !== null) {
      const at = Date.parse(r.observed_at) + r.remaining_seconds * 1000;
      const text = formatInOffset(at, r.observed_at);
      message = at <= nowMs ? `已到期（${text}）` : `到期 ${text}`;
    }
    return { kind: "found", title: r.name, message, participants: countText(r.participant_count), note: null, partial: [], mapUrl: `https://maps.google.com/?q=${r.lat},${r.lng}` };
  }
  if (r.found === false) {
    return {
      kind: "missing",
      title: "沒找到",
      message: "起點畫面上沒有這個 Spot Name",
      participants: null,
      note: r.unread > 0 ? `可能有 ${r.unread} 顆沒讀到` : null,
      partial: [],
      mapUrl: null,
    };
  }
  const partial: string[] = [];
  if (r.name) partial.push(r.name);
  if (r.participant_count !== undefined) partial.push(countText(r.participant_count));
  const mapUrl = r.lat !== undefined && r.lng !== undefined ? `https://maps.google.com/?q=${r.lat},${r.lng}` : null;
  return { kind: "unfinished", title: "沒讀完", message: r.reason, participants: null, note: null, partial, mapUrl };
}

/** 沒有 Spot Name（null 或全空白）的 Waypoint；Postcard Check 開始前用。 */
export function missingSpotNames<T extends { spotName: string | null }>(waypoints: T[]): T[] {
  return waypoints.filter((w) => !w.spotName?.trim());
}
