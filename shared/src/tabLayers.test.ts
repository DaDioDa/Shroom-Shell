import { describe, expect, it } from "vitest";
import { tabLayers } from "./tabLayers.js";

describe("tabLayers", () => {
  it("無人巨菇：畫該功能的 Sighting，半徑預覽與結果疊畫（有結果後仍看得到預覽）", () => {
    expect(tabLayers("quiet")).toMatchObject({ sightingFeature: "quiet-search", preview: true, historyPoints: false });
  });
  it("探索區域：畫 discovery 的 Sighting，沒有半徑預覽", () => {
    expect(tabLayers("discovery")).toMatchObject({ sightingFeature: "discovery", preview: false });
  });
  it("指定菇菇：畫 target-search 的 Sighting 與預覽", () => {
    expect(tabLayers("target")).toMatchObject({ sightingFeature: "target-search", preview: true });
  });
  it("美片菇：不畫 Sighting 與預覽", () => {
    expect(tabLayers("postcard")).toMatchObject({ sightingFeature: null, preview: false });
  });
  it("歷史：畫當時走過的點，Sighting 來自歷史詳情，不抓分頁 Sighting、沒有預覽", () => {
    expect(tabLayers("history")).toMatchObject({ sightingFeature: null, preview: false, historyPoints: true });
  });
});
