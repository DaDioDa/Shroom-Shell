/** Region 編輯器的幾何。全是純函式：輸入 Region 與間距，輸出對齊整數格的新 Region。 */
import { gridPoints, gridSize, type Region } from "./discovery.js";

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

export interface LatLng {
  lat: number;
  lng: number;
}
export type Corner = "nw" | "ne" | "sw" | "se";
export type Edge = "n" | "s" | "e" | "w";

/** 「放一個 Region」的預設邊長（公尺）。 */
export const DEFAULT_REGION_M = 2000;

export const regionCenter = (r: Region): LatLng => ({ lat: (r.south + r.north) / 2, lng: (r.west + r.east) / 2 });

/** Region 的東西寬與南北高（公尺）。 */
export function regionSizeM(r: Region): { w: number; h: number } {
  return { w: (r.east - r.west) * mPerDegLng((r.south + r.north) / 2), h: (r.north - r.south) * M_PER_DEG_LAT };
}

export function regionFromCenter(c: LatLng, widthM: number, heightM: number): Region {
  const dLat = heightM / 2 / M_PER_DEG_LAT;
  const dLng = widthM / 2 / mPerDegLng(c.lat);
  return { south: c.lat - dLat, north: c.lat + dLat, west: c.lng - dLng, east: c.lng + dLng };
}

/** 邊長對齊間距的整數倍：max(1, round(邊長 / 間距)) × 間距。不設上限。 */
export function snapLength(lengthM: number, spacingM: number): number {
  return Math.max(1, Math.round(lengthM / spacingM)) * spacingM;
}

/** 在 center 放一個約 2 km × 2 km、對齊間距的 Region。 */
export function defaultRegion(center: LatLng, spacingM: number): Region {
  const side = snapLength(DEFAULT_REGION_M, spacingM);
  return regionFromCenter(center, side, side);
}

/** 拖某個角到 p：對角固定，寬高各自對齊，不會翻面。 */
export function dragCorner(r: Region, corner: Corner, p: LatLng, spacingM: number): Region {
  const sLat = corner[0] === "n" ? 1 : -1;
  const sLng = corner[1] === "e" ? 1 : -1;
  const fixLat = sLat > 0 ? r.south : r.north;
  const fixLng = sLng > 0 ? r.west : r.east;
  const h = snapLength(Math.max(0, (p.lat - fixLat) * sLat * M_PER_DEG_LAT), spacingM);
  const lat2 = fixLat + (sLat * h) / M_PER_DEG_LAT;
  const k = mPerDegLng((fixLat + lat2) / 2);
  const w = snapLength(Math.max(0, (p.lng - fixLng) * sLng * k), spacingM);
  const lng2 = fixLng + (sLng * w) / k;
  return { south: Math.min(fixLat, lat2), north: Math.max(fixLat, lat2), west: Math.min(fixLng, lng2), east: Math.max(fixLng, lng2) };
}

/** 拖某條邊到 p：對邊固定，只改那個方向，對齊且不翻面。 */
export function dragEdge(r: Region, edge: Edge, p: LatLng, spacingM: number): Region {
  const k = mPerDegLng((r.south + r.north) / 2);
  const snap = (m: number) => snapLength(Math.max(0, m), spacingM);
  if (edge === "n") return { ...r, north: r.south + snap((p.lat - r.south) * M_PER_DEG_LAT) / M_PER_DEG_LAT };
  if (edge === "s") return { ...r, south: r.north - snap((r.north - p.lat) * M_PER_DEG_LAT) / M_PER_DEG_LAT };
  if (edge === "e") return { ...r, east: r.west + snap((p.lng - r.west) * k) / k };
  return { ...r, west: r.east - snap((r.east - p.lng) * k) / k };
}

/** 平移：寬高不變。 */
export const shiftRegion = (r: Region, dLat: number, dLng: number): Region => ({
  south: r.south + dLat,
  north: r.north + dLat,
  west: r.west + dLng,
  east: r.east + dLng,
});

/** 改間距後，以中心為準把 Region 重新對齊。 */
export function resnapRegion(r: Region, spacingM: number): Region {
  const { w, h } = regionSizeM(r);
  return regionFromCenter(regionCenter(r), snapLength(w, spacingM), snapLength(h, spacingM));
}

/** 「跟半徑連動」時的間距：2 × 半徑（剛好無縫）。可以超過手動 slider 的上限。 */
export const linkedSpacing = (radiusM: number): number => 2 * radiusM;

export const regionCorners = (r: Region): Record<Corner, LatLng> => ({
  nw: { lat: r.north, lng: r.west },
  ne: { lat: r.north, lng: r.east },
  sw: { lat: r.south, lng: r.west },
  se: { lat: r.south, lng: r.east },
});

export const regionEdges = (r: Region): Record<Edge, LatLng> => {
  const c = regionCenter(r);
  return { n: { lat: r.north, lng: c.lng }, s: { lat: r.south, lng: c.lng }, e: { lat: c.lat, lng: r.east }, w: { lat: c.lat, lng: r.west } };
};

export type Coverage = { gap: true } | { gap: false; overlapPercent: number };

export interface GridStats {
  widthM: number;
  heightM: number;
  cols: number;
  rows: number;
  /** 實際格子尺寸（Region 沒對齊時是切出來的大小）。 */
  cellW: number;
  cellH: number;
  /** 蛇形順序的格子中心，與 gridPoints 相同。 */
  points: LatLng[];
  coverage: Coverage;
  coverageText: string;
}

/** 容許的浮點誤差（公尺）：格邊長與 2R 差不到這麼多就算剛好無縫。 */
const COVERAGE_TOLERANCE_M = 0.5;

/** 格子統計與覆蓋提示。格邊長 > 2R 有空隙，否則無縫、重疊約 (2R − 格邊長) / 2R。 */
export function gridStats(r: Region, spacingM: number, radiusM: number): GridStats {
  const { w, h } = regionSizeM(r);
  const { cols, rows } = gridSize(r, spacingM);
  const cellW = w / cols;
  const cellH = h / rows;
  const side = Math.max(cellW, cellH);
  const coverage: Coverage =
    side > 2 * radiusM + COVERAGE_TOLERANCE_M
      ? { gap: true }
      : { gap: false, overlapPercent: Math.max(0, Math.round(((2 * radiusM - side) / (2 * radiusM)) * 100)) };
  const coverageText = coverage.gap
    ? `有空隙：格子 ${Math.round(cellW)}×${Math.round(cellH)} m，但每格只掃 ${2 * radiusM}×${2 * radiusM} m`
    : `無縫，重疊約 ${coverage.overlapPercent}%`;
  return { widthM: w, heightM: h, cols, rows, cellW, cellH, points: gridPoints(r, spacingM), coverage, coverageText };
}
