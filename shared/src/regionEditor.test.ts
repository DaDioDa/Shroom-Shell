import { describe, expect, it } from "vitest";
import { gridPoints, planDiscovery, regionSizeKm, type Region } from "./discovery.js";
import {
  defaultRegion, dragCorner, gridStats, dragEdge, linkedSpacing, regionCenter, regionFromCenter, regionSizeM, resnapRegion, shiftRegion, snapLength,
} from "./regionEditor.js";
import { SLIDER_SPECS } from "./sliders.js";

const M = 111_320;
const C = { lat: 25, lng: 121 };
const mLng = Math.cos((C.lat * Math.PI) / 180) * M;
/** 以公尺偏移算出座標，測試才讀得懂。 */
const at = (dxM: number, dyM: number) => ({ lat: C.lat + dyM / M, lng: C.lng + dxM / mLng });
const size = (r: Region) => regionSizeM(r);
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 0);

describe("snapLength：對齊整數格", () => {
  it("四捨五入到間距的整數倍，至少一格", () => {
    expect(snapLength(2000, 1000)).toBe(2000);
    expect(snapLength(2400, 1000)).toBe(2000);
    expect(snapLength(2600, 1000)).toBe(3000);
    expect(snapLength(10, 1000)).toBe(1000);
    expect(snapLength(0, 1000)).toBe(1000);
  });
});

describe("regionFromCenter", () => {
  it("中心與公尺邊長造出 Region", () => {
    const r = regionFromCenter(C, 3000, 2000);
    near(size(r).w, 3000);
    near(size(r).h, 2000);
    expect(regionCenter(r).lat).toBeCloseTo(C.lat, 9);
    expect(regionCenter(r).lng).toBeCloseTo(C.lng, 9);
  });
});

describe("defaultRegion：放一個 Region", () => {
  it("間距 1000：2 km × 2 km", () => {
    const s = size(defaultRegion(C, 1000));
    near(s.w, 2000);
    near(s.h, 2000);
  });
  it("間距 700：約 2 km 並對齊（2100）", () => {
    const s = size(defaultRegion(C, 700));
    near(s.w, 2100);
    near(s.h, 2100);
  });
  it("間距 4000：至少一格（4000）", () => {
    near(size(defaultRegion(C, 4000)).w, 4000);
  });
});

describe("dragCorner：對角固定、兩個方向都對齊", () => {
  const r = regionFromCenter(C, 2000, 2000);
  it("拖東北角：西南角不動，寬高對齊", () => {
    const next = dragCorner(r, "ne", at(1000 + 1400, 1000 + 600), 1000);
    expect(next.south).toBeCloseTo(r.south, 9);
    expect(next.west).toBeCloseTo(r.west, 9);
    near(size(next).w, 3000); // 1000 + 1400 + ... → 3400 → 3000
    near(size(next).h, 3000); // 2600 → 3000
  });
  it("拖西南角：東北角不動", () => {
    const next = dragCorner(r, "sw", at(-1000 - 1100, -1000 - 400), 1000);
    expect(next.north).toBeCloseTo(r.north, 9);
    expect(next.east).toBeCloseTo(r.east, 9);
    near(size(next).w, 3000);
    near(size(next).h, 2000);
  });
  it("拖東南角、西北角：各自對角固定", () => {
    const se = dragCorner(r, "se", at(2000, -2000), 1000);
    expect(se.north).toBeCloseTo(r.north, 9);
    expect(se.west).toBeCloseTo(r.west, 9);
    const nw = dragCorner(r, "nw", at(-2000, 2000), 1000);
    expect(nw.south).toBeCloseTo(r.south, 9);
    expect(nw.east).toBeCloseTo(r.east, 9);
  });
  it("拖過對角不翻面：最小一格，south < north、west < east", () => {
    const next = dragCorner(r, "ne", at(-3000, -3000), 1000);
    expect(next.south).toBeLessThan(next.north);
    expect(next.west).toBeLessThan(next.east);
    near(size(next).w, 1000);
    near(size(next).h, 1000);
    expect(next.south).toBeCloseTo(r.south, 9);
    expect(next.west).toBeCloseTo(r.west, 9);
  });
});

describe("dragEdge：對邊固定、只改一個方向", () => {
  const r = regionFromCenter(C, 2000, 2000);
  it("拖北邊：南邊與東西中心不變、公尺寬不變，高度對齊", () => {
    const next = dragEdge(r, "n", at(0, 2000), 1000);
    expect(next.south).toBeCloseTo(r.south, 9);
    expect((next.west + next.east) / 2).toBeCloseTo((r.west + r.east) / 2, 9);
    near(size(next).w, size(r).w);
    near(size(next).h, 3000);
  });
  it("拖南、東、西邊：各自對邊固定", () => {
    const s = dragEdge(r, "s", at(0, -3000), 1000);
    expect(s.north).toBeCloseTo(r.north, 9);
    near(size(s).h, 4000);
    const e = dragEdge(r, "e", at(3200, 0), 1000); // 西邊在 -1000，寬 4200 → 4000
    expect(e.west).toBeCloseTo(r.west, 9);
    near(size(e).w, 4000);
  });
  it("拖西邊", () => {
    const w = dragEdge(r, "w", at(-1000 - 1000, 0), 1000);
    expect(w.east).toBeCloseTo(r.east, 9);
    near(size(w).w, 3000);
    expect(w.south).toBe(r.south);
  });
  it("拖過對邊不翻面：最小一格", () => {
    const next = dragEdge(r, "n", at(0, -5000), 1000);
    expect(next.south).toBeCloseTo(r.south, 9);
    near(size(next).h, 1000);
    expect(next.north).toBeGreaterThan(next.south);
  });
});

describe("shiftRegion：平移", () => {
  it("寬高不變、中心移動", () => {
    const r = regionFromCenter(C, 3000, 2000);
    const next = shiftRegion(r, 0.01, -0.02);
    near(size(next).w, size(r).w);
    near(size(next).h, size(r).h);
    expect(regionCenter(next).lat).toBeCloseTo(C.lat + 0.01, 9);
    expect(regionCenter(next).lng).toBeCloseTo(C.lng - 0.02, 9);
  });
});

describe("resnapRegion：改間距時以中心重新對齊", () => {
  it("中心不動、寬高變成新間距的整數倍", () => {
    const r = regionFromCenter(C, 3000, 2000);
    const next = resnapRegion(r, 1200);
    near(size(next).w, 3600);
    near(size(next).h, 2400);
    expect(regionCenter(next).lat).toBeCloseTo(C.lat, 9);
    expect(regionCenter(next).lng).toBeCloseTo(C.lng, 9);
  });
});

describe("超過 10 km：Region 不被夾住，但 planDiscovery 判定超過上限", () => {
  it("拖到 12 km 仍是 12 km", () => {
    const r = regionFromCenter(C, 2000, 2000);
    const next = dragCorner(r, "ne", at(12_000 - 1000, 500), 1000);
    near(size(next).w, 12_000);
    expect(regionSizeKm(next).widthKm).toBeGreaterThan(10);
    const plan = planDiscovery({ region: next, spacingM: 1000, avgMsPerPoint: null });
    expect(plan.ok).toBe(false);
  });
  it("拖回 10 km 以內又可以開始", () => {
    const big = regionFromCenter(C, 12_000, 2000);
    const back = dragEdge(big, "e", at(3000, 0), 1000);
    expect(planDiscovery({ region: back, spacingM: 1000, avgMsPerPoint: null }).ok).toBe(true);
  });
});

describe("linkedSpacing：連動間距", () => {
  it("2 × 半徑", () => {
    expect(linkedSpacing(500)).toBe(1000);
  });
  it("半徑 2000 → 4000，超過手動上限 3000 也不夾回去", () => {
    expect(linkedSpacing(SLIDER_SPECS.radius.max)).toBe(4000);
    expect(linkedSpacing(2000)).toBeGreaterThan(SLIDER_SPECS.spacing.max);
  });
});

describe("gridStats：欄、列、點數與實際格子尺寸", () => {
  it("3 km × 2 km、間距 1000：3 欄 × 2 列 = 6 點，格子 1000 × 1000", () => {
    const s = gridStats(regionFromCenter(C, 3000, 2000), 1000, 500);
    expect([s.cols, s.rows, s.points.length]).toEqual([3, 2, 6]);
    near(s.cellW, 1000);
    near(s.cellH, 1000);
    near(s.widthM, 3000);
    near(s.heightM, 2000);
  });
  it("點與 gridPoints 的蛇形順序一致", () => {
    const r = regionFromCenter(C, 3000, 2000);
    expect(gridStats(r, 1000, 500).points).toEqual(gridPoints(r, 1000));
  });
  it("沒對齊的 Region（匯入或舊資料）：格子是實際切出來的尺寸", () => {
    const s = gridStats(regionFromCenter(C, 2500, 1000), 1000, 500);
    expect([s.cols, s.rows]).toEqual([3, 1]);
    near(s.cellW, 2500 / 3);
  });
});

describe("gridStats 的覆蓋提示", () => {
  const r = regionFromCenter(C, 2000, 2000);
  it("格邊長 > 2R：有空隙", () => {
    const s = gridStats(r, 1000, 400); // 2R = 800 < 1000
    expect(s.coverage).toEqual({ gap: true });
    expect(s.coverageText).toMatch(/有空隙/);
  });
  it("格邊長 = 2R：無縫，重疊 0%", () => {
    const s = gridStats(r, 1000, 500);
    expect(s.coverage).toEqual({ gap: false, overlapPercent: 0 });
    expect(s.coverageText).toBe("無縫，重疊約 0%");
  });
  it("格邊長 < 2R：無縫，重疊 (2R − 格邊長) / 2R", () => {
    const s = gridStats(r, 1000, 625); // 2R = 1250 → 20%
    expect(s.coverage).toEqual({ gap: false, overlapPercent: 20 });
    expect(s.coverageText).toBe("無縫，重疊約 20%");
  });
  it("連動間距（2R）一律無縫、重疊 0%", () => {
    const s = gridStats(regionFromCenter(C, 4000, 4000), linkedSpacing(2000), 2000);
    expect(s.coverage).toEqual({ gap: false, overlapPercent: 0 });
  });
});

describe("B1：平移與拖南北邊後公尺寬不變、格數不變", () => {
  const base = () => regionFromCenter(C, 3000, 2000);
  const same = (before: Region, after: Region, rowsChange = false) => {
    const a = gridStats(before, 1000, 500);
    const b = gridStats(after, 1000, 500);
    expect([b.cols, rowsChange ? 0 : b.rows, Math.round(b.cellW)]).toEqual([a.cols, rowsChange ? 0 : a.rows, Math.round(a.cellW)]);
    expect(a.cols).toBe(3);
    expect(Math.abs(size(after).w - 3000)).toBeLessThan(1); // 間距整數倍的小容差
  };
  it("往南平移 11 m 與 1 km，cols、rows、cellW 不變", () => {
    for (const dLat of [-0.0001, -0.01, -0.5]) same(base(), shiftRegion(base(), dLat, 0));
  });
  it("往北平移，cols 不變", () => same(base(), shiftRegion(base(), 0.5, 0)));
  it("拖南邊拉高到 10 km，寬度與 cols 不變，高度對齊", () => {
    const r = dragEdge(base(), "s", at(0, -9000), 1000);
    same(base(), r, true);
    near(size(r).h, 10_000);
  });
  it("拖北邊拉高，cols 不變", () => same(base(), dragEdge(base(), "n", at(0, 9000), 1000), true));
});
