export type MapTab = "quiet" | "discovery" | "postcard" | "target" | "history";

export interface TabLayers {
  /** 該分頁要向 /api/sightings 抓哪個功能的 Sighting；null＝不抓。 */
  sightingFeature: "quiet-search" | "discovery" | "target-search" | null;
  /** 是否畫半徑預覽（與結果疊畫，不因有結果而消失）。 */
  preview: boolean;
  /** 是否用歷史詳情的 point 畫當時走過的點。 */
  historyPoints: boolean;
}

/** 各分頁地圖要畫哪些圖層（清單、結果、Region 等另依分頁判斷）。 */
export function tabLayers(tab: MapTab): TabLayers {
  switch (tab) {
    case "quiet":
      return { sightingFeature: "quiet-search", preview: true, historyPoints: false };
    case "discovery":
      return { sightingFeature: "discovery", preview: false, historyPoints: false };
    case "target":
      return { sightingFeature: "target-search", preview: true, historyPoints: false };
    case "postcard":
      return { sightingFeature: null, preview: false, historyPoints: false };
    case "history":
      return { sightingFeature: null, preview: false, historyPoints: true };
  }
}
