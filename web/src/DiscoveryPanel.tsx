import { useEffect, useState, type MutableRefObject } from "react";
import { defaultRegion, featureName, gridStats, planDiscovery, regionSizeKm, SLIDER_SPECS, type BatchView, type DiscoveryParams } from "@shell/shared";
import { api } from "./api.js";
import { Slider } from "./Slider.js";
import type { DiscoveryEditor } from "./useDiscoveryEditor.js";
import { countVerdicts, Field, icons, Section, Seg, Tally } from "./ui.js";

interface Props {
  editor: DiscoveryEditor;
  /** 地圖目前的中央（放 Region 用）。 */
  centerRef: MutableRefObject<(() => { lat: number; lng: number }) | null>;
  /** 上一次（或正在跑的）Discovery 的 Region 與參數；沒有就是 null。 */
  result: DiscoveryParams | null;
  /** 地圖現在顯示結果（不是編輯器）。 */
  showingResult: boolean;
  view: BatchView;
  onStarted: (batchId: number) => void;
}

const fmtDuration = (ms: number) => {
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} 小時 ${min % 60} 分鐘` : `${min} 分鐘`;
};
const FALLBACK_CENTER = { lat: 25.033964, lng: 121.564468 };

/** 探索區域：有上次結果時最上面可切「編輯 Region／上次結果」；編輯時設定 Region 與開始，結果時看摘要與統計。 */
export function DiscoveryPanel({ editor, centerRef, result, showingResult, view, onStarted }: Props) {
  const busy = view.status === "running" || view.status === "queued";
  return (
    <>
      {result && (
        <section className="sec">
          <Seg
            items={[
              { value: "edit", label: "編輯 Region" },
              { value: "result", label: busy ? "執行中" : "上次結果" },
            ]}
            value={showingResult ? "result" : "edit"}
            disabled={busy}
            onChange={(v) => (v === "edit" ? (editor.region ? editor.setEditing(true) : editor.setRegion(defaultRegion(centerRef.current?.() ?? FALLBACK_CENTER, editor.spacing))) : editor.setEditing(false))}
          />
        </section>
      )}
      {result && showingResult ? <DiscoveryResult result={result} view={view} busy={busy} /> : <DiscoveryEdit editor={editor} centerRef={centerRef} view={view} busy={busy} onStarted={onStarted} />}
    </>
  );
}

function DiscoveryResult({ result, view, busy }: { result: DiscoveryParams; view: BatchView; busy: boolean }) {
  const stats = gridStats(result.region, result.spacing, result.radius);
  const size = regionSizeKm(result.region);
  return (
    <Section title={result.name}>
      <p className="muted">
        {stats.cols} × {stats.rows} 格＝{stats.points.length} 點｜半徑 {result.radius} m｜{size.widthKm.toFixed(1)} km × {size.heightKm.toFixed(1)} km
      </p>
      <Tally counts={countVerdicts(view.quietResults.map((o) => o.result.verdict))} />
      <p className="muted">{busy ? "執行中，Region 已鎖住；要改請先停止 Batch。" : "點地圖上的格子看原因；綠格可以加入無人巨菇清單。"}</p>
    </Section>
  );
}

function DiscoveryEdit({ editor, centerRef, view, busy, onStarted }: { editor: DiscoveryEditor; centerRef: Props["centerRef"]; view: BatchView; busy: boolean; onStarted: (batchId: number) => void }) {
  const { region, radius, spacing, linked, manualSpacing } = editor;
  const [name, setName] = useState("");
  const [avg, setAvg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => void api.quietStats().then((s) => setAvg(s.avgMsPerPoint)).catch(() => {}), [view.status]);
  // Region 或間距一變，之前問的「確定開始？」就不算數。
  useEffect(() => setConfirming(false), [region, spacing, radius]);

  const plan = region ? planDiscovery({ region, spacingM: spacing, avgMsPerPoint: avg }) : null;
  const stats = region ? gridStats(region, spacing, radius) : null;
  const size = region ? regionSizeKm(region) : null;
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
    <Section title={featureName("discovery")}>
      <p className="muted">放一個 Region（最大 10 km × 10 km），每格跑一次無人巨菇。</p>
      <div className="line">
        <button className="btn" onClick={place} disabled={busy}>
          {region ? icons.map : icons.plus}
          {region ? "移到地圖中央" : "放一個 Region"}
        </button>
      </div>
      <Slider label="半徑" spec={SLIDER_SPECS.radius} unit="m" value={radius} disabled={busy} onChange={editor.setRadius} />
      <label className="check">
        <input type="checkbox" checked={linked} disabled={busy} onChange={(e) => editor.setLinked(e.target.checked)} />
        間距跟半徑連動（間距 ＝ 2 × 半徑，剛好無縫）
      </label>
      <Slider
        label="間距"
        spec={SLIDER_SPECS.spacing}
        unit="m"
        value={linked ? spacing : manualSpacing}
        disabled={busy || linked}
        valueText={linked ? () => `連動中 ${spacing} m${spacing > SLIDER_SPECS.spacing.max ? "（超過手動上限也沒關係）" : ""}` : undefined}
        onChange={editor.setManualSpacing}
      />
      <Field label="Region 名稱">
        <input className="input" value={name} placeholder="留空會自動命名（探索 日期 時間）" onChange={(e) => setName(e.target.value)} />
      </Field>
      {stats && size && (
        <div className={`stats ${plan && !plan.ok ? "bad" : ""}`}>
          <span className="big num">
            {stats.cols} × {stats.rows} 格 = {stats.points.length} 點
          </span>
          <span>
            Region：{size.widthKm.toFixed(1)} km × {size.heightKm.toFixed(1)} km，格子 {Math.round(stats.cellW)} × {Math.round(stats.cellH)} m
          </span>
          {plan?.ok && (
            <span>
              預估 {fmtDuration(plan.estimateMs)}（{plan.estimateSource === "history" ? "依過去 quiet 的平均耗時" : "每點以 3 分鐘估"}）
              {plan.needsConfirm && "；超過 30 點，開始前會再確認一次"}
            </span>
          )}
          {plan && !plan.ok && <span className="err">{plan.reason}</span>}
          <span className="muted">{stats.coverageText}</span>
        </div>
      )}
      {confirming && plan?.ok ? (
        <div className="warn ask">
          這會跑 {plan.points.length} 個點，預估 {fmtDuration(plan.estimateMs)}。確定要開始？
          <span className="line">
            <button className="btn small primary" onClick={start}>
              確定開始
            </button>
            <button className="btn small" onClick={() => setConfirming(false)}>
              取消
            </button>
          </span>
        </div>
      ) : (
        <button className="btn primary block" disabled={!canStart} onClick={() => (plan?.ok && plan.needsConfirm ? setConfirming(true) : void start())}>
          {icons.play}開始
        </button>
      )}
      {busy && <p className="muted">執行中，Region 已鎖住；要改請先停止 Batch。</p>}
      {error && <p className="err">{error}</p>}
    </Section>
  );
}
