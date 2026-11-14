import { useEffect, useState } from "react";
import { gridCellWaypointLabel, isDuplicateWaypoint, sweepAreaColor, type WaypointList } from "@shell/shared";
import { api } from "./api.js";

export interface CellInfo {
  regionName: string;
  /** 格 N 的 N（從 1 起算）。 */
  number: number;
  lat: number;
  lng: number;
  radius: number;
  verdict: boolean | null;
  reason: string;
}

const NEW = "new";
const ANSWER = { green: "是", red: "不是", gray: "無法判斷" } as const;

/** 點 Grid Cell 後的卡片：答案與原因；綠格可以加入無人巨菇清單（畫面內表單，不用瀏覽器對話框）。 */
export function CellPanel({ cell, onClose, onAdded }: { cell: CellInfo; onClose: () => void; onAdded?: () => void }) {
  const [adding, setAdding] = useState(false);
  const [lists, setLists] = useState<WaypointList[]>([]);
  const [target, setTarget] = useState<string>(NEW);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // 換一格就重來。
  useEffect(() => {
    setAdding(false);
    setMessage(null);
  }, [cell.regionName, cell.number, cell.lat, cell.lng]);

  const open = async () => {
    setAdding(true);
    const ls = await api.lists("quiet-search").catch(() => []);
    setLists(ls);
    setTarget(ls[0] ? String(ls[0].id) : NEW);
  };

  const add = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let listId: number;
      if (target === NEW) {
        if (!newName.trim()) return setMessage({ ok: false, text: "請輸入新清單的名稱" });
        listId = (await api.createList(newName.trim(), "quiet-search")).id;
      } else {
        listId = Number(target);
      }
      const existing = await api.waypoints(listId);
      if (isDuplicateWaypoint(existing, { lat: cell.lat, lng: cell.lng, radius: cell.radius })) {
        return setMessage({ ok: false, text: "已在清單裡" });
      }
      await api.addWaypoint(listId, cell.lat, cell.lng, { radius: cell.radius, label: gridCellWaypointLabel(cell.regionName, cell.number - 1) });
      setMessage({ ok: true, text: "已加入清單" });
      onAdded?.();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const color = sweepAreaColor(cell.verdict);
  return (
    <div className={`card quiet ${color}`}>
      <strong>
        {cell.regionName} 格 {cell.number}
      </strong>
      ：{ANSWER[color]}（半徑 {cell.radius} m）
      <div>{cell.reason}</div>
      {cell.verdict === true && !adding && <button onClick={open}>加入無人巨菇清單…</button>}{" "}
      <button onClick={onClose}>關閉</button>
      {adding && (
        <div>
          <label>
            清單{" "}
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
              <option value={NEW}>新建清單…</option>
            </select>
          </label>
          {target === NEW && (
            <label>
              {" "}
              名稱 <input value={newName} placeholder="新清單的名稱" onChange={(e) => setNewName(e.target.value)} />
            </label>
          )}{" "}
          <button disabled={busy} onClick={add}>
            加入
          </button>{" "}
          <button disabled={busy} onClick={() => setAdding(false)}>
            取消
          </button>
        </div>
      )}
      {message && <p className={message.ok ? "muted" : "errors"}>{message.text}</p>}
    </div>
  );
}
