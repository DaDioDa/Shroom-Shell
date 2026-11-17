import type { ReactNode } from "react";
import { appTheme, type Theme } from "../theme.js";
import { Themed } from "./Doc.js";
import { BrandMark, icons } from "./icons.js";
import { MapMock, type MapWaypoint } from "./MapMock.js";
import { BatchDrawer, Button, Checkbox, Input, QuietResultCard, SectionHead, Select, Slider, TABS, Tabs, WaypointRow } from "./Ui.js";

export const WAYPOINTS = [
  { name: "象山親山步道", meta: "r=500 m" },
  { name: "信義廣場", meta: "未設半徑，用預設" },
  { name: "四四南村", meta: "r=300 m" },
  { name: "松山文創園區", meta: "未設半徑，用預設" },
  { name: "國父紀念館", meta: "r=800 m" },
];

const MAP_POINTS: MapWaypoint[] = [
  { n: 1, x: 250, y: 330, result: "yes" },
  { n: 2, x: 440, y: 250, result: "no" },
  { n: 3, x: 590, y: 420 },
  { n: 4, x: 730, y: 290 },
  { n: 5, x: 380, y: 520 },
];

export const LOG = ["[quiet] teleport 25.0273,121.5707", "[quiet] cold start... ok (11.2s)", "[quiet] scanning radius 500 m — 2 / 4 frames"];

/**
 * 一整個畫面（1280 × 800）：左地圖、右面板。
 * map 是畫在底圖上的 SVG 圖層；overlay 是疊在地圖上的 HTML（提示、浮動卡）；drawer 是底部的 Batch 抽屜。
 * sightingToggle：地圖右上角「顯示全部 Sighting」，只在會畫 Sighting 的分頁出現。
 */
export function AppFrame({
  theme = appTheme,
  tab,
  waypoints,
  sighting,
  map,
  overlay,
  drawer,
  sightingToggle = true,
  children,
}: {
  theme?: Theme;
  tab: (typeof TABS)[number];
  waypoints?: MapWaypoint[];
  sighting?: { x: number; y: number; label: string };
  map?: ReactNode;
  overlay?: ReactNode;
  drawer?: ReactNode;
  sightingToggle?: boolean;
  children: ReactNode;
}) {
  return (
    <Themed theme={theme} className="app">
      <div className="map-area">
        <MapMock waypoints={waypoints} sighting={sighting}>
          {map}
        </MapMock>
        <div className="map-ctl zoom">
          <span>+</span>
          <span>−</span>
        </div>
        <div className="map-ctl search">
          <span className="ph">輸入座標，例如 -15.5885, -67.2519</span>
          <span className="go">{icons.search}</span>
        </div>
        {sightingToggle && (
          <div className="map-ctl map-toggle">
            <Checkbox label="顯示全部 Sighting（含已過期）" />
          </div>
        )}
        {overlay}
        {drawer && <div className="map-drawer">{drawer}</div>}
        <div className="attrib">© OpenStreetMap contributors</div>
      </div>
      <aside className="panel">
        <div className="brand">
          <span className="mark">
            <BrandMark />
            <span className="name">
              Pikmin Bloom <em>Shell</em>
            </span>
          </span>
        </div>
        <div className="body more">
          <Tabs active={tab} />
          {children}
        </div>
      </aside>
    </Themed>
  );
}

/** 01 視覺方向用的畫面：無人巨菇分頁，Batch 跑到第 3 個 Waypoint。 */
export function AppScreen({ theme }: { theme: Theme }) {
  return (
    <AppFrame theme={theme} tab="無人巨菇" waypoints={MAP_POINTS} sighting={{ x: 222, y: 360, label: "巨大 輝煌蘑菇" }} drawer={<BatchDrawer log={LOG} />}>
      <div className="sec boxed">
        <SectionHead title="無人巨菇清單" en="WAYPOINT LIST" />
        <div className="line">
          <Select value="台北信義區（5）" grow />
          <Button size="small">改名</Button>
          <Button size="small" kind="danger">刪除</Button>
        </div>
        <div className="line">
          <Input placeholder="新清單名稱" grow />
          <Button>建立</Button>
        </div>
        <Button icon="plus">在地圖上新增</Button>
        <div className="wplist">
          {WAYPOINTS.map((w, i) => (
            <WaypointRow key={w.name} n={i + 1} name={w.name} meta={w.meta} first={i === 0} last={i === WAYPOINTS.length - 1} />
          ))}
        </div>
      </div>
      <div className="sec boxed">
        <SectionHead title="無人巨菇" en="QUIET GIANT SEARCH" />
        <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" disabled />
        <Button kind="primary" size="block" state="disabled" icon="play">開始</Button>
        <QuietResultCard index={1} name="象山親山步道" v="yes" radius={500} reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" />
        <QuietResultCard index={2} name="信義廣場" v="no" radius={500} reason="有人在打：第 2 格，3 人。" />
      </div>
    </AppFrame>
  );
}
