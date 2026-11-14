export interface ParsedWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface ParseError {
  line: number;
  text: string;
  reason: string;
}

const LINE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s+(.*))?$/;

/** 解析多行 `lat,lng [標籤]`。空行略過；壞掉的行（行號從 1 起算）列在 errors。 */
export function parseWaypointText(text: string): { waypoints: ParsedWaypoint[]; errors: ParseError[] } {
  const waypoints: ParsedWaypoint[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = LINE.exec(line);
    if (!m) {
      errors.push({ line: i + 1, text: raw, reason: "格式應為 lat,lng [標籤]" });
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
    waypoints.push({ lat, lng, label: (m[3] ?? "").trim() });
  });
  return { waypoints, errors };
}
