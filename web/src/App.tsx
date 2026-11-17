import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describePostcardCheck, featureName, initialBatchView, planDiscovery, SLIDER_SPECS, sweepAreaColor, sweepAreaSquare, sweepRadius, tabLayers, visibleSightings, type ListFeature, type HistoryDetail, type StoredSighting, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { WaypointMap, type CheckMark, type HistoryPoint, type SweepArea } from "./Map.js";
import { BatchDrawer } from "./BatchDrawer.js";
import { CellPanel, type CellInfo } from "./CellPanel.js";
import { DiscoveryPanel } from "./DiscoveryPanel.js";
import { useDiscoveryEditor } from "./useDiscoveryEditor.js";
import type { RegionEditorState } from "./regionEditorLayer.js";
import type { SweepBoxEditorState } from "./sweepBoxLayer.js";
import { ListManager } from "./ListManager.js";
import { WaypointForm } from "./WaypointForm.js";
import { HistoryPanel } from "./HistoryPanel.js";
import { PostcardCheckPanel } from "./PostcardCheckPanel.js";
import { QuietSearchPanel } from "./QuietSearchPanel.js";
import { TargetSearchPanel } from "./TargetSearchPanel.js";
import { useNow } from "./useNow.js";
import { loadJson, saveJson, useStoredSlider } from "./storage.js";
import { BATCH_FEATURES, useBatchViews, type BatchFeature } from "./useBatchView.js";
import { BrandMark, icons } from "./ui.js";

type Tab = "quiet" | "discovery" | "postcard" | "target" | "history";
/** 有清單的功能分頁；探索區域與歷史分頁不屬於任何清單。 */
const TAB_FEATURE: Partial<Record<Tab, ListFeature>> = { quiet: "quiet-search", postcard: "postcard-check", target: "target-search" };
/** 各分頁對應的 Batch 功能（歷史分頁沒有）。 */
const TAB_BATCH: Partial<Record<Tab, BatchFeature>> = { quiet: "quiet-search", discovery: "discovery", postcard: "postcard-check", target: "target-search" };
const noLists = (): Record<ListFeature, WaypointList[]> => ({ "quiet-search": [], "postcard-check": [], "target-search": [] });
const SELECTED_KEY = "selectedLists";
const noSelection = (): Record<ListFeature, number | null> => ({ "quiet-search": null, "postcard-check": null, "target-search": null });

export function App() {
  const [listsBy, setListsBy] = useState(noLists);
  // 各功能分頁各自記住選的清單，存在 localStorage；記住的清單已被刪除時，當作沒選。
  const [selectedBy, setSelectedBy] = useState(() => ({ ...noSelection(), ...loadJson<Partial<Record<ListFeature, number | null>>>(SELECTED_KEY, {}) }));
  useEffect(() => saveJson(SELECTED_KEY, selectedBy), [selectedBy]);
  const [quietRadius, setQuietRadius] = useStoredSlider("slider.radius.quiet-search", SLIDER_SPECS.radius);
  const [targetRadius, setTargetRadius] = useStoredSlider("slider.radius.target-search", SLIDER_SPECS.radius);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [tab, setTab] = useState<Tab>("quiet");
  const editor = useDiscoveryEditor();
  const centerRef = useRef<(() => { lat: number; lng: number }) | null>(null);
  // 「＋ 在地圖上新增」模式；換分頁或換清單就關掉。
  const [addMode, setAddMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // 畫面內的 Waypoint 表單：編輯既有的，或美片菇新增時問 Spot Name。
  const [editing, setEditing] = useState<{ mode: "edit"; w: Waypoint } | { mode: "add"; lat: number; lng: number } | null>(null);
  const [showAllSightings, setShowAllSightings] = useState(false);
  const { views, follow } = useBatchViews();
  const now = useNow();
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  // 探索區域分頁跟隨的 Discovery Batch 的 Region／半徑／間距／名稱（從歷史詳情取）。
  const [discoveryDetail, setDiscoveryDetail] = useState<HistoryDetail | null>(null);
  // 點過的 Grid Cell；areaId 是它在地圖方格裡的編號（畫深色外框用）。
  const [selectedCell, setSelectedCell] = useState<(CellInfo & { areaId: number }) | null>(null);
  const discoveryBatchId = views.discovery.batchId;
  useEffect(() => {
    if (discoveryBatchId === null) return setDiscoveryDetail(null);
    void api.historyDetail(discoveryBatchId).then(setDiscoveryDetail).catch(() => {});
  }, [discoveryBatchId, views.discovery.status]);
  useEffect(() => setSelectedCell(null), [historyDetail?.id, discoveryBatchId]);
  const batchFeature = TAB_BATCH[tab] ?? null;
  // 目前分頁的 BatchView；歷史分頁沒有，用一個空的。
  const view = batchFeature ? views[batchFeature] : views["quiet-search"];
  const [tabSightings, setTabSightings] = useState<StoredSighting[]>([]);
  // 無人巨菇、探索區域、指定菇菇分頁的 Sighting 來自 SQLite、只取該分頁功能的；跟隨中的 Batch 有新 Sighting 或結束時重抓。
  const layers = tabLayers(tab);
  const sightingFeature = layers.sightingFeature;
  const sightingView = sightingFeature ? views[sightingFeature] : null;
  // Sweep 中每找到一顆、或 bot 結束後補齊／刪掉一筆，這個陣列就換新，地圖跟著重抓。
  const liveSightings = sightingView?.sightings ?? null;
  const sightingStatus = sightingView?.status ?? null;
  useEffect(() => {
    if (!sightingFeature) return setTabSightings([]);
    let stale = false;
    void api
      .sightings(sightingFeature)
      .then((r) => !stale && setTabSightings(r))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [sightingFeature, liveSightings, sightingStatus]);
  // 底部抽屜是全域的：有在跑的 Batch 就顯示它，否則顯示目前分頁的。
  const runningFeature = BATCH_FEATURES.find((f) => views[f].status === "running") ?? null;
  const drawerFeature: BatchFeature | null = runningFeature ?? batchFeature;
  // 歷史分頁沒有自己的 Batch：沒在跑時抽屜不顯示（不拿無人巨菇的結果來充數）。
  const drawerView = runningFeature ? views[runningFeature] : batchFeature ? view : initialBatchView;

  const feature = TAB_FEATURE[tab] ?? null;
  const lists = feature ? listsBy[feature] : [];
  const selectedId = feature ? selectedBy[feature] : null;
  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const refreshLists = useCallback(async (f: ListFeature) => {
    const next = await api.lists(f);
    setListsBy((m) => ({ ...m, [f]: next }));
    setSelectedBy((m) => (m[f] != null && !next.some((l) => l.id === m[f]) ? { ...m, [f]: null } : m));
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

  useEffect(() => {
    setAddMode(false);
    setNotice(null);
    setEditing(null);
  }, [tab, selectedId]);

  const select = (id: number | null) => feature && setSelectedBy((m) => ({ ...m, [feature]: id }));
  const reload = async () => {
    if (selectedId === null) return;
    setWaypoints(await api.waypoints(selectedId));
    if (feature) await refreshLists(feature);
  };
  const addAt = async (lat: number, lng: number) => {
    if (selectedId === null || !addMode) return;
    setNotice(null);
    // 美片菇要 Spot Name：用畫面內的表單問，地圖先畫一個新增中的點；表單開著時再點地圖＝改這個點的位置。
    if (feature === "postcard-check") return setEditing({ mode: "add", lat, lng });
    try {
      await api.addWaypoint(selectedId, lat, lng);
    } catch (e) {
      return setNotice(e instanceof Error ? e.message : String(e));
    }
    await reload();
  };
  const edit = (w: Waypoint) => setEditing({ mode: "edit", w });
  const submitForm = async (patch: { label: string; radius?: number | null; spotName?: string | null }) => {
    if (!editing || selectedId === null) return;
    if (editing.mode === "edit") {
      await api.updateWaypoint(editing.w.id, patch);
    } else {
      await api.addWaypoint(selectedId, editing.lat, editing.lng, { label: patch.label, spotName: patch.spotName });
    }
    setEditing(null);
    await reload();
  };
  const removeWaypoint = async (w: Waypoint) => {
    await api.deleteWaypoint(w.id);
    if (editing?.mode === "edit" && editing.w.id === w.id) setEditing(null);
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
  const sweepSource = tab === "history" ? (historyDetail?.waypoints.flatMap((w) => (w.quiet ? [{ index: w.index, point: w.point, radius: w.quiet.radius, result: w.quiet.result }] : [])) ?? []) : tab === "quiet" || tab === "discovery" ? view.quietResults : [];
  // Discovery（探索區域分頁或歷史裡的 Discovery Batch）：畫 Region 外框，格子可點。
  const discoveryInfo = tab === "history" ? (historyDetail?.discovery ?? null) : tab === "discovery" && discoveryDetail?.id === discoveryBatchId ? (discoveryDetail?.discovery ?? null) : null;
  const areas: SweepArea[] = sweepSource.flatMap((o, i) => {
    return [{ lat: o.point.lat, lng: o.point.lng, radius: o.radius, color: sweepAreaColor(o.result.verdict), tooltip: o.result.reason, ...(discoveryInfo ? { id: i } : {}) }];
  });
  const clickCell = (i: number) => {
    const o = sweepSource[i];
    if (!o || !discoveryInfo) return;
    setSelectedCell({ areaId: i, regionName: discoveryInfo.name, number: o.index, lat: o.point.lat, lng: o.point.lng, radius: o.radius, verdict: o.result.verdict, reason: o.result.reason });
  };
  const discoveryBusy = views.discovery.status === "running" || views.discovery.status === "queued";
  // 探索區域分頁：排隊或執行中鎖住（不能拖）；沒在跑且使用者在調 Region（或還沒有可看的結果）時顯示編輯器與預覽，否則顯示結果。
  const editorActive = tab === "discovery" && !discoveryBusy && editor.region !== null && (editor.editing || discoveryInfo === null);
  const editorState: RegionEditorState | null = editorActive
    ? { region: editor.region!, spacingM: editor.spacing, radiusM: editor.radius, bad: !planDiscovery({ region: editor.region!, spacingM: editor.spacing, avgMsPerPoint: null }).ok, onChange: editor.setRegion }
    : null;

  // 拉半徑時的預覽：選定清單的每個 Waypoint 周圍畫 2R 正方形，Waypoint 自帶半徑時用自己的。
  // 預覽與結果疊畫（結果是實線方格、預覽是虛線藍框），有結果後拉 slider 仍有回饋。
  const previewRadius = tab === "quiet" ? quietRadius : tab === "target" ? targetRadius : null;
  const showPreview = layers.preview && previewRadius !== null;
  // 無人巨菇、指定菇菇的「在地圖上新增」模式：預覽框改成可拖移（移動 Waypoint）、可拖角縮放（設定該 Waypoint 的半徑）。
  const boxEditing = previewRadius !== null && addMode && selectedId !== null;
  const previewAreas: SweepArea[] = showPreview && !boxEditing ? waypoints.map((w) => ({ lat: w.lat, lng: w.lng, radius: sweepRadius(w, previewRadius), color: "preview" as const })) : [];
  const commitWaypoint = async (id: number, patch: { lat: number; lng: number } | { radius: number }) => {
    setNotice(null);
    // 先在畫面上套用，存檔失敗再重抓。
    setWaypoints((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    try {
      const saved = await api.updateWaypoint(id, patch);
      setWaypoints((ws) => ws.map((w) => (w.id === id ? saved : w)));
      setEditing((e) => (e?.mode === "edit" && e.w.id === id ? { mode: "edit", w: saved } : e));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      await reload();
    }
  };
  // 美片菇的「在地圖上新增」模式：既有的點可拖曳，放開就存新位置。
  const dotDragging = tab === "postcard" && addMode && selectedId !== null;
  const pendingAdd = tab === "postcard" && editing?.mode === "add" ? { lat: editing.lat, lng: editing.lng } : null;
  const boxEditor: SweepBoxEditorState | null = boxEditing
    ? { boxes: waypoints.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, radius: sweepRadius(w, previewRadius!) })), onCommit: (id, patch) => void commitWaypoint(id, patch), onClick: (lat, lng) => void addAt(lat, lng) }
    : null;

  const checkSource = tab === "history" ? (historyDetail?.waypoints.flatMap((w) => (w.check ? [w.check] : [])) ?? []) : tab === "postcard" ? view.checkResults : [];
  const checkMarks: CheckMark[] = checkSource.flatMap((o) => {
    const d = describePostcardCheck(o.result, Date.now());
    const kind = o.result.found === true ? "found" : o.result.found === false ? "missing" : "unfinished";
    return [{ lat: o.point.lat, lng: o.point.lng, kind, tooltip: `${d.title}｜${d.message}` } as CheckMark];
  });

  // 歷史分頁：當時走過的每個點（含失敗、指定菇菇），樣式與清單 Waypoint 不同。
  const showHistoryPoints = layers.historyPoints;
  const historyPoints = useMemo<HistoryPoint[]>(() => (showHistoryPoints ? (historyDetail?.waypoints.map((w) => ({ lat: w.point.lat, lng: w.point.lng, label: w.point.label || `點 ${w.index}` })) ?? []) : []), [showHistoryPoints, historyDetail]);

  // 有 Sighting 的分頁畫該功能的 Sighting；歷史分頁畫點選那個 Batch 的 Sighting；其他分頁不畫。
  const mapSightings = layers.historyPoints ? (historyDetail?.waypoints.flatMap((w) => w.sightings) ?? []) : tabSightings;

  const tabButton = (t: Tab, label: string) => (
    <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => (setTab(t), setSelectedCell(null))}>
      {label}
    </button>
  );

  // Waypoint 表單嵌在清單裡：編輯時接在那一列下面，新增（美片菇）時接在清單最後。
  const form =
    feature && editing ? (
      <WaypointForm
        // 新增中的點被拖動或重點時，表單不重建，已填的 Spot Name 保留。
        key={editing.mode === "edit" ? `edit:${editing.w.id}:${editing.w.radius}` : "add"}
        feature={feature}
        title={editing.mode === "edit" ? "編輯 Waypoint" : `新增 Waypoint（${editing.lat.toFixed(6)}, ${editing.lng.toFixed(6)}）`}
        initial={editing.mode === "edit" ? { label: editing.w.label, radius: editing.w.radius, spotName: editing.w.spotName ?? null } : { label: "", radius: null, spotName: null }}
        onSubmit={submitForm}
        onCancel={() => setEditing(null)}
      />
    ) : null;
  const editingId = editing ? (editing.mode === "edit" ? editing.w.id : "new") : null;
  const featureBusy = batchFeature !== null && (views[batchFeature].status === "running" || views[batchFeature].status === "queued");

  // 地圖上方的操作提示：新增模式、拖 Region。
  const hint =
    feature && addMode && selected
      ? `點地圖加入「${selected.name}」${feature === "postcard-check" ? "；拖點可移動位置" : "；拖框可移動，拖四角可改半徑"}`
      : editorActive
        ? "拖 8 個把手調大小，拖框內平移；會自動對齊整數格"
        : null;
  // 格子的原因卡浮在被點的格子右邊。
  const cellAnchor =
    selectedCell && (tab === "discovery" || tab === "history") && !editorActive
      ? {
          lat: selectedCell.lat,
          lng: sweepAreaSquare(selectedCell, selectedCell.radius).east,
          content: <CellPanel cell={selectedCell} onClose={() => setSelectedCell(null)} onAdded={() => void refreshLists("quiet-search")} />,
        }
      : null;

  return (
    <div className="layout">
      <div className="map-area">
        <WaypointMap
          waypoints={mapWaypoints}
          sightings={visibleSightings(mapSightings, now, showAllSightings)}
          now={now}
          areas={editorActive ? previewAreas : [...areas, ...previewAreas]}
          selectedAreaId={cellAnchor ? selectedCell!.areaId : null}
          editor={editorState}
          boxEditor={boxEditor}
          centerRef={centerRef}
          checkMarks={checkMarks}
          historyPoints={historyPoints}
          region={(tab === "discovery" || tab === "history") && !editorActive ? (discoveryInfo?.region ?? null) : null}
          onAreaClick={clickCell}
          onMapClick={feature && selectedId !== null && addMode ? addAt : undefined}
          onMarkerEdit={edit}
          draggable={dotDragging}
          onWaypointMove={(w, lat, lng) => void commitWaypoint(w.id, { lat, lng })}
          pending={pendingAdd}
          onPendingMove={(lat, lng) => setEditing((e) => (e?.mode === "add" ? { mode: "add", lat, lng } : e))}
          anchor={cellAnchor}
        >
          {/* 美片菇分頁不畫 Sighting，不需要這個開關。 */}
          {tab !== "postcard" && (
            <label className="map-ctl map-toggle check">
              <input type="checkbox" checked={showAllSightings} onChange={(e) => setShowAllSightings(e.target.checked)} />
              顯示全部 Sighting（含已過期）
            </label>
          )}
          {hint && (
            <div className="map-hint">
              {editorActive ? icons.map : icons.plus}
              {hint}
            </div>
          )}
          <BatchDrawer onFollow={(f, id) => (BATCH_FEATURES as readonly string[]).includes(f) && follow(f as BatchFeature, id)} view={drawerView} feature={drawerFeature} />
        </WaypointMap>
      </div>
      <aside className="panel">
        <div className="brand">
          <BrandMark />
          <span className="name">
            Pikmin Bloom <em>Shell</em>
          </span>
        </div>
        <div className="panel-body">
          <div className="tabs" role="tablist">
            {tabButton("quiet", featureName("quiet-search"))}
            {tabButton("discovery", featureName("discovery"))}
            {tabButton("postcard", featureName("postcard-check"))}
            {tabButton("target", featureName("target-search"))}
            {tabButton("history", "歷史")}
          </div>
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
              addMode={addMode}
              onToggleAdd={() => setAddMode((v) => !v)}
              notice={notice}
              editingId={editingId}
              form={form}
              busy={featureBusy}
            />
          )}
          {tab === "quiet" && <QuietSearchPanel list={selected} view={view} radius={quietRadius} onRadiusChange={setQuietRadius} onStarted={(id) => follow("quiet-search", id)} />}
          {tab === "discovery" && (
            <DiscoveryPanel
              editor={editor}
              centerRef={centerRef}
              result={discoveryInfo}
              showingResult={discoveryInfo !== null && !editorActive}
              view={view}
              onStarted={(batchId) => (editor.setEditing(false), follow("discovery", batchId))}
            />
          )}
          {tab === "postcard" && <PostcardCheckPanel list={selected} waypoints={waypoints} view={view} onStarted={(id) => follow("postcard-check", id)} />}
          {tab === "history" && <HistoryPanel refreshKey={BATCH_FEATURES.map((f) => views[f].status).join()} onDetail={setHistoryDetail} />}
          {tab === "target" && <TargetSearchPanel list={selected} view={view} radius={targetRadius} onRadiusChange={setTargetRadius} onStarted={(id) => follow("target-search", id)} deviceBusy={runningFeature !== null} />}
        </div>
      </aside>
    </div>
  );
}
