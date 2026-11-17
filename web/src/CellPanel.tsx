import { useEffect, useState } from "react";
import { gridCellWaypointLabel, isDuplicateWaypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { Field, icons, toVerdict, VerdictBadge } from "./ui.js";

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

/** 點 Grid Cell 後在格子旁邊浮出的卡片：答案與原因；綠格可以加入無人巨菇清單（畫面內表單，不用瀏覽器對話框）。 */
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
    setMessage(null);
    const ls = await api.lists("quiet-search").catch(() => []);
    setLists(ls);
    setTarget(ls[0] ? String(ls[0].id) : NEW);
  };

  const add = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let listId: number;
      let listName: string;
      if (target === NEW) {
        if (!newName.trim()) return setMessage({ ok: false, text: "請輸入新清單的名稱" });
        const l = await api.createList(newName.trim(), "quiet-search");
        listId = l.id;
        listName = l.name;
      } else {
        listId = Number(target);
        listName = lists.find((l) => l.id === listId)?.name ?? "";
      }
      const existing = await api.waypoints(listId);
      if (isDuplicateWaypoint(existing, { lat: cell.lat, lng: cell.lng, radius: cell.radius })) {
        return setMessage({ ok: false, text: "已在清單裡" });
      }
      await api.addWaypoint(listId, cell.lat, cell.lng, { radius: cell.radius, label: gridCellWaypointLabel(cell.regionName, cell.number - 1) });
      setAdding(false);
      setMessage({ ok: true, text: `已加入「${listName}」` });
      onAdded?.();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="popover" role="dialog" aria-label={`${cell.regionName} 格 ${cell.number}`}>
      <div className="head">
        <span className="title">格 {cell.number}</span>
        <VerdictBadge v={toVerdict(cell.verdict)} />
        <button className="btn icon" title="關閉" aria-label="關閉" onClick={onClose}>
          {icons.cross}
        </button>
      </div>
      <p>{cell.reason}</p>
      <p className="muted">半徑 {cell.radius} m</p>
      {cell.verdict === true && !adding && !message?.ok && (
        <div>
          <button className="btn small" onClick={open}>
            {icons.plus}加入無人巨菇清單
          </button>
        </div>
      )}
      {adding && (
        <>
          <Field label="加到哪份清單">
            <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}（{l.waypointCount}）
                </option>
              ))}
              <option value={NEW}>新建清單…</option>
            </select>
          </Field>
          {target === NEW && (
            <Field label="新清單名稱">
              <input className="input" value={newName} placeholder="新清單的名稱" autoFocus onChange={(e) => setNewName(e.target.value)} />
            </Field>
          )}
          <div className="line">
            <button className="btn small primary" disabled={busy} onClick={add}>
              加入
            </button>
            <button className="btn small" disabled={busy} onClick={() => setAdding(false)}>
              取消
            </button>
          </div>
        </>
      )}
      {message && (message.ok ? <p className="ok">{icons.check}{message.text}</p> : <p className="err">{message.text}</p>)}
    </div>
  );
}
