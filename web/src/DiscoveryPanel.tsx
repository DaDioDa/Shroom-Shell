import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { defaultRegion, featureName, gridStats, planDiscovery, regionSizeKm, SLIDER_SPECS, type BatchView } from "@shell/shared";
import { api } from "./api.js";
import { Slider } from "./Slider.js";
import type { DiscoveryEditor } from "./useDiscoveryEditor.js";

interface Props {
  editor: DiscoveryEditor;
  /** 地圖目前的中央（放 Region 用）。 */
  centerRef: MutableRefObject<(() => { lat: number; lng: number }) | null>;
  /** 有上一次 Discovery 的結果可以看。 */
  hasResult: boolean;
  view: BatchView;
  onStarted: (batchId: number) => void;
}

const fmtDuration = (ms: number) => {
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} 小時 ${min % 60} 分鐘` : `${min} 分鐘`;
};
const FALLBACK_CENTER = { lat: 25.033964, lng: 121.564468 };

export function DiscoveryPanel({ editor, centerRef, hasResult, view, onStarted }: Props) {
  const { region, radius, spacing, linked, manualSpacing } = editor;
  const [name, setName] = useState("");
  const [avg, setAvg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const log = useRef<HTMLPreElement>(null);
  useEffect(() => void api.quietStats().then((s) => setAvg(s.avgMsPerPoint)).catch(() => {}), [view.status]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [view.stderr.length]);
  // Region 或間距一變，之前問的「確定開始？」就不算數。
  useEffect(() => setConfirming(false), [region, spacing, radius]);

  const plan = region ? planDiscovery({ region, spacingM: spacing, avgMsPerPoint: avg }) : null;
  const stats = region ? gridStats(region, spacing, radius) : null;
  const size = region ? regionSizeKm(region) : null;
  const busy = view.status === "running" || view.status === "queued";
  const canStart = !!plan?.ok && !busy;

  const place = () => editor.setRegion(defaultRegion(centerRef.current?.() ?? FALLBACK_CENTER, spacing));

  const start = async () => {
    if (!region || !plan?.ok) return;
    setError(null);
    setConfirming(false);
    try {
      const r = await api.startDiscovery({ ...(name.trim() ? { name: name.trim() } : {}), region, radius, spacing, confirmed: plan.needsConfirm });
      onStarted(r.batchId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <h4>{featureName("discovery")}</h4>
      <p className="muted">
        放一個 Region（最大 10 km × 10 km），拖 8 個把手調大小（自動對齊整數格），拖框內平移。每格跑一次 Quiet Giant Search。
      </p>
      <button onClick={place} disabled={busy}>
        {region ? "移到地圖中央" : "放一個 Region"}
      </button>
      {hasResult && !editor.editing && <span className="muted"> 目前顯示上一次的結果；動 Region 會切到編輯</span>}
      {hasResult && editor.editing && !busy && (
        <>
          {" "}
          <button onClick={() => editor.setEditing(false)}>顯示上次結果</button>
        </>
      )}
      <Slider label="半徑" spec={SLIDER_SPECS.radius} unit="m" value={radius} disabled={busy} onChange={editor.setRadius} />
      <label className="muted">
        <input type="checkbox" checked={linked} disabled={busy} onChange={(e) => editor.setLinked(e.target.checked)} />
        間距跟半徑連動（間距 ＝ 2 × 半徑，剛好無縫）
      </label>
      <Slider
        label="間距"
        spec={SLIDER_SPECS.spacing}
        unit="m"
        value={linked ? spacing : manualSpacing}
        disabled={busy || linked}
        valueText={linked ? () => `連動中 ${spacing} m${spacing > SLIDER_SPECS.spacing.max ? "，超過手動上限也沒關係" : ""}` : undefined}
        onChange={editor.setManualSpacing}
      />
      <div>
        <label>
          Region 名稱 <input value={name} placeholder="留空會自動命名（探索 日期 時間）" onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      {stats && size && (
        <div className="region-stats">
          <div className="region-big">
            {stats.cols} × {stats.rows} 格 = {stats.points.length} 點
          </div>
          <div>
            Region：{size.widthKm.toFixed(1)} km × {size.heightKm.toFixed(1)} km，格子 {Math.round(stats.cellW)} × {Math.round(stats.cellH)} m
          </div>
          {plan?.ok && (
            <div>
              預估 {fmtDuration(plan.estimateMs)}（{plan.estimateSource === "history" ? "依過去 quiet 的平均耗時" : "每點以 3 分鐘估"}）
              {plan.needsConfirm && "。超過 30 點，開始前會再確認一次"}
            </div>
          )}
          <div className="muted">{stats.coverageText}</div>
        </div>
      )}
      {plan && !plan.ok && <p className="errors">{plan.reason}</p>}
      {confirming && plan?.ok ? (
        <p className="confirm">
          這會跑 {plan.points.length} 個點，預估 {fmtDuration(plan.estimateMs)}。確定要開始？{" "}
          <button onClick={start}>確定開始</button> <button onClick={() => setConfirming(false)}>取消</button>
        </p>
      ) : (
        <button disabled={!canStart} onClick={() => (plan?.ok && plan.needsConfirm ? setConfirming(true) : void start())}>
          開始
        </button>
      )}
      {busy && <span className="muted"> 執行中，Region 已鎖住</span>}
      {error && <p className="errors">{error}</p>}
      <p className="muted">結果：綠＝是、紅＝不是、灰＝無法判斷。點格子看原因；綠格可以自己選要不要加入無人巨菇清單。</p>
      {view.status !== "idle" && (
        <>
          <p>
            {view.status === "running"
              ? `進度：第 ${view.index} / ${view.total} 個格子`
              : view.status === "done"
                ? `完成：共 ${view.total} 個格子，綠色 ${view.quietResults.filter((o) => o.result.verdict === true).length} 個`
                : view.status === "queued" ? "排隊中" : `結束：${view.error ?? view.status}`}
          </p>
          <pre ref={log} className="log">
            {view.stderr.join("\n")}
          </pre>
        </>
      )}
    </div>
  );
}
