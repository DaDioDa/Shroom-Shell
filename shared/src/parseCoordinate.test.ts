import { describe, expect, it } from "vitest";
import { parseCoordinate } from "./parseCoordinate.js";

const ok = (lat: number, lng: number) => ({ ok: true, lat, lng });

describe("parseCoordinate", () => {
  it("逗號分隔的負座標", () => {
    expect(parseCoordinate("-15.5885002842, -67.2518859431")).toEqual(ok(-15.5885002842, -67.2518859431));
  });
  it("空白分隔、前後有空白", () => {
    expect(parseCoordinate("  25.033964   121.564468 ")).toEqual(ok(25.033964, 121.564468));
  });
  it("全形逗號與括號", () => {
    expect(parseCoordinate("(25.03，121.56)")).toEqual(ok(25.03, 121.56));
  });
  it("整數座標", () => {
    expect(parseCoordinate("25,121")).toEqual(ok(25, 121));
  });
  it("Google Maps 連結", () => {
    expect(parseCoordinate("https://www.google.com/maps/@-33.8688,151.2093,12z")).toEqual(ok(-33.8688, 151.2093));
  });
  it("緯度超出範圍", () => {
    const r = parseCoordinate("95, 121");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: expect.stringContaining("範圍") });
  });
  it("經度超出範圍", () => {
    expect(parseCoordinate("25, 181").ok).toBe(false);
  });
  it("空字串", () => {
    expect(parseCoordinate("   ").ok).toBe(false);
  });
  it("只有一個數字或多出文字都不接受", () => {
    expect(parseCoordinate("25.03").ok).toBe(false);
    expect(parseCoordinate("25.03, 121.56, 17").ok).toBe(false);
    expect(parseCoordinate("台北 101").ok).toBe(false);
  });
});
