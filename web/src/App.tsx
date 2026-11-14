import { useCallback, useEffect, useState } from "react";
import { describePostcardCheck, featureName, sweepAreaColor, visibleSightings, type ListFeature, type Region, type StoredSighting, type Waypoint, type WaypointList } from "@shell/shared";
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
import { useBatchView } from "./useBatchView.js";

type Tab = "quiet" | "discovery" | "postcard" | "target" | "history";
/** 有清單的功能分頁；探索區域與歷史分頁不屬於任何清單。 */
const TAB_FEATURE: Partial<Record<Tab, ListFeature>> = { quiet: "quiet-search", postcard: "postcard-check", target: "target-search" };
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
  const { view, follow } = useBatchView();
  const now = useNow();
  const [allSightings, setAllSightings] = useState<StoredSighting[]>([]);
  // 地圖的 Sighting 來自 SQLite 全部 Batch；跟隨中的 Batch 有新 Sighting 或結束時重抓。
  useEffect(() => {
    void api.sightings().then(setAllSightings).catch(() => {});
  }, [view.sightings.length, view.status]);

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
    let spotName: string | undefined;
    if (feature === "postcard-check") {
      const name = window.prompt("Spot Name（必填）", "");
      if (!name?.trim()) return;
      spotName = name.trim();
    }
    try {
      await api.addWaypoint(selectedId, lat, lng, spotName);
    } catch (e) {
      return void window.alert(e instanceof Error ? e.message : String(e));
    }
    await reload();
  };
  const edit = async (w: Waypoint) => {
    const label = window.prompt("標籤", w.label);
    if (label === null) return;
    const patch: { label: string; radius?: number | null; spotName?: string | null } = { label };
    if (feature === "postcard-check") {
      const spotName = window.prompt("Spot Name（必填）", w.spotName ?? "");
      if (spotName === null) return;
      patch.spotName = spotName.trim() || null;
    } else {
      const radiusText = window.prompt("半徑（公尺，留空＝未設定）", w.radius?.toString() ?? "");
      if (radiusText === null) return;
      const radius = radiusText.trim() === "" ? null : Number(radiusText);
      if (radius !== null && !(radius > 0)) return void window.alert("半徑要是正數");
      patch.radius = radius;
    }
    try {
      await api.updateWaypoint(w.id, patch);
    } catch (e) {
      return void window.alert(e instanceof Error ? e.message : String(e));
    }
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
  const areas: SweepArea[] = view.quietResults.flatMap((o) => {
    return [{ lat: o.point.lat, lng: o.point.lng, radius: o.radius, color: sweepAreaColor(o.result.verdict), tooltip: o.result.reason }];
  });

  const checkMarks: CheckMark[] = view.checkResults.flatMap((o) => {
    const d = describePostcardCheck(o.result, Date.now());
    const kind = o.result.found === true ? "found" : o.result.found === false ? "missing" : "unfinished";
    return [{ lat: o.point.lat, lng: o.point.lng, kind, tooltip: `${d.title}｜${d.message}` } as CheckMark];
  });

  const tabButton = (t: Tab, label: string) => (
    <button className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
      {label}
    </button>
  );

  return (
    <div className="layout">
      <WaypointMap
        waypoints={mapWaypoints}
        sightings={visibleSightings(allSightings, now, showAllSightings)}
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
        {tab === "quiet" && <QuietSearchPanel list={selected} waypoints={waypoints} view={view} onStarted={follow} />}
        {tab === "discovery" && (
          <DiscoveryPanel region={region} drawing={drawing} onDraw={() => setDrawing(true)} view={view} onStarted={async (batchId) => follow(batchId)} />
        )}
        {tab === "postcard" && <PostcardCheckPanel list={selected} waypoints={waypoints} view={view} onStarted={follow} />}
        {tab === "history" && <HistoryPanel refreshKey={view.status} />}
        {tab === "target" && <TargetSearchPanel list={selected} view={view} onStarted={follow} />}
      </div>
      <BatchDrawer onFollow={follow} view={view} />
    </div>
  );
}
