import { describe, expect, it } from "vitest";
import { gridPoints, planDiscovery, regionSizeKm, type Region } from "./discovery.js";

const M_PER_DEG_LAT = 111_320;
/** 以中心點與公尺寬高造一個 Region，測試才讀得懂。 */
function region(widthM: number, heightM: number, lat = 25, lng = 121): Region {
  const dLat = heightM / M_PER_DEG_LAT / 2;
  const dLng = widthM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)) / 2;
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}
const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lng - b.lng) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180));

describe("regionSizeKm", () => {
  it("量出東西與南北的公里數", () => {
    const s = regionSizeKm(region(3000, 2000));
    expect(s.widthKm).toBeCloseTo(3, 2);
    expect(s.heightKm).toBeCloseTo(2, 2);
  });
});

describe("gridPoints：3 km × 2 km、間距 1 km", () => {
  const r = region(3000, 2000);
  const pts = gridPoints(r, 1000);

  it("每個 1 km 格子一個點，共 6 點，都落在 Region 內", () => {
    expect(pts).toHaveLength(6);
    for (const p of pts) {
      expect(p.lat).toBeGreaterThan(r.south);
      expect(p.lat).toBeLessThan(r.north);
      expect(p.lng).toBeGreaterThan(r.west);
      expect(p.lng).toBeLessThan(r.east);
    }
  });

  it("蛇形：南排由西往東，北排由東往西，相鄰兩點都只差一格", () => {
    expect(pts[0]!.lng).toBeLessThan(pts[1]!.lng);
    expect(pts[1]!.lng).toBeLessThan(pts[2]!.lng);
    expect(pts[3]!.lng).toBeGreaterThan(pts[4]!.lng);
    expect(pts[4]!.lng).toBeGreaterThan(pts[5]!.lng);
    expect(pts[0]!.lat).toBeLessThan(pts[3]!.lat); // 先走南排
    expect(pts[2]!.lng).toBeCloseTo(pts[3]!.lng, 9); // 換排時經度不變，不用跳回去
    for (let i = 1; i < pts.length; i++) expect(distM(pts[i - 1]!, pts[i]!)).toBeCloseTo(1000, -1);
  });

  it("間距除不盡時格子等分，點數進位", () => {
    expect(gridPoints(region(2500, 1000), 1000)).toHaveLength(3);
  });

  it("間距比 Region 還大時仍有一個點（中心）", () => {
    const [p] = gridPoints(region(500, 500), 1000);
    expect(p!.lat).toBeCloseTo(25, 6);
  });
});

describe("planDiscovery", () => {
  const base = { spacingM: 1000, avgMsPerPoint: null };

  it("超過 10 km 拒絕並說明原因", () => {
    const wide = planDiscovery({ ...base, region: region(10_500, 2000) });
    expect(wide.ok).toBe(false);
    if (!wide.ok) expect(wide.reason).toMatch(/10 km/);
    const tall = planDiscovery({ ...base, region: region(2000, 10_500) });
    expect(tall.ok).toBe(false);
  });

  it("剛好 10 km 可以", () => {
    expect(planDiscovery({ ...base, region: region(9990, 9990) }).ok).toBe(true);
  });

  it("間距不是正數拒絕", () => {
    expect(planDiscovery({ region: region(3000, 2000), spacingM: 0, avgMsPerPoint: null }).ok).toBe(false);
  });

  it("沒有歷史資料時每點以 3 分鐘估", () => {
    const p = planDiscovery({ ...base, region: region(3000, 2000) });
    if (!p.ok) throw new Error(p.reason);
    expect(p.points).toHaveLength(6);
    expect(p.estimateMs).toBe(6 * 3 * 60_000);
    expect(p.estimateSource).toBe("default");
  });

  it("有歷史資料時用平均耗時", () => {
    const p = planDiscovery({ ...base, region: region(3000, 2000), avgMsPerPoint: 90_000 });
    if (!p.ok) throw new Error(p.reason);
    expect(p.estimateMs).toBe(6 * 90_000);
    expect(p.estimateSource).toBe("history");
  });

  it("30 點不用再確認，31 點要", () => {
    const thirty = planDiscovery({ ...base, region: region(6000, 5000) });
    if (!thirty.ok) throw new Error(thirty.reason);
    expect(thirty.points).toHaveLength(30);
    expect(thirty.needsConfirm).toBe(false);
    const more = planDiscovery({ ...base, region: region(6000, 6000), spacingM: 1000 });
    if (!more.ok) throw new Error(more.reason);
    expect(more.points).toHaveLength(36);
    expect(more.needsConfirm).toBe(true);
  });
});
