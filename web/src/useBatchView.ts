import { useCallback, useEffect, useReducer, useRef } from "react";
import { initialBatchView, reduceBatchView, type BatchEvent, type BatchView } from "@shell/shared";
import { api } from "./api.js";

/** 有自己 BatchView 的功能。 */
export const BATCH_FEATURES = ["quiet-search", "discovery", "postcard-check", "target-search"] as const;
export type BatchFeature = (typeof BATCH_FEATURES)[number];
type Views = Record<BatchFeature, BatchView>;

const initialViews = (): Views => ({ "quiet-search": initialBatchView, discovery: initialBatchView, "postcard-check": initialBatchView, "target-search": initialBatchView });
type Action = { feature: BatchFeature; event: BatchEvent };
const reducer = (v: Views, a: Action): Views => ({ ...v, [a.feature]: reduceBatchView(v[a.feature], a.event) });

/** 每個功能各自跟隨一個 Batch（各一條 SSE、各一個 BatchView）；載入時接回各功能最近一次的 Batch。 */
export function useBatchViews() {
  const [views, dispatch] = useReducer(reducer, undefined, initialViews);
  const sources = useRef<Partial<Record<BatchFeature, EventSource>>>({});

  const close = useCallback((f: BatchFeature) => {
    sources.current[f]?.close();
    delete sources.current[f];
  }, []);
  useEffect(() => () => BATCH_FEATURES.forEach(close), [close]);

  const follow = useCallback(
    (feature: BatchFeature, batchId: number) => {
      close(feature);
      const es = new EventSource(`/api/batches/${batchId}/events`);
      sources.current[feature] = es;
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as BatchEvent;
        dispatch({ feature, event: e });
        if (e.type === "finished") close(feature);
      };
      // 連線中斷時 EventSource 會自己重連；Batch 已結束的話後端會重播全部事件再關閉。
    },
    [close],
  );

  // 載入頁面：各功能接回最近一次的 Batch（還在跑就繼續收事件，已結束就重播出結果）。
  useEffect(() => {
    for (const f of BATCH_FEATURES) {
      void api.history(f).then((rows) => rows[0] && follow(f, rows[0].id)).catch(() => {});
    }
  }, [follow]);

  return { views, follow };
}
