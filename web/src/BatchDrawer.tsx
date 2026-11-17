import { useCallback, useEffect, useRef, useState } from "react";
import { batchStatusText, featureName, type BatchView, type QueueItem, type QueueSnapshot } from "@shell/shared";
import { api } from "./api.js";
import { icons, Progress } from "./ui.js";

const label = (i: QueueItem) => `#${i.batchId} ${featureName(i.feature)}｜${i.listName}`;

/** 抽屜裡顯示的那個 Batch 的狀態文字；探索區域的單位是格子。 */
function statusText(view: BatchView, feature: string | null): string {
  if (feature !== "discovery") return batchStatusText(view, feature === "target-search" ? view.sightings.length : undefined);
  if (view.status === "running") return `進度：第 ${view.index} / ${view.total} 個格子`;
  if (view.status === "done") return `完成：共 ${view.total} 個格子，綠色 ${view.quietResults.filter((o) => o.result.verdict === true).length} 個`;
  return batchStatusText(view);
}

/**
 * 浮在地圖底部的抽屜：執行中的 Batch（進度條、跑完這點就停、強制停止）、排隊中的 Batch。
 * 沒有在跑時顯示目前分頁 Batch 的結束狀態。執行紀錄只在這裡顯示。
 */
export function BatchDrawer({ onFollow, view, feature }: { onFollow: (feature: string, batchId: number) => void; view: BatchView; feature: string | null }) {
  const [q, setQ] = useState<QueueSnapshot>({ running: null, queued: [] });
  const log = useRef<HTMLPreElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [view.stderr.length]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setQ(await api.queue());
    } catch {
      // 伺服器暫時連不上就保留上一次的畫面
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  };
  // 強制停止的警告與確認顯示在抽屜內。
  const [forcing, setForcing] = useState<QueueItem | null>(null);
  const force = (i: QueueItem) => {
    setForcing(null);
    void run(() => api.cancelBatch(i.batchId, "force"));
  };

  if (!q.running && q.queued.length === 0 && view.status === "idle") return null;
  const showsRunning = !!q.running && view.status === "running" && view.batchId === q.running.batchId;
  const unit = feature === "discovery" ? "格子" : "Waypoint";
  return (
    <div className="map-drawer">
      <div className="drawer">
        {q.running && (
          <div className="line">
            <span className="badge running">執行中</span>
            <a className="title grow" href="#" onClick={(e) => (e.preventDefault(), onFollow(q.running!.feature, q.running!.batchId))}>
              {label(q.running)}
            </a>
            <button className="btn small" onClick={() => void run(() => api.cancelBatch(q.running!.batchId, "after-waypoint"))}>
              {icons.pause}跑完這點就停
            </button>
            <button className="btn small danger" onClick={() => setForcing(q.running!)}>
              {icons.stop}強制停止
            </button>
          </div>
        )}
        {forcing && (
          <div className="warn">
            強制停止會立刻結束 bot 的程序。遊戲可能還開著、手機螢幕可能沒鎖，之後要自己處理。
            <span className="line">
              <button className="btn small danger solid" onClick={() => force(forcing)}>
                確定強制停止
              </button>
              <button className="btn small" onClick={() => setForcing(null)}>
                取消
              </button>
            </span>
          </div>
        )}
        {showsRunning ? (
          <div className="line">
            <span className="grow">
              <Progress value={view.index} total={view.total} />
            </span>
            <span className="muted num">
              第 {view.index} / {view.total} 個 {unit}
              {view.label && `（${view.label}）`}
            </span>
          </div>
        ) : (
          view.status !== "idle" && <p className={view.status === "failed" ? "err" : ""}>{statusText(view, feature)}</p>
        )}
        {view.status !== "idle" && view.stderr.length > 0 && (
          <pre ref={log} className="log">
            {view.stderr.join("\n")}
          </pre>
        )}
        {q.queued.map((i, n) => (
          <div className="queue" key={i.batchId}>
            <span className="badge queued">排隊 {n + 1}</span>
            <a className="title grow" href="#" onClick={(e) => (e.preventDefault(), onFollow(i.feature, i.batchId))}>
              {label(i)}
            </a>
            <button className="btn small" onClick={() => void run(() => api.cancelBatch(i.batchId, "after-waypoint"))}>
              移出佇列
            </button>
          </div>
        ))}
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
