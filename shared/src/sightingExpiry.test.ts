import { describe, expect, it } from "vitest";
import type { BotSighting } from "./types.js";
import { describeSighting } from "./sightingCard.js";
import { isSightingExpired, sightingExpiresAt, visibleSightings } from "./sightingExpiry.js";

const base: BotSighting = {
  target: "巨大 輝煌蘑菇",
  lat: 25,
  lng: 121,
  spot_name: "點",
  participant_count: 1,
  remaining_seconds: 600,
  observed_at: "2026-11-14T14:08:00+08:00",
  map_position: [0, 0],
  frame: null,
  postcard: null,
};
const at = (iso: string) => Date.parse(iso);

describe("到期判斷", () => {
  it("到期時間 = observed_at + remaining_seconds", () => {
    expect(sightingExpiresAt(base)).toBe(at("2026-11-14T14:18:00+08:00"));
  });
  it("remaining 為 null（尚未開始倒數）：沒有到期時間、不算過期", () => {
    const s = { ...base, remaining_seconds: null };
    expect(sightingExpiresAt(s)).toBeNull();
    expect(isSightingExpired(s, at("2030-01-01T00:00:00Z"))).toBe(false);
  });
  it("邊界：差 1 毫秒還沒到期；剛好到期那一刻算已到期", () => {
    const end = at("2026-11-14T14:18:00+08:00");
    expect(isSightingExpired(base, end - 1)).toBe(false);
    expect(isSightingExpired(base, end)).toBe(true);
    expect(isSightingExpired(base, end + 1)).toBe(true);
  });
  it("remaining 為 0：觀察當下就到期", () => {
    expect(isSightingExpired({ ...base, remaining_seconds: 0 }, at("2026-11-14T14:08:00+08:00"))).toBe(true);
  });
  it("observed_at 讀不出來：保守當作沒過期，不讓它從地圖消失", () => {
    expect(isSightingExpired({ ...base, observed_at: "壞掉" }, Date.now())).toBe(false);
  });
});

describe("visibleSightings（地圖過濾）", () => {
  const live = { ...base, spot_name: "活" };
  const dead = { ...base, spot_name: "死", remaining_seconds: 60 };
  const unclaimed = { ...base, spot_name: "未倒數", remaining_seconds: null };
  const now = at("2026-11-14T14:12:00+08:00");
  it("預設只留沒過期的（含尚未倒數）", () => {
    expect(visibleSightings([live, dead, unclaimed], now, false).map((s) => s.spot_name)).toEqual(["活", "未倒數"]);
  });
  it("顯示全部：過期的也留著", () => {
    expect(visibleSightings([live, dead, unclaimed], now, true).map((s) => s.spot_name)).toEqual(["活", "死", "未倒數"]);
  });
  it("隨時間推進，原本顯示的會被濾掉", () => {
    expect(visibleSightings([live], now, false)).toHaveLength(1);
    expect(visibleSightings([live], at("2026-11-14T14:18:00+08:00"), false)).toHaveLength(0);
  });
});

describe("「N 分鐘前看到」文字", () => {
  const s = { ...base, remaining_seconds: null };
  it.each([
    ["14:08:00", "0 分鐘前看到"],
    ["14:08:59", "0 分鐘前看到"],
    ["14:09:00", "1 分鐘前看到"],
    ["15:10:00", "62 分鐘前看到"],
  ])("現在 %s → %s", (t, text) => {
    expect(describeSighting(s, at(`2026-11-14T${t}+08:00`)).seen).toBe(text);
  });
  it("時鐘比 observed_at 早（不會顯示負數）", () => {
    expect(describeSighting(s, at("2026-11-14T14:00:00+08:00")).seen).toBe("0 分鐘前看到");
  });
});
