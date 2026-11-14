import { useEffect, useState } from "react";
import { clampSlider, linkedSpacing, resnapRegion, SLIDER_SPECS, type Region } from "@shell/shared";
import { loadJson, saveJson, useStoredSlider } from "./storage.js";

const REGION_KEY = "discovery.region";
const LINKED_KEY = "discovery.linked";

const isRegion = (r: unknown): r is Region => {
  const x = r as Region | null;
  return !!x && [x.south, x.north, x.west, x.east].every((n) => typeof n === "number" && Number.isFinite(n)) && x.south < x.north && x.west < x.east;
};

/** 探索區域的編輯狀態：Region、半徑、間距、跟半徑連動。Region、間距、連動勾選存 localStorage，讀不到就用預設值。 */
export function useDiscoveryEditor() {
  const [region, setRegionState] = useState<Region | null>(() => {
    const r = loadJson<unknown>(REGION_KEY, null);
    return isRegion(r) ? r : null;
  });
  const [radius, setRadiusState] = useStoredSlider("slider.radius.discovery", SLIDER_SPECS.radius);
  const [manualSpacing, setManualSpacingState] = useStoredSlider("slider.spacing.discovery", SLIDER_SPECS.spacing);
  const [linked, setLinkedState] = useState(() => loadJson<unknown>(LINKED_KEY, true) !== false);
  /** 使用者正在調 Region（拖、放、改間距或半徑）；false 時有結果就先顯示結果。 */
  const [editing, setEditing] = useState(false);
  useEffect(() => saveJson(REGION_KEY, region), [region]);
  useEffect(() => saveJson(LINKED_KEY, linked), [linked]);

  const spacing = linked ? linkedSpacing(radius) : manualSpacing;
  const edit = (r: Region | null) => (setRegionState(r), setEditing(true));
  // 間距變了就以中心重新對齊現有 Region。
  const respace = (nextSpacing: number) => {
    if (region) setRegionState(resnapRegion(region, nextSpacing));
    setEditing(true);
  };
  return {
    region,
    radius,
    spacing,
    linked,
    manualSpacing,
    editing,
    setEditing,
    setRegion: edit,
    setRadius: (v: number) => {
      const r = clampSlider(SLIDER_SPECS.radius, v);
      setRadiusState(r);
      if (linked) respace(linkedSpacing(r));
      else setEditing(true);
    },
    setManualSpacing: (v: number) => {
      const s = clampSlider(SLIDER_SPECS.spacing, v);
      setManualSpacingState(s);
      respace(s);
    },
    setLinked: (on: boolean) => {
      setLinkedState(on);
      if (on) return respace(linkedSpacing(radius));
      const s = clampSlider(SLIDER_SPECS.spacing, spacing); // 解除連動：用目前間距（夾進手動範圍）
      setManualSpacingState(s);
      respace(s);
    },
  };
}
export type DiscoveryEditor = ReturnType<typeof useDiscoveryEditor>;
