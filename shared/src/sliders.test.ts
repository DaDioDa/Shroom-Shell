import { describe, expect, it } from "vitest";
import { SLIDER_SPECS, clampSlider, parseSliderValue } from "./sliders.js";

describe("SLIDER_SPECS", () => {
  it("半徑：100～2000、步距 50、預設 500", () => {
    expect(SLIDER_SPECS.radius).toEqual({ min: 100, max: 2000, step: 50, default: 500 });
  });
  it("間距：200～3000、步距 100、預設 1000", () => {
    expect(SLIDER_SPECS.spacing).toEqual({ min: 200, max: 3000, step: 100, default: 1000 });
  });
  it("skip-crowded：0～10、步距 1、預設 0", () => {
    expect(SLIDER_SPECS.skipCrowded).toEqual({ min: 0, max: 10, step: 1, default: 0 });
  });
});

describe("clampSlider", () => {
  it("範圍內維持原值", () => {
    expect(clampSlider(SLIDER_SPECS.radius, 750)).toBe(750);
  });
  it("低於下限夾到下限", () => {
    expect(clampSlider(SLIDER_SPECS.radius, 10)).toBe(100);
    expect(clampSlider(SLIDER_SPECS.skipCrowded, -3)).toBe(0);
  });
  it("高於上限夾到上限", () => {
    expect(clampSlider(SLIDER_SPECS.radius, 99999)).toBe(2000);
    expect(clampSlider(SLIDER_SPECS.spacing, 4000)).toBe(3000);
  });
  it("不在步距上的值對齊最近的步距", () => {
    expect(clampSlider(SLIDER_SPECS.radius, 530)).toBe(550);
    expect(clampSlider(SLIDER_SPECS.spacing, 1240)).toBe(1200);
  });
  it("非數字回預設值", () => {
    expect(clampSlider(SLIDER_SPECS.radius, NaN)).toBe(500);
    expect(clampSlider(SLIDER_SPECS.spacing, "abc")).toBe(1000);
    expect(clampSlider(SLIDER_SPECS.skipCrowded, undefined)).toBe(0);
    expect(clampSlider(SLIDER_SPECS.radius, Infinity)).toBe(500);
  });
});

describe("parseSliderValue", () => {
  it("讀不到（null）回預設值", () => {
    expect(parseSliderValue(SLIDER_SPECS.radius, null)).toBe(500);
  });
  it("格式壞掉回預設值", () => {
    expect(parseSliderValue(SLIDER_SPECS.radius, "xyz")).toBe(500);
    expect(parseSliderValue(SLIDER_SPECS.radius, "")).toBe(500);
  });
  it("合法字串轉成數字並夾值", () => {
    expect(parseSliderValue(SLIDER_SPECS.radius, "800")).toBe(800);
    expect(parseSliderValue(SLIDER_SPECS.radius, "50000")).toBe(2000);
  });
});
