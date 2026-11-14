import { useCallback, useEffect, useState } from "react";
import type { ImportLineError, Waypoint, WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { WaypointMap } from "./Map.js";

export function App() {
  const [lists, setLists] = useState<WaypointList[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [newName, setNewName] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ImportLineError[]>([]);

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

  return (
    <div className="layout">
      <WaypointMap waypoints={waypoints} />
      <div className="panel">
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
            <h4>匯入到「{selected.name}」</h4>
            <textarea
              value={text}
              placeholder={"每行 lat,lng [標籤]\n25.033964,121.564468 台北 101"}
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
      </div>
    </div>
  );
}
