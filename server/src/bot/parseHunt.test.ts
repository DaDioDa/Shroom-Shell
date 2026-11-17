import { describe, expect, it } from "vitest";
import { HuntStderrReader, localIso, parseHuntStdout } from "./parseHunt.js";

const one = {
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

describe("parseHuntStdout", () => {
  it("解析 Sighting 陣列（cli.md 的範例）", () => {
    expect(parseHuntStdout(JSON.stringify([one], null, 2))).toEqual([one]);
  });

  it("沒找到時印 []：回空陣列", () => {
    expect(parseHuntStdout("[]\n")).toEqual([]);
  });

  it("冷啟動就中止時 stdout 為空：回 null，與「沒找到」區分", () => {
    expect(parseHuntStdout("")).toBeNull();
    expect(parseHuntStdout("  \r\n")).toBeNull();
  });

  it("不是 Sighting 陣列就丟錯", () => {
    expect(() => parseHuntStdout("not json")).toThrow(/JSON/);
    expect(() => parseHuntStdout('{"a":1}')).toThrow(/陣列/);
    expect(() => parseHuntStdout('[{"target":"x"}]')).toThrow(/Sighting/);
  });
});

describe("HuntStderrReader：Sweep 進行中從 stderr 拼出 Sighting", () => {
  const now = new Date(2026, 10, 14, 14, 8, 0); // 本機時間 2026-11-14 14:08
  const feed = (lines: string[]) => {
    const r = new HuntStderrReader(() => now);
    return lines.map((l) => r.feed(l)).filter((x) => x !== null);
  };

  it("cli.md 的範例：讀到 Postcard 那行才湊成一筆", () => {
    const r = new HuntStderrReader(() => now);
    expect(r.feed("【找到 Target】巨大 輝煌蘑菇｜範例地點")).toBeNull();
    expect(r.feed("  參與人數 0｜尚未開始倒數")).toBeNull();
    expect(r.feed("  地圖 https://maps.google.com/?q=25.033964,121.564468")).toBeNull();
    expect(r.feed(String.raw`  Postcard F:\pikmin_bloom_bot\runs\20261114-140728\postcard-01.png`)).toEqual({
      target: "巨大 輝煌蘑菇",
      spot_name: "範例地點",
      lat: 25.033964,
      lng: 121.564468,
      participant_count: 0,
      remaining_seconds: null,
      observed_at: localIso(now),
      postcardPath: String.raw`F:\pikmin_bloom_bot\runs\20261114-140728\postcard-01.png`,
    });
  });

  it("到期時間換成剩餘秒數；人數不明為 null；沒截到 Postcard 為 null", () => {
    const [s] = feed(["【找到 Target】一般 紅色蘑菇｜某公園", "  參與人數 不明｜到期 2026-11-14 15:38", "  地圖 https://maps.google.com/?q=-15.5885,-67.2519", "  Postcard （沒有）"]);
    expect(s).toMatchObject({ participant_count: null, remaining_seconds: 90 * 60, lat: -15.5885, lng: -67.2519, postcardPath: null });
  });

  it("一次跑完多筆；夾在中間的摘要、推播等其他行不影響", () => {
    const block = (spot: string) => [`【找到 Target】巨大 *｜${spot}`, "  參與人數 3｜尚未開始倒數", "  地圖 https://maps.google.com/?q=1,2", "  Postcard （沒有）"];
    const got = feed([...block("甲"), "可點徽章 12 顆（重複略過 3），Sighting 1 筆", ...block("乙"), "【結束】找到 2 顆，花了 3 分 12 秒"]);
    expect(got.map((s) => [s.spot_name, s.participant_count])).toEqual([["甲", 3], ["乙", 3]]);
  });

  it("缺地圖座標的不算", () => {
    expect(feed(["【找到 Target】巨大 *｜甲", "  參與人數 0｜尚未開始倒數", "  Postcard （沒有）"])).toEqual([]);
  });

  it("localIso 帶本機時差", () => {
    expect(localIso(now)).toMatch(/^2026-11-14T14:08:00[+-]\d{2}:\d{2}$/);
  });
});
