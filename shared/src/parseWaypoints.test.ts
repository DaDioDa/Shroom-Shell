import { describe, expect, it } from "vitest";
import { parseWaypointText } from "./parseWaypoints.js";

describe("parseWaypointText", () => {
  it("解析 lat,lng 與標籤", () => {
    const r = parseWaypointText("25.033964,121.564468 台北 101\n-33.8,151.2");
    expect(r.errors).toEqual([]);
    expect(r.waypoints).toEqual([
      { lat: 25.033964, lng: 121.564468, label: "台北 101" },
      { lat: -33.8, lng: 151.2, label: "" },
    ]);
  });

  it("逗號後可有空白，支援 CRLF，略過空行", () => {
    const r = parseWaypointText("1, 2 A\r\n\r\n   \r\n3,4\r\n");
    expect(r.waypoints).toEqual([
      { lat: 1, lng: 2, label: "A" },
      { lat: 3, lng: 4, label: "" },
    ]);
    expect(r.errors).toEqual([]);
  });

  it("壞行列出行號與原文，好行仍保留", () => {
    const r = parseWaypointText("1,2 ok\nabc\n91,0 太北\n0,181 太東\n5,6");
    expect(r.waypoints.map((w) => w.lat)).toEqual([1, 5]);
    expect(r.errors.map((e) => [e.line, e.text])).toEqual([
      [2, "abc"],
      [3, "91,0 太北"],
      [4, "0,181 太東"],
    ]);
    expect(r.errors.every((e) => e.reason.length > 0)).toBe(true);
  });

  it("缺經度或多餘逗號是錯誤", () => {
    const r = parseWaypointText("1\n1,2,3\n,2");
    expect(r.waypoints).toEqual([]);
    expect(r.errors).toHaveLength(3);
  });
});
