import { useCallback, useEffect, useState } from "react";
import type { HistoryDetail, HistoryRow } from "@shell/shared";
import { api } from "./api.js";
import { QuietResultCard } from "./QuietResultCard.js";
import { SightingCard } from "./SightingCard.js";

const FEATURE: Record<string, string> = { "target-search": "Target Search", "quiet-search": "Quiet Giant Search", discovery: "Discovery" };
const STATUS: Record<string, string> = { running: "執行中", queued: "排隊中", done: "完成", failed: "失敗", cancelled: "已取消" };
const busy = (r: { status: string }) => r.status === "running" || r.status === "queued";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

/** 歷史頁：所有功能的 Batch；點進去看每個 Waypoint 的結果（從 DB 讀，重新整理也在）；可刪除。 */
export function HistoryPanel({ refreshKey }: { refreshKey: unknown }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [limitMb, setLimitMb] = useState<string>("");
  useEffect(() => void api.settings().then((s) => setLimitMb(String(Math.round(s.runsLimitBytes / 1024 ** 2)))), []);
  const saveLimit = async () => {
    const mb = Number(limitMb);
    if (!(mb > 0)) return setMessage("上限要是大於 0 的數字（MB）");
    setMessage(null);
    try {
      await api.saveSettings({ runsLimitBytes: Math.round(mb * 1024 ** 2) });
    } catch (e) {
      setMessage((e as Error).message);
    }
    await reload();
  };

  const reload = useCallback(async () => setRows(await api.history()), []);
  useEffect(() => void reload(), [reload, refreshKey]);

  const open = async (id: number) => setDetail(await api.historyDetail(id));
  const remove = async (r: HistoryRow) => {
    if (!window.confirm(`刪除 Batch #${r.id}（${FEATURE[r.feature] ?? r.feature}）？\n會一併刪掉資料庫紀錄與 run 資料夾（截圖），無法復原。`)) return;
    setMessage(null);
    try {
      await api.deleteBatch(r.id);
      if (detail?.id === r.id) setDetail(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
    await reload();
  };

  if (detail) {
    return (
      <div>
        <button onClick={() => setDetail(null)}>← 回列表</button>
        <h4>
          Batch #{detail.id}｜{FEATURE[detail.feature] ?? detail.feature}
        </h4>
        <p className="muted">
          {detail.listName ?? "（清單已刪除）"}｜{STATUS[detail.status] ?? detail.status}｜{fmt(detail.createdAt)} → {fmt(detail.finishedAt)}
        </p>
        <p>{detail.summary}</p>
        {detail.imagesCleared && <p className="muted">圖片已清除（超過 run 資料夾上限，只保留文字結果）</p>}
        {detail.error && <p className="errors">{detail.error}</p>}
        {detail.waypoints.map((w) =>
          w.quiet ? (
            <QuietResultCard
              key={w.index}
              outcome={{ index: w.index, waypointId: w.waypointId, radius: w.quiet.radius, result: w.quiet.result }}
              name={w.label}
              giants={w.sightings}
            />
          ) : (
            <div key={w.index} className="card">
              <strong>
                第 {w.index} 個｜{w.label}
              </strong>
              {w.error ? <div className="errors">失敗：{w.error}</div> : <div>找到 {w.sightings.length} 筆</div>}
              {w.sightings.map((s) => (
                <SightingCard key={s.id} s={s} />
              ))}
            </div>
          ),
        )}
      </div>
    );
  }

  return (
    <div>
      <h4>歷史</h4>
      <label className="muted">
        run 資料夾上限（MB）{" "}
        <input type="number" min="1" value={limitMb} onChange={(e) => setLimitMb(e.target.value)} />
      </label>{" "}
      <button onClick={saveLimit}>儲存</button>
      {message && <p className="errors">{message}</p>}
      {rows.length === 0 && <p className="muted">還沒有任何 Batch</p>}
      {rows.map((r) => (
        <div key={r.id} className="card">
          <strong>
            #{r.id}｜{FEATURE[r.feature] ?? r.feature}
          </strong>
          ：{STATUS[r.status] ?? r.status}
          <div className="muted">
            {r.listName ?? "（清單已刪除）"}｜{fmt(r.createdAt)} → {fmt(r.finishedAt)}
          </div>
          <div>{r.summary}</div>
          {r.imagesCleared && <div className="muted">圖片已清除</div>}
          <button onClick={() => open(r.id)}>查看</button>{" "}
          <button disabled={busy(r)} title={busy(r) ? "執行中或排隊中的 Batch 不能刪除" : undefined} onClick={() => remove(r)}>
            刪除
          </button>
        </div>
      ))}
    </div>
  );
}
