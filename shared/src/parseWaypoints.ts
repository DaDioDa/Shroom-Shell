export interface ParsedWaypoint {
  lat: number;
  lng: number;
  label: string;
  /** 公尺；null = 沒指定（用 Batch 的預設半徑）。 */
  radius: number | null;
  /** 遊戲內 Spot 的名稱（Postcard Check 用）；沒寫就不帶這個欄位。 */
  spotName?: string;
}

export interface ParseError {
  line: number;
  text: string;
  reason: string;
}

const LINE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s+(.*))?$/;

/** 行尾的 ` @Spot Name`（或整段標籤就是 `@Spot Name`）。 */
const SPOT = /(?:^|\s)@(.*)$/;

const RADIUS = /^r=(-?[0-9]+(?:[.][0-9]+)?)(?:\s+(.*))?$/i;

/** 解析多行 `lat,lng [r=公尺] [標籤] [@Spot Name]`。空行略過；壞掉的行（行號從 1 起算）列在 errors。 */
export function parseWaypointText(text: string): { waypoints: ParsedWaypoint[]; errors: ParseError[] } {
  const waypoints: ParsedWaypoint[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = LINE.exec(line);
    if (!m) {
      errors.push({ line: i + 1, text: raw, reason: "格式應為 lat,lng [r=公尺] [標籤] [@Spot Name]" });
      return;
    }
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat < -90 || lat > 90) {
      errors.push({ line: i + 1, text: raw, reason: "緯度需在 -90 到 90 之間" });
      return;
    }
    if (lng < -180 || lng > 180) {
      errors.push({ line: i + 1, text: raw, reason: "經度需在 -180 到 180 之間" });
      return;
    }
    let label = (m[3] ?? "").trim();
    let radius: number | null = null;
    const rm = RADIUS.exec(label);
    if (rm) {
      radius = Number(rm[1]);
      if (!(radius > 0)) {
        errors.push({ line: i + 1, text: raw, reason: "半徑（r=）需是正數公尺" });
        return;
      }
      label = (rm[2] ?? "").trim();
    }
    let spotName: string | undefined;
    const sm = SPOT.exec(label);
    if (sm) {
      spotName = sm[1]!.trim();
      if (!spotName) {
        errors.push({ line: i + 1, text: raw, reason: "@ 後面要接 Spot Name" });
        return;
      }
      label = label.slice(0, sm.index).trim();
    }
    waypoints.push({ lat, lng, label, radius, ...(spotName ? { spotName } : {}) });
  });
  return { waypoints, errors };
}
