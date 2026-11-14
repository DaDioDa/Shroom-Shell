import { describe, expect, it } from "vitest";
import { parseHuntStdout } from "./parseHunt.js";

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
