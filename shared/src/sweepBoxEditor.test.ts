import { describe, expect, it } from "vitest";
import { moveBox, radiusFromCorner, sweepBoxCorners } from "./sweepBoxEditor.js";
import { sweepAreaSquare } from "./sweepArea.js";

const M = 111_320;
const center = { lat: 25, lng: 121 };
const north = (m: number) => m / M;
const east = (m: number) => m / (M * Math.cos((25 * Math.PI) / 180));

describe("sweepBoxCorners", () => {
  it("四個角落就是 2R 正方形的四角", () => {
    const b = sweepAreaSquare(center, 500);
    expect(sweepBoxCorners(center, 500)).toEqual({
      nw: { lat: b.north, lng: b.west },
      ne: { lat: b.north, lng: b.east },
      se: { lat: b.south, lng: b.east },
      sw: { lat: b.south, lng: b.west },
    });
  });
});

describe("radiusFromCorner", () => {
  it("取南北、東西兩個方向裡較遠的公尺數當半徑", () => {
    expect(radiusFromCorner(center, { lat: 25 + north(600), lng: 121 + east(200) })).toBe(600);
    expect(radiusFromCorner(center, { lat: 25 - north(100), lng: 121 - east(800) })).toBe(800);
  });
  it("對齊半徑 slider 的 50 m 步距", () => {
    expect(radiusFromCorner(center, { lat: 25 + north(612), lng: 121 })).toBe(600);
    expect(radiusFromCorner(center, { lat: 25 + north(637), lng: 121 })).toBe(650);
  });
  it("夾在半徑 slider 的範圍內（100～2000 m）", () => {
    expect(radiusFromCorner(center, { lat: 25 + north(10), lng: 121 })).toBe(100);
    expect(radiusFromCorner(center, { lat: 25 + north(9000), lng: 121 })).toBe(2000);
  });
});

describe("moveBox", () => {
  it("中心跟著拖曳的位移走", () => {
    const r = moveBox(center, { lat: 25.01, lng: 121.02 }, { lat: 25.03, lng: 121.01 });
    expect(r.lat).toBeCloseTo(25.02, 10);
    expect(r.lng).toBeCloseTo(120.99, 10);
  });
  it("緯度、經度不會超出合法範圍", () => {
    expect(moveBox({ lat: 89, lng: 179 }, { lat: 0, lng: 0 }, { lat: 5, lng: 5 })).toEqual({ lat: 90, lng: 180 });
    expect(moveBox({ lat: -89, lng: -179 }, { lat: 0, lng: 0 }, { lat: -5, lng: -5 })).toEqual({ lat: -90, lng: -180 });
  });
});
