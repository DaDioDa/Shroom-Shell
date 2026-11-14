import { useState } from "react";
import { featureName, type ImportLineError, type ListFeature, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";

const IMPORT_HINT: Record<ListFeature, string> = {
  "postcard-check": "每行都要有 @Spot Name（寫在行尾），不能帶半徑。Postcard Check 的 GPS 要夠準：check 只看冷啟動後的起點畫面。",
  "quiet-search": "每行 lat,lng [r=半徑公尺] [標籤]，或 Google Maps 連結；不使用 Spot Name。",
  "target-search": "每行 lat,lng [r=半徑公尺] [標籤]，或 Google Maps 連結；不使用 Spot Name。",
};
const IMPORT_PLACEHOLDER: Record<ListFeature, string> = {
  "postcard-check": "每行 lat,lng [標籤] @Spot Name 或 Google Maps 連結\n25.033964,121.564468 台北 101 @生賀神社",
  "quiet-search": "每行 lat,lng [r=半徑公尺] [標籤] 或 Google Maps 連結\n25.033964,121.564468 r=300 台北 101",
  "target-search": "每行 lat,lng [r=半徑公尺] [標籤] 或 Google Maps 連結\n25.033964,121.564468 r=300 台北 101",
};

interface Props {
  feature: ListFeature;
  lists: WaypointList[];
  selectedId: number | null;
  waypoints: Waypoint[];
  onSelect: (id: number | null) => void;
  /** 清單增減或改名後要重抓這個功能的清單。 */
  onListsChanged: () => Promise<void>;
  /** 選定清單的 Waypoint 有變動後要重抓。 */
  onWaypointsChanged: () => Promise<void>;
  onEdit: (w: Waypoint) => void;
  onRemoveWaypoint: (w: Waypoint) => void;
  onMove: (index: number, delta: -1 | 1) => void;
}

/** 三個功能分頁共用的清單管理：下拉選清單、建立、改名、刪除、匯入、Waypoint 列表。 */
export function ListManager({ feature, lists, selectedId, waypoints, onSelect, onListsChanged, onWaypointsChanged, onEdit, onRemoveWaypoint, onMove }: Props) {
  const [newName, setNewName] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ImportLineError[]>([]);
  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const create = async () => {
    if (!newName.trim()) return;
    const l = await api.createList(newName, feature);
    setNewName("");
    await onListsChanged();
    onSelect(l.id);
  };
  const rename = async (l: WaypointList) => {
    const name = window.prompt("新名稱", l.name);
    if (name?.trim()) {
      await api.renameList(l.id, name);
      await onListsChanged();
    }
  };
  const remove = async (l: WaypointList) => {
    if (!window.confirm(`刪除「${l.name}」？`)) return;
    await api.deleteList(l.id);
    if (selectedId === l.id) onSelect(null);
    await onListsChanged();
  };
  const doImport = async () => {
    if (selectedId === null) return;
    const r = await api.importText(selectedId, text);
    setErrors(r.errors);
    setText(r.errors.map((e) => e.text).join("\n"));
    await onWaypointsChanged();
    await onListsChanged();
  };

  return (
    <>
      <h3>{featureName(feature)}清單</h3>
      <select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value === "" ? null : Number(e.target.value))}>
        <option value="">（未選清單）</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}（{l.waypointCount}）
          </option>
        ))}
      </select>{" "}
      {selected && (
        <>
          <button onClick={() => rename(selected)}>改名</button> <button onClick={() => remove(selected)}>刪除</button>
        </>
      )}
      <div>
        <input value={newName} placeholder="新清單名稱" onChange={(e) => setNewName(e.target.value)} />
        <button onClick={create}>建立</button>
      </div>
      {selected && (
        <>
          <h4>Waypoint（點地圖新增、點標記編輯）</h4>
          <ol>
            {waypoints.map((w, i) => (
              <li key={w.id}>
                {w.label || `${w.lat}, ${w.lng}`}
                {w.spotName ? `〔${w.spotName}〕` : ""}
                {w.radius !== null ? ` r=${w.radius}` : ""}{" "}
                <button disabled={i === 0} onClick={() => onMove(i, -1)}>↑</button>
                <button disabled={i === waypoints.length - 1} onClick={() => onMove(i, 1)}>↓</button>{" "}
                <button onClick={() => onEdit(w)}>編輯</button> <button onClick={() => onRemoveWaypoint(w)}>刪除</button>
              </li>
            ))}
          </ol>
          <h4>匯入到「{selected.name}」</h4>
          <p className="muted">{IMPORT_HINT[feature]}</p>
          <textarea value={text} placeholder={IMPORT_PLACEHOLDER[feature]} onChange={(e) => setText(e.target.value)} />
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
    </>
  );
}
