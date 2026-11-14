import { useCallback, useEffect, useState } from "react";
import type { QueueItem, QueueSnapshot } from "@shell/shared";
import { api } from "./api.js";

const FEATURE_NAME: Record<string, string> = { "target-search": "Target Search", "quiet-search": "Quiet Giant Search" };
const label = (i: QueueItem) => `#${i.batchId} ${FEATURE_NAME[i.feature] ?? i.feature}｜${i.listName}`;

/** 底部抽屜：目前在跑的 Batch、排隊中的 Batch，以及取消按鈕。 */
export function BatchDrawer({ onFollow }: { onFollow: (batchId: number) => void }) {
  const [q, setQ] = useState<QueueSnapshot>({ running: null, queued: [] });
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

  if (!q.running && q.queued.length === 0) return null;
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
