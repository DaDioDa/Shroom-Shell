import { describe, expect, it } from "vitest";
import { describePostcardCheck, missingSpotNames, type CheckResult } from "./postcardCheck.js";

const found = (over: Partial<Extract<CheckResult, { found: true }>> = {}): CheckResult => ({
  found: true,
  name: "一般 紅色蘑菇",
  spot_name: "生賀神社",
  lat: 25.033964,
  lng: 121.564468,
  participant_count: 3,
  remaining_seconds: 5400,
  observed_at: "2026-11-14T21:30:00+08:00",
  frame: "/runs/x/frame.png",
  postcard: "/runs/x/postcard.png",
  ...over,
});
const NOW = Date.parse("2026-11-14T21:31:00+08:00");

describe("describePostcardCheck", () => {
  it("找到：種類、人數、到期時間", () => {
    const d = describePostcardCheck(found(), NOW);
    expect(d).toMatchObject({ kind: "found", title: "一般 紅色蘑菇", participants: "3 人", message: "到期 2026-11-14 23:00" });
  });

  it("Participant Count 0 顯示「無人」，null 顯示「人數不明」", () => {
    expect(describePostcardCheck(found({ participant_count: 0 }), NOW).participants).toBe("無人");
    expect(describePostcardCheck(found({ participant_count: null }), NOW).participants).toBe("人數不明");
  });

  it("remaining_seconds 是 null：尚未開始倒數", () => {
    expect(describePostcardCheck(found({ remaining_seconds: null }), NOW).message).toBe("尚未開始倒數");
  });

  it("沒找到：說明起點畫面沒有這個 Spot Name；unread > 0 加註可能有 N 顆沒讀到", () => {
    const none = describePostcardCheck({ found: false, spot_name: "生賀神社", unread: 0 }, NOW);
    expect(none).toMatchObject({ kind: "missing", title: "沒找到", message: "起點畫面上沒有這個 Spot Name", note: null });
    const some = describePostcardCheck({ found: false, spot_name: "生賀神社", unread: 2 }, NOW);
    expect(some.note).toBe("可能有 2 顆沒讀到");
  });

  it("中止：標「沒讀完」，顯示 reason，並保留已讀到的種類與人數", () => {
    const d = describePostcardCheck({ found: null, spot_name: "生賀神社", reason: "Detail 讀不到座標", name: "一般 紅色蘑菇", participant_count: 3 }, NOW);
    expect(d).toMatchObject({ kind: "unfinished", title: "沒讀完", message: "Detail 讀不到座標", partial: ["一般 紅色蘑菇", "3 人"] });
  });

  it("中止且什麼都沒讀到：partial 是空的；人數 0、null 的寫法同上", () => {
    expect(describePostcardCheck({ found: null, spot_name: "x", reason: "adb 連不上" }, NOW).partial).toEqual([]);
    expect(describePostcardCheck({ found: null, spot_name: "x", reason: "r", participant_count: 0 }, NOW).partial).toEqual(["無人"]);
    expect(describePostcardCheck({ found: null, spot_name: "x", reason: "r", participant_count: null }, NOW).partial).toEqual(["人數不明"]);
  });
});

describe("missingSpotNames", () => {
  it("回傳沒有 Spot Name（null 或全空白）的 Waypoint", () => {
    const w = (id: number, spotName: string | null) => ({ id, label: `W${id}`, spotName });
    expect(missingSpotNames([w(1, "甲"), w(2, null), w(3, "  "), w(4, "乙")]).map((x) => x.id)).toEqual([2, 3]);
  });
});
