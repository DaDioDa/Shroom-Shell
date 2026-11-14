import { describe, expect, it } from "vitest";
import { parseMapsLink } from "./parseMapsLink.js";

const ok = (lat: number, lng: number) => ({ ok: true, lat, lng });

describe("parseMapsLink", () => {
  it("?q=lat,lng", () => {
    expect(parseMapsLink("https://www.google.com/maps?q=25.033964,121.564468")).toEqual(ok(25.033964, 121.564468));
  });
  it("@lat,lng,zoom", () => {
    expect(parseMapsLink("https://www.google.com/maps/@25.033964,121.564468,17z")).toEqual(ok(25.033964, 121.564468));
  });
  it("/place/名稱/@lat,lng", () => {
    expect(parseMapsLink("https://www.google.com/maps/place/Taipei+101/@25.0339639,121.5644722,17z/data=!4m6")).toEqual(
      ok(25.0339639, 121.5644722),
    );
  });
  it("!3d..!4d.. 優先於視窗中心的 @", () => {
    expect(
      parseMapsLink("https://www.google.com/maps/place/X/@10.0,20.0,15z/data=!3m1!4b1!4m5!3m4!1s0x0:0x1!8m2!3d25.1!4d121.2"),
    ).toEqual(ok(25.1, 121.2));
  });
  it("負的經緯度", () => {
    expect(parseMapsLink("https://www.google.com/maps/@-33.8688,-151.2093,12z")).toEqual(ok(-33.8688, -151.2093));
  });
  it("短網址回報無法解析", () => {
    const r = parseMapsLink("https://maps.app.goo.gl/AbCdEf123");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: expect.stringContaining("短網址") });
  });
  it("找不到座標或超出範圍都回報失敗", () => {
    expect(parseMapsLink("https://www.google.com/maps/place/Taipei").ok).toBe(false);
    expect(parseMapsLink("https://www.google.com/maps?q=99,121").ok).toBe(false);
  });
});
