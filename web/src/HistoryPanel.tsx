import { useCallback, useEffect, useState } from "react";
import { ConfirmButton } from "./ConfirmButton.js";
import { featureName, type HistoryDetail, type HistoryRow } from "@shell/shared";
import { api } from "./api.js";
import { CheckResultCard } from "./CheckResultCard.js";
import { QuietResultCard } from "./QuietResultCard.js";
import { SightingCard } from "./SightingCard.js";
import { CHECK_LABEL, countVerdicts, Field, icons, Section, Shot, StatusBadge, Tally } from "./ui.js";

const busy = (r: { status: string }) => r.status === "running" || r.status === "queued";
const pad = (n: number) => String(n).padStart(2, "0");
/** 「11/17 14:30」；同一天的結束時間只寫「15:12」。 */
const fmtTime = (iso: string, sameDayAs?: string) => {
  const d = new Date(iso);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDayAs && new Date(sameDayAs).toDateString() === d.toDateString()) return hm;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
const fmtSpan = (r: HistoryRow) => `${fmtTime(r.createdAt)} → ${r.finishedAt ? fmtTime(r.finishedAt, r.createdAt) : "—"}`;
const listText = (r: HistoryRow) => `${r.listName ?? "（清單已刪除）"}${r.listId === null && r.listName && r.feature !== "discovery" ? "（清單已刪除）" : ""}`;

/** 歷史頁：所有功能的 Batch；點進去看每個 Waypoint 的結果（從 DB 讀，重新整理也在）；可刪除。 */
export function HistoryPanel({ refreshKey, onDetail }: { refreshKey: unknown; onDetail: (d: HistoryDetail | null) => void }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [detail, setDetailState] = useState<HistoryDetail | null>(null);
  // 點選的 Batch 也交給 App，地圖才能畫它的結果。
  const setDetail = (d: HistoryDetail | null) => (setDetailState(d), onDetail(d));
  useEffect(() => () => onDetail(null), []); // 離開歷史分頁就不再畫
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [limitMb, setLimitMb] = useState<string>("");
  const [limitError, setLimitError] = useState<string | null>(null);
  useEffect(() => void api.settings().then((s) => setLimitMb(String(Math.round(s.runsLimitBytes / 1024 ** 2)))), []);
  const saveLimit = async () => {
    const mb = Number(limitMb);
    if (!(mb > 0)) return setLimitError("上限要是大於 0 的數字（MB）");
    setLimitError(null);
    try {
      await api.saveSettings({ runsLimitBytes: Math.round(mb * 1024 ** 2) });
    } catch (e) {
      setLimitError((e as Error).message);
    }
    await reload();
  };

  const reload = useCallback(async () => setRows(await api.history(filter || undefined)), [filter]);
  useEffect(() => void reload(), [reload, refreshKey]);

  const open = async (id: number) => setDetail(await api.historyDetail(id));
  const remove = async (r: HistoryRow) => {
    setMessage(null);
    try {
      await api.deleteBatch(r.id);
      if (detail?.id === r.id) setDetail(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
    await reload();
  };

  if (detail) return <Detail detail={detail} onBack={() => setDetail(null)} />;

  return (
    <>
      <Section title="歷史">
        <label className="line">
          <span className="field-label">功能</span>
          <select className="select grow" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部</option>
            {["quiet-search", "discovery", "postcard-check", "target-search"].map((f) => (
              <option key={f} value={f}>
                {featureName(f)}
              </option>
            ))}
          </select>
        </label>
        {message && <p className="err">{message}</p>}
        {rows.length === 0 && <p className="muted">還沒有任何 Batch。到無人巨菇、探索區域、美片菇或指定菇菇按「開始」後，紀錄會出現在這裡。</p>}
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div className="head">
              <span className="idx num">#{r.id}</span>
              <span className="title">{featureName(r.feature)}</span>
              <StatusBadge status={r.status} />
            </div>
            <p className="muted">
              {listText(r)}｜<span className="num">{fmtSpan(r)}</span>
            </p>
            <p>{r.summary}</p>
            {r.imagesCleared && <p className="muted">圖片已清除</p>}
            <div className="line">
              <span className="grow">
                <button className="btn link" onClick={() => void open(r.id)}>
                  查看結果{icons.arrow}
                </button>
              </span>
              <ConfirmButton id={`batch:${r.id}`} icon disabled={busy(r)} title={busy(r) ? "執行中或排隊中的 Batch 不能刪除" : "會一併刪掉資料庫紀錄與 run 資料夾（截圖），無法復原"} onConfirm={() => void remove(r)} />
            </div>
          </div>
        ))}
      </Section>
      <Section title="儲存空間">
        <Field label="run 資料夾上限" err={limitError}>
          <span className="line">
            <input className={`input grow ${limitError ? "invalid" : ""}`} type="number" min="1" value={limitMb} onChange={(e) => setLimitMb(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void saveLimit()} />
            <span className="muted">MB</span>
            <button className="btn" onClick={(e) => (e.preventDefault(), void saveLimit())}>
              儲存
            </button>
          </span>
        </Field>
        <p className="muted">超過上限時，從最舊的 Batch 開始清掉截圖；文字結果保留，執行中與排隊中的不動。</p>
      </Section>
    </>
  );
}

function Detail({ detail, onBack }: { detail: HistoryDetail; onBack: () => void }) {
  const quiet = detail.waypoints.filter((w) => w.quiet);
  const check = detail.waypoints.filter((w) => w.check);
  const checkCounts = { yes: 0, no: 0, unknown: 0 };
  for (const w of check) checkCounts[w.check!.result.found === true ? "yes" : w.check!.result.found === false ? "no" : "unknown"]++;
  return (
    <>
      <Section>
        <div>
          <button className="btn link" onClick={onBack}>
            {icons.back}回列表
          </button>
        </div>
        <div className="line">
          <span className="h-title grow">
            Batch #{detail.id}｜{featureName(detail.feature)}
          </span>
          <StatusBadge status={detail.status} />
        </div>
        <p className="muted">
          {listText(detail)}｜<span className="num">{fmtSpan(detail)}</span>
        </p>
        <p>{detail.summary}</p>
        {quiet.length > 0 && <Tally counts={countVerdicts(quiet.map((w) => w.quiet!.result.verdict))} />}
        {check.length > 0 && <Tally counts={checkCounts} labels={CHECK_LABEL} />}
        {detail.imagesCleared && <p className="muted">圖片已清除（超過 run 資料夾上限，只保留文字結果）</p>}
        {detail.error && <p className="err">{detail.error}</p>}
      </Section>
      {detail.waypoints.length > 0 && (
        <Section title="結果">
          {detail.waypoints.map((w) =>
            w.check ? (
              <CheckResultCard key={w.index} outcome={w.check} name={w.label} />
            ) : w.quiet ? (
              <QuietResultCard
                key={w.index}
                outcome={{ index: w.index, waypointId: w.waypointId, point: w.point, radius: w.quiet.radius, result: w.quiet.result, ...(w.abortUrl ? { screenshotUrl: w.abortUrl } : {}) }}
                name={w.label}
                giants={w.sightings}
              />
            ) : (
              <div key={w.index} className="card">
                <div className="head">
                  <span className="idx num">#{w.index}</span>
                  <span className="title">{w.label}</span>
                  {w.error ? <span className="badge no">{icons.cross}失敗</span> : <span className={`badge ${w.sightings.length > 0 ? "yes" : "unknown"}`}>找到 {w.sightings.length} 筆</span>}
                </div>
                {w.error && <p className="err">{w.error}</p>}
                {w.abortUrl && (
                  <div className="shots">
                    <Shot url={w.abortUrl} alt="abort.png" />
                  </div>
                )}
                {w.sightings.map((s) => (
                  <SightingCard key={s.id} s={s} />
                ))}
              </div>
            ),
          )}
        </Section>
      )}
    </>
  );
}
