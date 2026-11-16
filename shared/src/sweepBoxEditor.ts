import type { LatLng } from "./regionEditor.js";
import { clampSlider, SLIDER_SPECS } from "./sliders.js";
import { sweepAreaSquare } from "./sweepArea.js";

const METERS_PER_DEGREE = 111_320;

export type BoxCorner = "nw" | "ne" | "se" | "sw";

/** Waypoint 的 2R 正方形（地圖上可拖的框）的四個角。 */
export function sweepBoxCorners(center: LatLng, radiusM: number): Record<BoxCorner, LatLng> {
  const b = sweepAreaSquare(center, radiusM);
  return {
    nw: { lat: b.north, lng: b.west },
    ne: { lat: b.north, lng: b.east },
    se: { lat: b.south, lng: b.east },
    sw: { lat: b.south, lng: b.west },
  };
}

/** 拖框的角：正方形維持以 Waypoint 為中心，半徑取角到中心南北、東西較遠的公尺數，對齊半徑 slider 的範圍與步距。 */
export function radiusFromCorner(center: LatLng, p: LatLng): number {
  const dy = Math.abs(p.lat - center.lat) * METERS_PER_DEGREE;
  const dx = Math.abs(p.lng - center.lng) * METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180);
  return clampSlider(SLIDER_SPECS.radius, Math.max(dx, dy));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 拖框本體：中心跟著滑鼠從 from 到 to 的位移走，夾在合法經緯度內。 */
export function moveBox(center: LatLng, from: LatLng, to: LatLng): LatLng {
  return { lat: clamp(center.lat + to.lat - from.lat, -90, 90), lng: clamp(center.lng + to.lng - from.lng, -180, 180) };
}
