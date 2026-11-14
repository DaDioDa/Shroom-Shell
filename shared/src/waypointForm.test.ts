import { describe, expect, it } from "vitest";
import { CONFIRM_WINDOW_MS, pressConfirm, validateWaypointForm } from "./waypointForm.js";

describe("validateWaypointForm", () => {
  it("無人巨菇：標籤加半徑；半徑留空＝未設定", () => {
    expect(validateWaypointForm("quiet-search", { label: " A ", radiusText: "300", spotName: "" })).toEqual({ ok: true, patch: { label: "A", radius: 300 } });
    expect(validateWaypointForm("target-search", { label: "", radiusText: " ", spotName: "" })).toEqual({ ok: true, patch: { label: "", radius: null } });
  });
  it("半徑不是正數或不是數字：錯誤顯示在半徑欄", () => {
    for (const t of ["0", "-5", "abc"]) {
      const r = validateWaypointForm("quiet-search", { label: "", radiusText: t, spotName: "" });
      expect(r).toEqual({ ok: false, errors: { radius: "半徑要是正數" } });
    }
  });
  it("美片菇：Spot Name 必填，不送半徑", () => {
    expect(validateWaypointForm("postcard-check", { label: "x", radiusText: "", spotName: " 神社 " })).toEqual({ ok: true, patch: { label: "x", spotName: "神社" } });
    const r = validateWaypointForm("postcard-check", { label: "x", radiusText: "", spotName: "  " });
    expect(r).toEqual({ ok: false, errors: { spotName: "美片菇需要 @Spot Name" } });
  });
});

describe("pressConfirm：刪除二次確認", () => {
  it("第一次按只是待確認，再按一次才確認", () => {
    const a = pressConfirm(null, "list:1", 1000);
    expect(a).toEqual({ armed: { key: "list:1", at: 1000 }, confirmed: false });
    expect(pressConfirm(a.armed, "list:1", 1500)).toEqual({ armed: null, confirmed: true });
  });
  it("超時或換按別的，視為重新第一次", () => {
    const a = pressConfirm(null, "list:1", 1000).armed;
    expect(pressConfirm(a, "list:1", 1000 + CONFIRM_WINDOW_MS + 1).confirmed).toBe(false);
    expect(pressConfirm(a, "wp:2", 1100)).toEqual({ armed: { key: "wp:2", at: 1100 }, confirmed: false });
  });
});
