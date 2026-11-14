import { useCallback, useEffect, useState } from "react";
import { sweepAreaColor, visibleSightings, type ImportLineError, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { WaypointMap, type SweepArea } from "./Map.js";
import { HistoryPanel } from "./HistoryPanel.js";
import { QuietSearchPanel } from "./QuietSearchPanel.js";
import { TargetSearchPanel } from "./TargetSearchPanel.js";
import { useNow } from "./useNow.js";
import { useBatchView } from "./useBatchView.js";

export function App() {
  const [lists, setLists] = useState<WaypointList[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [newName, setNewName] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ImportLineError[]>([]);
  const [tab, setTab] = useState<"lists" | "quiet" | "target" | "history">("lists");
  const [showAllSightings, setShowAllSightings] = useState(false);
  const { view, follow } = useBatchView();
  const now = useNow();

  const refreshLists = useCallback(async () => setLists(await api.lists()), []);
  useEffect(() => void refreshLists(), [refreshLists]);

  useEffect(() => {
    if (selectedId === null) return setWaypoints([]);
    void api.waypoints(selectedId).then(setWaypoints);
  }, [selectedId]);

  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const create = async () => {
    if (!newName.trim()) return;
    const l = await api.createList(newName);
    setNewName("");
    await refreshLists();
    setSelectedId(l.id);
  };
  const rename = async (l: WaypointList) => {
    const name = window.prompt("新名稱", l.name);
    if (name?.trim()) {
      await api.renameList(l.id, name);
      await refreshLists();
    }
  };
  const remove = async (l: WaypointList) => {
    if (!window.confirm(`刪除「${l.name}」？`)) return;
    await api.deleteList(l.id);
    if (selectedId === l.id) setSelectedId(null);
    await refreshLists();
  };
  const doImport = async () => {
    if (selectedId === null) return;
    const r = await api.importText(selectedId, text);
    setErrors(r.errors);
    setText(r.errors.map((e) => e.text).join("\n"));
    setWaypoints(await api.waypoints(selectedId));
    await refreshLists();
  };

  const reload = async () => {
    if (selectedId === null) return;
    setWaypoints(await api.waypoints(selectedId));
    await refreshLists();
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

  // Quiet Giant Search 的結果：以該 Waypoint 為中心、邊長 2R 的正方形。
  const areas: SweepArea[] = view.quietResults.flatMap((o) => {
    const w = waypoints.find((x) => x.id === o.waypointId);
    if (!w) return [];
    return [{ lat: w.lat, lng: w.lng, radius: o.radius, color: sweepAreaColor(o.result.verdict), tooltip: o.result.reason }];
  });

  return (
    <div className="layout">
      <WaypointMap
        waypoints={waypoints}
        sightings={visibleSightings(view.sightings, now, showAllSightings)}
        now={now}
        areas={areas}
        onMapClick={selectedId === null ? undefined : addAt}
        onMarkerClick={edit}
      />
      <div className="panel">
        <div className="tabs">
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}>
            Waypoint List
          </button>
          <button className={tab === "quiet" ? "active" : ""} onClick={() => setTab("quiet")}>
            Quiet Giant Search
          </button>
          <button className={tab === "target" ? "active" : ""} onClick={() => setTab("target")}>
            Target Search
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            歷史
          </button>
        </div>
        <label className="muted">
          <input type="checkbox" checked={showAllSightings} onChange={(e) => setShowAllSightings(e.target.checked)} />
          地圖顯示全部 Sighting（含已過期）
        </label>
        {tab === "quiet" && <QuietSearchPanel list={selected} waypoints={waypoints} view={view} onStarted={follow} />}
        {tab === "history" && <HistoryPanel refreshKey={view.status} />}
        {tab === "target" && <TargetSearchPanel list={selected} view={view} onStarted={follow} />}
        {tab === "lists" && <>
        <h3>Waypoint List</h3>
        <input value={newName} placeholder="新清單名稱" onChange={(e) => setNewName(e.target.value)} />
        <button onClick={create}>建立</button>
        <ul>
          {lists.map((l) => (
            <li key={l.id} className={l.id === selectedId ? "selected" : ""}>
              <a href="#" onClick={(e) => (e.preventDefault(), setSelectedId(l.id))}>
                {l.name}（{l.waypointCount}）
              </a>{" "}
              <button onClick={() => rename(l)}>改名</button> <button onClick={() => remove(l)}>刪除</button>
            </li>
          ))}
        </ul>
        {selected && (
          <>
            <h4>Waypoint（點地圖新增、點標記編輯）</h4>
            <ol>
              {waypoints.map((w, i) => (
                <li key={w.id}>
                  {w.label || `${w.lat}, ${w.lng}`}
                  {w.spotName ? `〔${w.spotName}〕` : ""}
                  {w.radius !== null ? ` r=${w.radius}` : ""}{" "}
                  <button disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button disabled={i === waypoints.length - 1} onClick={() => move(i, 1)}>↓</button>{" "}
                  <button onClick={() => edit(w)}>編輯</button> <button onClick={() => removeWaypoint(w)}>刪除</button>
                </li>
              ))}
            </ol>
            <h4>匯入到「{selected.name}」</h4>
            <textarea
              value={text}
              placeholder={"每行 lat,lng [r=半徑公尺] [標籤] 或 Google Maps 連結\n25.033964,121.564468 r=300 台北 101"}
              onChange={(e) => setText(e.target.value)}
            />
            <button onClick={doImport}>匯入</button>
            {errors.length > 0 && (
              <div className="errors">
                <p>有 {errors.length} 行無法匯入（已留在文字框）：</p>
                <ul>
                  {errors.map((e) => (
                    <li key={e.line}>
                      第 {e.line} 行：{e.reason}　「{e.text}」
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        </>}
      </div>
    </div>
  );
}
