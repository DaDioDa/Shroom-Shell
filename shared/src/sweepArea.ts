const METERS_PER_DEGREE = 111_320;

/** Waypoint 有自己的半徑就用它，沒有就用 Batch 的預設值（公尺）。 */
export function sweepRadius(w: { radius: number | null }, defaultRadius: number): number {
  return w.radius ?? defaultRadius;
}

export interface LatLngBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** 以 Waypoint 為中心、邊長 2R（公尺）的正方形（Sweep Area）的經緯度範圍。 */
export function sweepAreaSquare(center: { lat: number; lng: number }, radiusMeters: number): LatLngBounds {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return {
    south: center.lat - dLat,
    north: center.lat + dLat,
    west: center.lng - dLng,
    east: center.lng + dLng,
  };
}

export type SweepAreaColor = "green" | "red" | "gray";

/** `quiet` 的答案 → 地圖正方形的顏色。true＝綠，false＝紅，null（無法判斷）＝灰。 */
export function sweepAreaColor(verdict: boolean | null): SweepAreaColor {
  return verdict === true ? "green" : verdict === false ? "red" : "gray";
}
