import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialBatchView, reduceBatchView, type BatchEvent } from "@shell/shared";

/** 訂閱一個 Batch 的 SSE，把事件累積成畫面要顯示的狀態。 */
export function useBatchView() {
  const [view, dispatch] = useReducer(reduceBatchView, initialBatchView);
  const source = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    source.current?.close();
    source.current = null;
  }, []);
  useEffect(() => close, [close]);

  const follow = useCallback(
    (batchId: number) => {
      close();
      const es = new EventSource(`/api/batches/${batchId}/events`);
      source.current = es;
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as BatchEvent;
        dispatch(e);
        if (e.type === "finished") close();
      };
      // 連線中斷時 EventSource 會自己重連；Batch 已結束的話後端會重播全部事件再關閉。
    },
    [close],
  );

  return { view, follow };
}
