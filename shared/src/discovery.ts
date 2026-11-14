/** Discovery 的 Region 與鋪點。全是純函式：輸入邊界與間距，輸出排好順序的點。 */

export interface Region {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const MAX_REGION_KM = 10;
export const DEFAULT_MINUTES_PER_POINT = 3;
/** 超過這個點數開跑前要再確認一次。 */
export const CONFIRM_ABOVE_POINTS = 30;

const M_PER_DEG_LAT = 111_320;
const midLat = (r: Region) => (r.south + r.north) / 2;
const mPerDegLng = (r: Region) => M_PER_DEG_LAT * Math.cos((midLat(r) * Math.PI) / 180);

export function regionSizeKm(r: Region): { widthKm: number; heightKm: number } {
  return {
    widthKm: ((r.east - r.west) * mPerDegLng(r)) / 1000,
    heightKm: ((r.north - r.south) * M_PER_DEG_LAT) / 1000,
  };
}

/** Region 依間距切出的欄數與列數（ceil，至少 1）。 */
export function gridSize(r: Region, spacingM: number): { cols: number; rows: number } {
  const { widthKm, heightKm } = regionSizeKm(r);
  return {
    cols: Math.max(1, Math.ceil((widthKm * 1000) / spacingM - 1e-9)),
    rows: Math.max(1, Math.ceil((heightKm * 1000) / spacingM - 1e-9)),
  };
}

/**
 * 把 Region 切成 ceil(邊長 / 間距) 欄 × 列的等寬格子，每格取中心當 Waypoint，所以點一定在 Region 內。
 * 蛇形：從南排開始，南排由西往東，下一排由東往西，依此類推，換排時不用跳回去。
 */
export function gridPoints(r: Region, spacingM: number): { lat: number; lng: number }[] {
  const { cols, rows } = gridSize(r, spacingM);
  const points: { lat: number; lng: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const lat = r.south + ((row + 0.5) * (r.north - r.south)) / rows;
    for (let k = 0; k < cols; k++) {
      const col = row % 2 === 0 ? k : cols - 1 - k;
      points.push({ lat, lng: r.west + ((col + 0.5) * (r.east - r.west)) / cols });
    }
  }
  return points;
}

export type DiscoveryPlan =
  | {
      ok: true;
      points: { lat: number; lng: number }[];
      estimateMs: number;
      /** history＝用過去 quiet 的平均耗時；default＝每點 3 分鐘。 */
      estimateSource: "history" | "default";
      needsConfirm: boolean;
    }
  | { ok: false; reason: string };

/** 開跑前的全部判斷：Region 大小上限、點數、預估時間、要不要再確認。 */
export function planDiscovery(input: { region: Region; spacingM: number; avgMsPerPoint: number | null }): DiscoveryPlan {
  const { region, spacingM, avgMsPerPoint } = input;
  if (!(spacingM > 0)) return { ok: false, reason: "間距要是正數" };
  const { widthKm, heightKm } = regionSizeKm(region);
  if (!(widthKm > 0 && heightKm > 0)) return { ok: false, reason: "Region 的寬與高都要大於 0" };
  if (widthKm > MAX_REGION_KM || heightKm > MAX_REGION_KM) {
    return {
      ok: false,
      reason: `Region 最大 ${MAX_REGION_KM} km × ${MAX_REGION_KM} km；目前是 ${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km，請縮小`,
    };
  }
  const points = gridPoints(region, spacingM);
  const history = avgMsPerPoint !== null && avgMsPerPoint > 0;
  const perPoint = history ? avgMsPerPoint : DEFAULT_MINUTES_PER_POINT * 60_000;
  return {
    ok: true,
    points,
    estimateMs: Math.round(points.length * perPoint),
    estimateSource: history ? "history" : "default",
    needsConfirm: points.length > CONFIRM_ABOVE_POINTS,
  };
}
