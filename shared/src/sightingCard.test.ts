import { describe, expect, it } from "vitest";
import type { BotSighting } from "./types.js";
import { describeSighting } from "./sightingCard.js";

const base: BotSighting = {
  target: "巨大 輝煌蘑菇",
  lat: 25.033964,
  lng: 121.564468,
  spot_name: "範例地點",
  participant_count: 0,
  remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00",
  map_position: [672, 814],
  frame: "sighting-01.png",
  postcard: "postcard-01.png",
};
const at = (iso: string) => Date.parse(iso);

describe("describeSighting", () => {
  it("人數：0 無人、N 人、null 人數不明", () => {
    const now = at("2026-11-14T14:10:00+08:00");
    expect(describeSighting(base, now).participants).toBe("無人");
    expect(describeSighting({ ...base, participant_count: 3 }, now).participants).toBe("3 人");
    expect(describeSighting({ ...base, participant_count: null }, now).participants).toBe("人數不明");
  });

  it("尚未開始倒數：不給到期時間，改顯示幾分鐘前看到", () => {
    const d = describeSighting(base, at("2026-11-14T14:13:00+08:00"));
    expect(d.expiry).toBe("尚未開始倒數");
    expect(d.state).toBe("unclaimed");
    expect(d.seen).toBe("5 分鐘前看到");
  });

  it("有倒數：到期時間 = observed_at + remaining_seconds，用 observed_at 自己的時區顯示", () => {
    // 14:08 + 8520 秒（2 小時 22 分）= 16:30（+08:00）
    const d = describeSighting({ ...base, participant_count: 2, remaining_seconds: 8520 }, at("2026-11-14T14:10:00+08:00"));
    expect(d.expiry).toBe("到期 2026-11-14 16:30");
    expect(d.state).toBe("active");
  });

  it("跨日與非 +08 時區", () => {
    const d = describeSighting(
      { ...base, observed_at: "2026-11-14T23:50:00-05:00", remaining_seconds: 1200 },
      at("2026-11-15T04:51:00Z"),
    );
    expect(d.expiry).toBe("到期 2026-11-15 00:10");
  });

  it("已過期", () => {
    const d = describeSighting({ ...base, remaining_seconds: 600 }, at("2026-11-14T14:30:00+08:00"));
    expect(d.state).toBe("expired");
    expect(d.expiry).toBe("已到期（2026-11-14 14:18）");
  });

  it("地圖連結", () => {
    expect(describeSighting(base, 0).mapUrl).toBe("https://maps.google.com/?q=25.033964,121.564468");
  });
});
