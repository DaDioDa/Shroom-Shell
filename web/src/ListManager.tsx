import { useEffect, useState, type ReactNode } from "react";
import { featureName, type ImportLineError, type ListFeature, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { ConfirmButton } from "./ConfirmButton.js";
import { Disclosure, icons, Section } from "./ui.js";

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

/** 清單列的小字：美片菇是 @Spot Name（缺的標紅），其他是半徑。 */
const metaOf = (feature: ListFeature, w: Waypoint): { text: string; bad?: boolean } =>
  feature === "postcard-check" ? (w.spotName ? { text: `@${w.spotName}` } : { text: "缺 Spot Name", bad: true }) : { text: w.radius !== null ? `r=${w.radius} m` : "未設半徑，用預設" };

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
  /** 「在地圖上新增」模式是否開著。 */
  addMode: boolean;
  onToggleAdd: () => void;
  /** 新增時的錯誤等訊息。 */
  notice: string | null;
  /** 正在編輯的 Waypoint（那一列反白，form 接在它下面）；"new" 表示新增，form 接在清單最後。 */
  editingId: number | "new" | null;
  form: ReactNode;
  /** 這個功能有 Batch 在跑或排隊：Waypoint 列表自動收合，讓結果卡片不用捲很遠。 */
  busy: boolean;
}

/** 三個功能分頁共用的清單區塊：下拉選清單、建立、改名、刪除、在地圖上新增、Waypoint 列表、從文字匯入。 */
export function ListManager({ feature, lists, selectedId, waypoints, onSelect, onListsChanged, onWaypointsChanged, onEdit, onRemoveWaypoint, onMove, addMode, onToggleAdd, notice, editingId, form, busy }: Props) {
  const [newName, setNewName] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ImportLineError[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(!busy);
  const [importOpen, setImportOpen] = useState(false);
  const selected = lists.find((l) => l.id === selectedId) ?? null;

  // Batch 一開始就收合；跑完不自動展開（使用者可能正在看結果）。
  useEffect(() => {
    if (busy) setListOpen(false);
  }, [busy]);
  // 有列在編輯時一定展開，表單才看得到。
  useEffect(() => {
    if (editingId !== null) setListOpen(true);
  }, [editingId]);

  const create = async () => {
    if (!newName.trim()) return;
    const l = await api.createList(newName, feature);
    setNewName("");
    await onListsChanged();
    onSelect(l.id);
  };
  const rename = async (l: WaypointList) => {
    if (renaming?.trim()) {
      await api.renameList(l.id, renaming);
      await onListsChanged();
    }
    setRenaming(null);
  };
  const toggleAdd = () => {
    if (selected === null) return setHint("請先選擇或建立清單");
    setHint(null);
    onToggleAdd();
  };
  const remove = async (l: WaypointList) => {
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
    <Section title={`${featureName(feature)}清單`}>
      {selected && renaming !== null ? (
        <div className="line">
          <input className="input grow" aria-label="新的清單名稱" value={renaming} autoFocus onChange={(e) => setRenaming(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void rename(selected)} />
          <button className="btn small primary" onClick={() => void rename(selected)}>
            儲存
          </button>
          <button className="btn small" onClick={() => setRenaming(null)}>
            取消
          </button>
        </div>
      ) : (
        <div className="line">
          <select className="select grow" aria-label="清單" value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">（未選清單）</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}（{l.waypointCount}）
              </option>
            ))}
          </select>
          {selected && (
            <>
              <button className="btn small" onClick={() => setRenaming(selected.name)}>
                改名
              </button>
              <ConfirmButton id={`list:${selected.id}`} onConfirm={() => void remove(selected)} />
            </>
          )}
        </div>
      )}
      <div className="line">
        <input className="input grow" aria-label="新清單名稱" value={newName} placeholder="新清單名稱" onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
        <button className="btn" onClick={create}>
          建立
        </button>
      </div>
      {selected === null ? (
        <>
          <p className="muted">先選一份清單，或建立新的清單，才能加 Waypoint。</p>
          {hint && <p className="err">{hint}</p>}
        </>
      ) : (
        <>
          <button className={`btn ${addMode ? "on" : ""}`} aria-pressed={addMode} onClick={toggleAdd}>
            {icons.plus}在地圖上新增
          </button>
          {(hint ?? notice) && <p className="err">{hint ?? notice}</p>}
          <Disclosure label="Waypoint" count={`${waypoints.length} 個`} open={listOpen} onToggle={setListOpen}>
            {waypoints.length === 0 && editingId !== "new" && <p className="muted">還沒有 Waypoint。按「在地圖上新增」點地圖，或從文字匯入。</p>}
            <div className="wplist">
              {waypoints.map((w, i) => {
                const meta = metaOf(feature, w);
                const name = w.label || `${w.lat}, ${w.lng}`;
                return (
                  <div key={w.id}>
                    <div className={`wp ${editingId === w.id ? "editing" : ""}`}>
                      <span className="n">{i + 1}</span>
                      <div className="grow">
                        <div className="name" title={name} onClick={() => onEdit(w)}>
                          {name}
                        </div>
                        <div className={`meta ${meta.bad ? "err" : ""}`}>{meta.text}</div>
                      </div>
                      <span className="acts">
                        <button className="btn icon" title="上移" aria-label="上移" disabled={i === 0} onClick={() => onMove(i, -1)}>
                          {icons.up}
                        </button>
                        <button className="btn icon" title="下移" aria-label="下移" disabled={i === waypoints.length - 1} onClick={() => onMove(i, 1)}>
                          {icons.down}
                        </button>
                        <button className="btn icon" title="編輯" aria-label="編輯" onClick={() => onEdit(w)}>
                          {icons.edit}
                        </button>
                        <ConfirmButton id={`wp:${w.id}`} icon onConfirm={() => onRemoveWaypoint(w)} />
                      </span>
                    </div>
                    {editingId === w.id && form}
                  </div>
                );
              })}
              {editingId === "new" && form}
            </div>
          </Disclosure>
          <Disclosure label={`從文字匯入到「${selected.name}」`} open={importOpen || errors.length > 0} onToggle={(o) => (setImportOpen(o), !o && setErrors([]))}>
            <p className="muted">{IMPORT_HINT[feature]}</p>
            <textarea className="textarea" aria-label="匯入文字" value={text} placeholder={IMPORT_PLACEHOLDER[feature]} onChange={(e) => setText(e.target.value)} />
            {errors.length > 0 && (
              <div className="errbox">
                <p>有 {errors.length} 行無法匯入（已留在文字框）：</p>
                {errors.map((e) => (
                  <p key={e.line}>
                    第 {e.line} 行：{e.reason}　「{e.text}」
                  </p>
                ))}
              </div>
            )}
            <div>
              <button className="btn" disabled={!text.trim()} onClick={doImport}>
                匯入
              </button>
            </div>
          </Disclosure>
        </>
      )}
    </Section>
  );
}
