import { useCallback, useEffect, useState } from "react";
import { describePostcardCheck, featureName, sweepAreaColor, visibleSightings, type ListFeature, type HistoryDetail, type Region, type StoredSighting, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { WaypointMap, type CheckMark, type SweepArea } from "./Map.js";
import { BatchDrawer } from "./BatchDrawer.js";
import { DiscoveryPanel } from "./DiscoveryPanel.js";
import { ListManager } from "./ListManager.js";
import { HistoryPanel } from "./HistoryPanel.js";
import { PostcardCheckPanel } from "./PostcardCheckPanel.js";
import { QuietSearchPanel } from "./QuietSearchPanel.js";
import { TargetSearchPanel } from "./TargetSearchPanel.js";
import { useNow } from "./useNow.js";
import { BATCH_FEATURES, useBatchViews, type BatchFeature } from "./useBatchView.js";

type Tab = "quiet" | "discovery" | "postcard" | "target" | "history";
/** 有清單的功能分頁；探索區域與歷史分頁不屬於任何清單。 */
const TAB_FEATURE: Partial<Record<Tab, ListFeature>> = { quiet: "quiet-search", postcard: "postcard-check", target: "target-search" };
/** 各分頁對應的 Batch 功能（歷史分頁沒有）。 */
const TAB_BATCH: Partial<Record<Tab, BatchFeature>> = { quiet: "quiet-search", discovery: "discovery", postcard: "postcard-check", target: "target-search" };
const noLists = (): Record<ListFeature, WaypointList[]> => ({ "quiet-search": [], "postcard-check": [], "target-search": [] });
const noSelection = (): Record<ListFeature, number | null> => ({ "quiet-search": null, "postcard-check": null, "target-search": null });

export function App() {
  const [listsBy, setListsBy] = useState(noLists);
  // 各功能分頁各自記住選的清單（先存在記憶體，重新整理不保留）。
  const [selectedBy, setSelectedBy] = useState(noSelection);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [tab, setTab] = useState<Tab>("quiet");
  const [region, setRegion] = useState<Region | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [showAllSightings, setShowAllSightings] = useState(false);
  const { views, follow } = useBatchViews();
  const now = useNow();
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  const batchFeature = TAB_BATCH[tab] ?? null;
  // 目前分頁的 BatchView；歷史分頁沒有，用一個空的。
  const view = batchFeature ? views[batchFeature] : views["quiet-search"];
  const [tabSightings, setTabSightings] = useState<StoredSighting[]>([]);
  // 指定菇菇分頁的 Sighting 來自 SQLite、只取該功能的；跟隨中的 Batch 有新 Sighting 或結束時重抓。
  const targetView = views["target-search"];
  useEffect(() => {
    void api.sightings("target-search").then(setTabSightings).catch(() => {});
  }, [targetView.sightings.length, targetView.status]);
  // 底部抽屜是全域的：有在跑的 Batch 就顯示它，否則顯示目前分頁的。
  const drawerView = BATCH_FEATURES.map((f) => views[f]).find((v) => v.status === "running") ?? view;

  const feature = TAB_FEATURE[tab] ?? null;
  const lists = feature ? listsBy[feature] : [];
  const selectedId = feature ? selectedBy[feature] : null;
  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const refreshLists = useCallback(async (f: ListFeature) => {
    const next = await api.lists(f);
    setListsBy((m) => ({ ...m, [f]: next }));
  }, []);
  useEffect(() => {
    for (const f of Object.values(TAB_FEATURE)) void refreshLists(f);
  }, [refreshLists]);

  // 只載入目前功能分頁選定清單的 Waypoint；其他分頁地圖不畫任何清單。
  useEffect(() => {
    if (selectedId === null) return setWaypoints([]);
    let stale = false;
    void api.waypoints(selectedId).then((w) => !stale && setWaypoints(w));
    return () => {
      stale = true;
    };
  }, [selectedId]);

  const select = (id: number | null) => feature && setSelectedBy((m) => ({ ...m, [feature]: id }));
  const reload = async () => {
    if (selectedId === null) return;
    setWaypoints(await api.waypoints(selectedId));
    if (feature) await refreshLists(feature);
  };
  const addAt = async (lat: number, lng: number) => {
    if (selectedId === null) return;
    await api.addWaypoint(selectedId, lat, lng);
    await reload();
  };
  const edit = async (w: Waypoint) => {
    const label = window.prompt("標籤", w.label);
    if (label === null) return;
    const radiusText = window.prompt("半徑（公尺，留空＝未設定）", w.radius?.toString() ?? "");
    if (radiusText === null) return;
    const spotName = window.prompt("Spot Name（留空＝未設定）", w.spotName ?? "");
    if (spotName === null) return;
    const radius = radiusText.trim() === "" ? null : Number(radiusText);
    if (radius !== null && !(radius > 0)) return void window.alert("半徑要是正數");
    await api.updateWaypoint(w.id, { label, radius, spotName });
    await reload();
  };
  const removeWaypoint = async (w: Waypoint) => {
    if (!window.confirm(`刪除「${w.label || `${w.lat}, ${w.lng}`}」？`)) return;
    await api.deleteWaypoint(w.id);
    await reload();
  };
  const move = async (index: number, delta: -1 | 1) => {
    if (selectedId === null) return;
    const ids = waypoints.map((w) => w.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setWaypoints(await api.reorder(selectedId, ids));
  };

  // 地圖只畫目前功能分頁選定清單的 Waypoint。
  const mapWaypoints = feature ? waypoints : [];

  // Quiet Giant Search 的結果：用執行當時記下的點（不回查目前清單），以它為中心、邊長 2R 的正方形。
  const sweepSource = tab === "history" ? (historyDetail?.waypoints.flatMap((w) => (w.quiet ? [{ point: w.point, radius: w.quiet.radius, result: w.quiet.result }] : [])) ?? []) : tab === "quiet" || tab === "discovery" ? view.quietResults : [];
  const areas: SweepArea[] = sweepSource.flatMap((o) => {
    return [{ lat: o.point.lat, lng: o.point.lng, radius: o.radius, color: sweepAreaColor(o.result.verdict), tooltip: o.result.reason }];
  });

  const checkSource = tab === "history" ? (historyDetail?.waypoints.flatMap((w) => (w.check ? [w.check] : [])) ?? []) : tab === "postcard" ? view.checkResults : [];
  const checkMarks: CheckMark[] = checkSource.flatMap((o) => {
    const d = describePostcardCheck(o.result, Date.now());
    const kind = o.result.found === true ? "found" : o.result.found === false ? "missing" : "unfinished";
    return [{ lat: o.point.lat, lng: o.point.lng, kind, tooltip: `${d.title}｜${d.message}` } as CheckMark];
  });

  // 指定菇菇分頁畫該功能的 Sighting；歷史分頁畫點選那個 Batch 的 Sighting；其他分頁不畫。
  const mapSightings = tab === "target" ? tabSightings : tab === "history" ? (historyDetail?.waypoints.flatMap((w) => w.sightings) ?? []) : [];

  const tabButton = (t: Tab, label: string) => (
    <button className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
      {label}
    </button>
  );

  return (
    <div className="layout">
      <WaypointMap
        waypoints={mapWaypoints}
        sightings={visibleSightings(mapSightings, now, showAllSightings)}
        now={now}
        areas={areas}
        checkMarks={checkMarks}
        region={tab === "discovery" ? region : null}
        drawing={tab === "discovery" && drawing}
        onRegionDrawn={(r) => (setRegion(r), setDrawing(false))}
        onMapClick={feature && selectedId !== null ? addAt : undefined}
        onMarkerEdit={edit}
        onMarkerDelete={removeWaypoint}
      />
      <div className="panel">
        <div className="tabs">
          {tabButton("quiet", featureName("quiet-search"))}
          {tabButton("discovery", featureName("discovery"))}
          {tabButton("postcard", featureName("postcard-check"))}
          {tabButton("target", featureName("target-search"))}
          {tabButton("history", "歷史")}
        </div>
        <label className="muted">
          <input type="checkbox" checked={showAllSightings} onChange={(e) => setShowAllSightings(e.target.checked)} />
          地圖顯示全部 Sighting（含已過期）
        </label>
        {feature && (
          <ListManager
            key={feature}
            feature={feature}
            lists={lists}
            selectedId={selectedId}
            waypoints={waypoints}
            onSelect={select}
            onListsChanged={() => refreshLists(feature)}
            onWaypointsChanged={reload}
            onEdit={edit}
            onRemoveWaypoint={removeWaypoint}
            onMove={move}
          />
        )}
        {tab === "quiet" && <QuietSearchPanel list={selected} waypoints={waypoints} view={view} onStarted={(id) => follow("quiet-search", id)} />}
        {tab === "discovery" && (
          <DiscoveryPanel region={region} drawing={drawing} onDraw={() => setDrawing(true)} view={view} onStarted={async (batchId) => follow("discovery", batchId)} />
        )}
        {tab === "postcard" && <PostcardCheckPanel list={selected} waypoints={waypoints} view={view} onStarted={(id) => follow("postcard-check", id)} />}
        {tab === "history" && <HistoryPanel refreshKey={BATCH_FEATURES.map((f) => views[f].status).join()} onDetail={setHistoryDetail} />}
        {tab === "target" && <TargetSearchPanel list={selected} view={view} onStarted={(id) => follow("target-search", id)} />}
      </div>
      <BatchDrawer onFollow={(f, id) => (BATCH_FEATURES as readonly string[]).includes(f) && follow(f as BatchFeature, id)} view={drawerView} />
    </div>
  );
}
