import { describe, expect, it } from "vitest";
import { autoRegionName, gridCellLabel, isDuplicateWaypoint, gridCellWaypointLabel } from "./discoveryNaming.js";

describe("autoRegionName", () => {
  it("依本地時間產生「探索 YYYY-MM-DD HH:mm」，月日時分補零", () => {
    expect(autoRegionName(new Date(2026, 0, 5, 7, 3))).toBe("探索 2026-01-05 07:03");
    expect(autoRegionName(new Date(2026, 10, 15, 23, 59, 59))).toBe("探索 2026-11-15 23:59");
  });
});

describe("Grid Cell 標籤", () => {
  it("格 N 從 1 起算；加入清單的標籤是「探索：名稱 格 N」", () => {
    expect(gridCellLabel(0)).toBe("格 1");
    expect(gridCellWaypointLabel("北區", 2)).toBe("探索：北區 格 3");
  });
});

describe("isDuplicateWaypoint", () => {
  const list = [{ lat: 25, lng: 121, radius: 500 }, { lat: 25.1, lng: 121.1, radius: null }];
  it("經緯度與半徑都相同才算重複", () => {
    expect(isDuplicateWaypoint(list, { lat: 25, lng: 121, radius: 500 })).toBe(true);
    expect(isDuplicateWaypoint(list, { lat: 25, lng: 121, radius: 400 })).toBe(false);
    expect(isDuplicateWaypoint(list, { lat: 25, lng: 121.0001, radius: 500 })).toBe(false);
    expect(isDuplicateWaypoint(list, { lat: 25.1, lng: 121.1, radius: 500 })).toBe(false);
    expect(isDuplicateWaypoint([], { lat: 1, lng: 1, radius: 1 })).toBe(false);
  });
});
