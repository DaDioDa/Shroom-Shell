import type { BatchEvent } from "@shell/shared";

interface Channel {
  events: BatchEvent[];
  done: boolean;
  subscribers: Set<(e: BatchEvent) => void>;
}

/** 每個 Batch 一條事件通道：記下全部事件，晚來的 SSE 連線可以從頭重播。 */
export class BatchHub {
  private readonly channels = new Map<number, Channel>();

  private channel(batchId: number): Channel {
    let c = this.channels.get(batchId);
    if (!c) this.channels.set(batchId, (c = { events: [], done: false, subscribers: new Set() }));
    return c;
  }

  emit(batchId: number, e: BatchEvent): void {
    const c = this.channel(batchId);
    c.events.push(e);
    if (e.type === "finished") c.done = true;
    for (const s of c.subscribers) s(e);
  }

  /** 先重播已發生的事件，之後的即時事件也會呼叫 `onEvent`。回傳取消訂閱函式；沒有這個 Batch 的紀錄回 null。 */
  subscribe(batchId: number, onEvent: (e: BatchEvent) => void): (() => void) | null {
    const c = this.channels.get(batchId);
    if (!c) return null;
    for (const e of c.events) onEvent(e);
    if (c.done) return () => {};
    c.subscribers.add(onEvent);
    return () => c.subscribers.delete(onEvent);
  }

  open(batchId: number): void {
    this.channel(batchId);
  }
}
