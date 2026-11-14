import { useCallback, useEffect, useRef, useState } from "react";
import { batchStatusText, featureName, type BatchView, type QueueItem, type QueueSnapshot } from "@shell/shared";
import { api } from "./api.js";

const label = (i: QueueItem) => `#${i.batchId} ${featureName(i.feature)}｜${i.listName}`;

/** 底部抽屜：目前在跑的 Batch、排隊中的 Batch，以及取消按鈕。 */
export function BatchDrawer({ onFollow, view }: { onFollow: (batchId: number) => void; view: BatchView }) {
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
  const force = (i: QueueItem) => {
    if (!window.confirm("強制停止會立刻結束 bot 的程序。\n遊戲可能還開著、手機螢幕可能沒鎖，之後要自己處理。\n\n確定要強制停止？")) return;
    void run(() => api.cancelBatch(i.batchId, "force"));
  };

  if (!q.running && q.queued.length === 0 && view.status === "idle") return null;
  return (
    <div className="drawer">
      {q.running && (
        <div className="row">
          <strong>執行中</strong>
          <a href="#" onClick={(e) => (e.preventDefault(), onFollow(q.running!.batchId))}>{label(q.running)}</a>
          <button onClick={() => void run(() => api.cancelBatch(q.running!.batchId, "after-waypoint"))}>跑完這點就停</button>
          <button className="danger" onClick={() => force(q.running!)}>強制停止</button>
        </div>
      )}
      {view.status !== "idle" && (
        <>
          <div className="row">{batchStatusText(view)}</div>
          {view.stderr.length > 0 && (
            <pre ref={log} className="log">
              {view.stderr.join("\n")}
            </pre>
          )}
        </>
      )}
      {q.queued.map((i, n) => (
        <div className="row" key={i.batchId}>
          <span className="muted">排隊 {n + 1}</span>
          <a href="#" onClick={(e) => (e.preventDefault(), onFollow(i.batchId))}>{label(i)}</a>
          <button onClick={() => void run(() => api.cancelBatch(i.batchId, "after-waypoint"))}>移出佇列</button>
        </div>
      ))}
      {error && <span className="errors">{error}</span>}
    </div>
  );
}
