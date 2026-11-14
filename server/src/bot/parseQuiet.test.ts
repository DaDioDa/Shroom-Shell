import { describe, expect, it } from "vitest";
import type { BotSighting } from "@shell/shared";
import { parseQuietStdout } from "./parseQuiet.js";

const NL = String.fromCharCode(10);
const giant: BotSighting = {
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
const answer = (over: object = {}) =>
  JSON.stringify({ quiet_area: true, verdict: true, reason: "沒人在打，找到 1 顆巨菇", giants: [giant], claimed: null, unread: 0, ...over });

describe("parseQuietStdout：取 stdout 最後一行的答案", () => {
  it("只有答案一行", () => {
    const r = parseQuietStdout(answer() + NL);
    expect(r).toEqual({ quiet_area: true, verdict: true, reason: "沒人在打，找到 1 顆巨菇", giants: [giant], claimed: null, unread: 0 });
  });

  it("前面先印縮排的 Sighting 陣列（多行），最後一行才是答案：不被陣列干擾", () => {
    const array = JSON.stringify([giant, { ...giant, spot_name: "別處" }], null, 2);
    const r = parseQuietStdout(array + NL + answer({ giants: [giant] }) + NL);
    expect(r?.verdict).toBe(true);
    expect(r?.giants).toHaveLength(1); // 取答案裡的 giants，不是前面那個陣列
    expect(r?.giants[0]?.spot_name).toBe("範例地點");
  });

  it("verdict false，附 claimed（觸發的格子與人數；人數可為 null）與 unread", () => {
    const r = parseQuietStdout("[]" + NL + answer({ quiet_area: false, verdict: false, reason: "有人在打", giants: [], claimed: { cell: 45, participant_count: null }, unread: 2 }));
    expect(r).toMatchObject({ verdict: false, quiet_area: false, reason: "有人在打", giants: [], claimed: { cell: 45, participant_count: null }, unread: 2 });
  });

  it("verdict null（無法判斷）保留 null 與原因", () => {
    const r = parseQuietStdout(answer({ quiet_area: null, verdict: null, reason: "adb 連不上手機", giants: [] }));
    expect(r).toMatchObject({ verdict: null, quiet_area: null, reason: "adb 連不上手機" });
  });

  it("空白 stdout 回 null；最後一行不是合法答案就丟錯", () => {
    expect(parseQuietStdout("")).toBeNull();
    expect(parseQuietStdout("  " + NL)).toBeNull();
    expect(() => parseQuietStdout("garbage")).toThrow(/JSON/);
    expect(() => parseQuietStdout("[]")).toThrow(/答案/); // 只有陣列、沒有答案那一行
    expect(() => parseQuietStdout(answer({ verdict: "yes" }))).toThrow(/答案/);
  });
});
