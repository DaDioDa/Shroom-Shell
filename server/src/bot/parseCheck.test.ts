import { describe, expect, it } from "vitest";
import { parseCheckStdout } from "./parseCheck.js";

describe("parseCheckStdout", () => {
  it("找到、沒找到、中止三種單行 JSON", () => {
    expect(parseCheckStdout('{"found": true, "name": "N", "spot_name": "S", "lat": 1, "lng": 2, "participant_count": null, "remaining_seconds": null, "observed_at": "t", "frame": "/a/f.png", "postcard": null}')).toMatchObject({ found: true, participant_count: null });
    expect(parseCheckStdout('{"found": false, "spot_name": "S", "unread": 2}')).toEqual({ found: false, spot_name: "S", unread: 2 });
    expect(parseCheckStdout('{"found": null, "spot_name": "S", "reason": "r", "name": "N"}')).toMatchObject({ found: null, reason: "r", name: "N" });
  });
  it("空輸出是 null；壞掉的丟錯", () => {
    expect(parseCheckStdout("  \n")).toBeNull();
    expect(() => parseCheckStdout("garbage")).toThrow(/JSON/);
    expect(() => parseCheckStdout('{"found": true}')).toThrow();
    expect(() => parseCheckStdout('{"found": false, "spot_name": "S"}')).toThrow();
  });
});
