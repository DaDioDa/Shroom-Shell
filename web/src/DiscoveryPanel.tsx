import { useEffect, useRef, useState } from "react";
import { featureName, planDiscovery, regionSizeKm, type BatchView, type Region } from "@shell/shared";
import { api } from "./api.js";

interface Props {
  region: Region | null;
  drawing: boolean;
  onDraw: () => void;
  view: BatchView;
  onStarted: (batchId: number, listId: number) => void;
}

const fmtDuration = (ms: number) => {
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} 小時 ${min % 60} 分鐘` : `${min} 分鐘`;
};

export function DiscoveryPanel({ region, drawing, onDraw, view, onStarted }: Props) {
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(500);
  const [spacing, setSpacing] = useState(1000);
  const [avg, setAvg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 超過 30 點的確認顯示在面板內。
  const [confirming, setConfirming] = useState(false);
  const log = useRef<HTMLPreElement>(null);
  useEffect(() => void api.quietStats().then((s) => setAvg(s.avgMsPerPoint)).catch(() => {}), [view.status]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [view.stderr.length]);

  const plan = region ? planDiscovery({ region, spacingM: spacing, avgMsPerPoint: avg }) : null;
  const size = region ? regionSizeKm(region) : null;
  const running = view.status === "running";
  const canStart = !!plan?.ok && name.trim() !== "" && radius > 0;

  const start = async () => {
    if (!region || !plan?.ok) return;
    if (plan.needsConfirm && !confirming) return setConfirming(true);
    setConfirming(false);
    setError(null);
    try {
      const r = await api.startDiscovery({ name: name.trim(), region, radius, spacing, confirmed: plan.needsConfirm });
      onStarted(r.batchId, r.listId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <h4>{featureName("discovery")}</h4>
      <p className="muted">在地圖上框一個 Region（最大 10 km × 10 km），依間距鋪成格子，每格跑一次 Quiet Giant Search。</p>
      <button onClick={onDraw} disabled={drawing || running}>
        {drawing ? "在地圖上拖曳畫出矩形…" : region ? "重畫 Region" : "畫 Region"}
      </button>
      {size && (
        <p>
          Region：{size.widthKm.toFixed(1)} km × {size.heightKm.toFixed(1)} km
        </p>
      )}
      <div>
        <label>
          Region 名稱 <input value={name} placeholder="例如：大安區" onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          半徑（公尺）
          <input type="number" min={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>{" "}
        <label>
          間距（公尺）
          <input type="number" min={1} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} />
        </label>
      </div>
      {plan && !plan.ok && <p className="errors">{plan.reason}</p>}
      {plan?.ok && (
        <p>
          共 {plan.points.length} 點，預估 {fmtDuration(plan.estimateMs)}
          （{plan.estimateSource === "history" ? "依過去 quiet 的平均耗時" : "每點以 3 分鐘估"}）
          {plan.needsConfirm && "。超過 30 點，開始前會再確認一次"}
        </p>
      )}
      {confirming && plan?.ok ? (
        <p className="errors">
          這會跑 {plan.points.length} 個點，預估 {fmtDuration(plan.estimateMs)}。確定要開始？ <button onClick={start}>確定開始</button> <button onClick={() => setConfirming(false)}>取消</button>
        </p>
      ) : (
        <button disabled={!canStart || running} onClick={start}>
          開始
        </button>
      )}
      {error && <p className="errors">{error}</p>}
      <p className="muted">結果：綠＝是（會自動加進「Discovery：{name.trim() || "名稱"}」清單）、紅＝不是、灰＝無法判斷。</p>
      {view.status !== "idle" && (
        <>
          <p>
            {running
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
