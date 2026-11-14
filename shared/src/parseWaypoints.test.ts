import { describe, expect, it } from "vitest";
import { checkWaypointFields, parseWaypoints, parseWaypointText } from "./parseWaypoints.js";
import { FEATURE_NAME } from "./featureNames.js";

describe("parseWaypointText", () => {
  it("解析 lat,lng 與標籤", () => {
    const r = parseWaypointText("25.033964,121.564468 台北 101\n-33.8,151.2");
    expect(r.errors).toEqual([]);
    expect(r.waypoints).toEqual([
      { lat: 25.033964, lng: 121.564468, label: "台北 101", radius: null },
      { lat: -33.8, lng: 151.2, label: "", radius: null },
    ]);
  });

  it("逗號後可有空白，支援 CRLF，略過空行", () => {
    const r = parseWaypointText("1, 2 A\r\n\r\n   \r\n3,4\r\n");
    expect(r.waypoints).toEqual([
      { lat: 1, lng: 2, label: "A", radius: null },
      { lat: 3, lng: 4, label: "", radius: null },
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

  it("座標後可接 r=公尺 設定半徑，其後才是標籤；沒寫就是 null", () => {
    const r = parseWaypointText("1,2 r=300 甲\n3,4 R=250.5\n5,6 乙 r=9\n7,8");
    expect(r.errors).toEqual([]);
    expect(r.waypoints).toEqual([
      { lat: 1, lng: 2, label: "甲", radius: 300 },
      { lat: 3, lng: 4, label: "", radius: 250.5 },
      { lat: 5, lng: 6, label: "乙 r=9", radius: null }, // 只有緊接在座標後的 r= 才算半徑
      { lat: 7, lng: 8, label: "", radius: null },
    ]);
  });

  it("半徑不是正數是錯誤，該行不匯入", () => {
    const r = parseWaypointText("1,2 r=0 甲\n3,4 r=-5\n5,6 r=abc");
    expect(r.waypoints).toEqual([{ lat: 5, lng: 6, label: "r=abc", radius: null }]);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2]);
  });

  it("缺經度或多餘逗號是錯誤", () => {
    const r = parseWaypointText("1\n1,2,3\n,2");
    expect(r.waypoints).toEqual([]);
    expect(r.errors).toHaveLength(3);
  });
});

describe("parseWaypointText：Spot Name 欄", () => {
  it("標籤後面接 ` @Spot Name`；可單獨寫、可搭配 r=", () => {
    const r = parseWaypointText("1,2 r=300 甲 @生賀神社\n3,4 @Blue Cafe\n5,6 乙 @ 有空白的名稱 \n7,8 丙");
    expect(r.errors).toEqual([]);
    expect(r.waypoints).toEqual([
      { lat: 1, lng: 2, label: "甲", radius: 300, spotName: "生賀神社" },
      { lat: 3, lng: 4, label: "", radius: null, spotName: "Blue Cafe" },
      { lat: 5, lng: 6, label: "乙", radius: null, spotName: "有空白的名稱" },
      { lat: 7, lng: 8, label: "丙", radius: null },
    ]);
  });

  it("標籤中間的 @（沒有前置空白）不算 Spot Name；`@` 後沒字是錯誤", () => {
    const r = parseWaypointText("1,2 a@b\n3,4 甲 @");
    expect(r.waypoints).toEqual([{ lat: 1, lng: 2, label: "a@b", radius: null }]);
    expect(r.errors.map((e) => e.line)).toEqual([2]);
  });
});

describe("checkWaypointFields：依功能檢查欄位", () => {
  it("美片菇：必須有 Spot Name，不能有半徑", () => {
    expect(checkWaypointFields("postcard-check", { radius: null, spotName: "神社" })).toEqual({ ok: true });
    expect(checkWaypointFields("postcard-check", { radius: null, spotName: null })).toEqual({ ok: false, reason: "美片菇需要 @Spot Name" });
    expect(checkWaypointFields("postcard-check", { radius: null, spotName: "  " })).toEqual({ ok: false, reason: "美片菇需要 @Spot Name" });
    expect(checkWaypointFields("postcard-check", { radius: 300, spotName: "神社" })).toEqual({ ok: false, reason: "美片菇不使用半徑" });
  });

  it("無人巨菇與指定菇菇：不能有 Spot Name，半徑選填", () => {
    for (const f of ["quiet-search", "target-search"] as const) {
      expect(checkWaypointFields(f, { radius: null, spotName: null })).toEqual({ ok: true });
      expect(checkWaypointFields(f, { radius: 300 })).toEqual({ ok: true });
      const r = checkWaypointFields(f, { radius: null, spotName: "神社" });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe(`${FEATURE_NAME[f]}不使用 Spot Name`);
    }
  });
});

describe("parseWaypoints：依功能匯入", () => {
  it("美片菇：缺 Spot Name 與帶半徑的行進錯誤清單並附原因", () => {
    const r = parseWaypoints("postcard-check", "1,2 甲 @神社\n3,4 乙\n5,6 r=300 丙 @店");
    expect(r.waypoints.map((w) => w.spotName)).toEqual(["神社"]);
    expect(r.errors.map((e) => [e.line, e.reason])).toEqual([
      [2, "美片菇需要 @Spot Name"],
      [3, "美片菇不使用半徑"],
    ]);
  });

  it("無人巨菇與指定菇菇：帶 Spot Name 的行被擋，半徑可用", () => {
    for (const f of ["quiet-search", "target-search"] as const) {
      const r = parseWaypoints(f, "1,2 r=300 甲\n3,4 乙 @神社\n5,6");
      expect(r.waypoints.map((w) => w.lat)).toEqual([1, 5]);
      expect(r.errors).toEqual([{ line: 2, text: "3,4 乙 @神社", reason: `${FEATURE_NAME[f]}不使用 Spot Name` }]);
    }
  });

  it("語法錯誤的原因保留", () => {
    const r = parseWaypoints("quiet-search", "abc");
    expect(r.errors[0]!.reason).toContain("格式");
  });
});
