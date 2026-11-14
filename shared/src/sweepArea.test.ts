import { describe, expect, it } from "vitest";
import { sweepAreaColor, sweepAreaSquare, sweepRadius } from "./sweepArea.js";

describe("sweepRadius", () => {
  it("Waypoint 有半徑用自己的，沒有（null）就用預設", () => {
    expect(sweepRadius({ radius: 250 }, 500)).toBe(250);
    expect(sweepRadius({ radius: null }, 500)).toBe(500);
  });
});

describe("sweepAreaSquare：以 Waypoint 為中心、邊長 2R 的正方形", () => {
  it("赤道上：南北、東西各約 R 公尺（1 度約 111.32 km）", () => {
    const b = sweepAreaSquare({ lat: 0, lng: 100 }, 1000);
    expect(b.south).toBeCloseTo(-1000 / 111320, 6);
    expect(b.north).toBeCloseTo(1000 / 111320, 6);
    expect(b.west).toBeCloseTo(100 - 1000 / 111320, 6);
    expect(b.east).toBeCloseTo(100 + 1000 / 111320, 6);
  });

  it("中緯度：東西的度數依 cos(緯度) 放大，使實際邊長仍是 2R；中心在正中央", () => {
    const lat = 60;
    const b = sweepAreaSquare({ lat, lng: 10 }, 500);
    const northSouthMeters = (b.north - b.south) * 111320;
    const eastWestMeters = (b.east - b.west) * 111320 * Math.cos((lat * Math.PI) / 180);
    expect(northSouthMeters).toBeCloseTo(1000, 3);
    expect(eastWestMeters).toBeCloseTo(1000, 3);
    expect((b.north + b.south) / 2).toBeCloseTo(lat, 9);
    expect((b.east + b.west) / 2).toBeCloseTo(10, 9);
  });
});

describe("sweepAreaColor：綠＝是、紅＝不是、灰＝無法判斷", () => {
  it("依 verdict 決定", () => {
    expect(sweepAreaColor(true)).toBe("green");
    expect(sweepAreaColor(false)).toBe("red");
    expect(sweepAreaColor(null)).toBe("gray");
  });
});
