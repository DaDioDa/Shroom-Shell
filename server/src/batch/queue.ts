import type { CancelMode, QueueItem, QueueSnapshot } from "@shell/shared";

/** runner 在跑的時候用它判斷要不要停、要不要 kill bot。 */
export interface BatchControl {
  /** 強制停止時 abort；bot runner 收到就 kill 程序。 */
  readonly signal: AbortSignal;
  /** 任何一種取消都會變 true；runner 在每個 Waypoint 之間檢查。 */
  readonly stopRequested: boolean;
  /** 取消的方式；沒取消是 null。 */
  readonly mode: CancelMode | null;
}

export interface QueueJob {
  item: QueueItem;
  /** 輪到它時呼叫。不可以 reject；結束（不論怎麼結束）就 resolve。 */
  run(control: BatchControl): Promise<void>;
  /** 還在排隊時被移出佇列。 */
  onRemoved(): void;
}

class Control implements BatchControl {
  private readonly ac = new AbortController();
  mode: CancelMode | null = null;
  get signal() {
    return this.ac.signal;
  }
  get stopRequested() {
    return this.mode !== null;
  }
  cancel(mode: CancelMode) {
    if (this.mode !== "force") this.mode = mode;
    if (mode === "force") this.ac.abort();
  }
}

/** 單一佇列：手機同時只跑一個 Batch，其他 FIFO 排隊。 */
export class BatchQueue {
  private current: { job: QueueJob; control: Control } | null = null;
  private readonly waiting: QueueJob[] = [];

  /** 回傳前面還要等幾個（0＝立刻開始）。 */
  enqueue(job: QueueJob): number {
    this.waiting.push(job);
    const position = this.current ? this.waiting.length : 0;
    this.pump();
    return position;
  }

  cancel(batchId: number, mode: CancelMode): "removed" | "requested" | "unknown" {
    const i = this.waiting.findIndex((j) => j.item.batchId === batchId);
    if (i >= 0) {
      const [job] = this.waiting.splice(i, 1);
      job!.onRemoved();
      return "removed";
    }
    if (this.current?.job.item.batchId === batchId) {
      this.current.control.cancel(mode);
      return "requested";
    }
    return "unknown";
  }

  snapshot(): QueueSnapshot {
    return { running: this.current?.job.item ?? null, queued: this.waiting.map((j) => j.item) };
  }

  private pump(): void {
    if (this.current) return;
    const job = this.waiting.shift();
    if (!job) return;
    const control = new Control();
    this.current = { job, control };
    void job
      .run(control)
      .catch(() => {})
      .finally(() => {
        this.current = null;
        this.pump();
      });
  }
}
