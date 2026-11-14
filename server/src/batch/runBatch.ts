import { readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { BatchPoint } from "@shell/shared";
import type { BotRunResult, BotRunner } from "../bot/runner.js";
import type { Device } from "../device/device.js";
import type { Db } from "../db/database.js";
import type { BatchHub } from "./hub.js";
import type { BatchControl } from "./queue.js";
import { finishBatch, saveWaypointRun, setBatchStatus } from "./store.js";

export interface BatchDeps {
  db: Db;
  bot: BotRunner;
  device: Device;
  hub: BatchHub;
  /** Teleport 後等多久才呼叫 bot。 */
  waitMs: number;
  runsDir: string;
  /** Batch 的狀態寫成結束之後、通知前端之前呼叫（例如檢查 run 資料夾上限）。失敗不影響 Batch。 */
  onFinished?: (batchId: number) => void;
}

/**
 * 功能（Target Search、Quiet Giant Search、Postcard Check……）只負責兩件事：
 * 這個 Waypoint 要跑什麼指令、bot 結束後怎麼解讀結果。
 * 佇列、取消、單點失敗、恢復 GPS 這些控制流程都在 runBatch。
 */
export interface BatchFeature {
  plan(point: BatchPoint): { command: string; args: string[] };
  /** 這些 exit code 是 feature 自己看得懂的正常答案（預設只有 0）。其他 exit code 算這個 Waypoint 失敗。 */
  okExitCodes?: number[];
  /** 解析並存下結果（也可以 emit 事件）。回傳要存的 result 與這個 Waypoint 的錯誤（沒有就 null）。 */
  interpret(ctx: {
    deps: BatchDeps;
    batchId: number;
    point: BatchPoint;
    index: number;
    result: BotRunResult;
    /** bot 這次印的 stderr 每一行。 */
    stderr: string[];
    runName: string | null;
    /** run 資料夾裡的 abort.png 網址（沒有就是 null）。 */
    abortShotUrl: string | null;
  }): {
    result: unknown;
    /** 這個 Waypoint 的錯誤（存進紀錄）。 */
    error: string | null;
    /** false = 錯誤只記在紀錄，不發 waypoint-failed（feature 自己用別的事件呈現）。預設 true。 */
    report?: boolean;
  };
}

/** run 資料夾裡有 abort.png 才給網址。所有功能共用，Quiet／Postcard／歷史頁都靠它。 */
export function abortShotUrl(runsDir: string, runName: string | null): string | null {
  return runName && existsSync(join(runsDir, runName, "abort.png")) ? `/api/runs/${runName}/abort.png` : null;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/** 從 bot 的 stderr（與 abort.txt）找出給人看的失敗原因。 */
export function failureReason(stderr: string[], runDir: string | null): string {
  for (const line of stderr) {
    const m = line.match(/^(?:中止|原因)：(.+)$/) ?? line.match(/^\s+原因：(.+)$/);
    if (m) return m[1]!.trim();
  }
  const argparse = stderr.find((l) => /error: /.test(l));
  if (argparse) return argparse.replace(/^.*?error: /, "").trim();
  if (runDir) {
    try {
      const first = readFileSync(join(runDir, "abort.txt"), "utf8").split(/\r?\n/)[0]?.trim();
      if (first) return first;
    } catch {
      // 沒有 abort.txt 就往下
    }
  }
  return stderr.filter((l) => l.trim()).at(-1)?.trim() ?? "bot 以 exit 2 結束，沒有說明原因";
}

const FORCE_NOTE = "強制停止：遊戲可能還開著、手機螢幕可能沒鎖";

/** 依點的順序逐點：Teleport → 等待 → bot → 解析存檔。結束（不論怎麼結束）一律 stop。 */
export async function runBatch(
  deps: BatchDeps,
  batchId: number,
  feature: BatchFeature,
  points: BatchPoint[],
  control: BatchControl,
): Promise<void> {
  const total = points.length;
  setBatchStatus(deps.db, batchId, "running");
  deps.hub.emit(batchId, { type: "started", batchId, total });
  let error: string | null = null;
  try {
    // 開跑前：別的模擬定位 App 會搶走位置，有的話不開始。
    const others = await deps.device.otherActiveMockApps();
    if (others.length > 0) {
      error = `偵測到其他模擬定位 App 正在運作：${others.join("、")}。請先關掉它再開始。`;
    }
    for (const [i, w] of points.entries()) {
      if (error || control.stopRequested) break;
      const index = i + 1;
      const startedAt = Date.now();
      deps.hub.emit(batchId, { type: "progress", index, total, waypointId: w.waypointId ?? null, label: w.label });
      await deps.device.teleport({ lat: w.lat, lng: w.lng });
      await sleep(deps.waitMs, control.signal);
      if (control.signal.aborted) break;
      const stderr: string[] = [];
      const plan = feature.plan(w);
      const result = await deps.bot.run({
        command: plan.command,
        args: plan.args,
        runsDir: deps.runsDir,
        signal: control.signal,
        onStderrLine: (line) => {
          stderr.push(line);
          deps.hub.emit(batchId, { type: "stderr", index, line });
        },
      });
      const runName = result.runDir ? basename(result.runDir) : null;
      const shot = abortShotUrl(deps.runsDir, runName);
      let outcome: ReturnType<BatchFeature["interpret"]>;
      if (result.killed) {
        outcome = { result: [], error: FORCE_NOTE };
      } else {
        outcome = feature.interpret({ deps, batchId, point: w, index, result, stderr, runName, abortShotUrl: shot });
        if (!(feature.okExitCodes ?? [0]).includes(result.exitCode) && !outcome.error) outcome.error = failureReason(stderr, result.runDir);
        if (outcome.error && outcome.report !== false) {
          deps.hub.emit(batchId, { type: "waypoint-failed", index, error: outcome.error, ...(shot ? { screenshotUrl: shot } : {}) });
        }
      }
      saveWaypointRun(deps.db, { batchId, point: w, index, exitCode: result.killed ? null : result.exitCode, result: outcome.result, runDir: runName, error: outcome.error, durationMs: Date.now() - startedAt });
    }
  } catch (e) {
    error = errorMessage(e);
  }
  // 不論怎麼結束都恢復真實 GPS。
  try {
    await deps.device.stop();
  } catch (e) {
    error ??= "恢復真實 GPS 失敗：" + errorMessage(e);
  }
  const cancelled = !error && control.stopRequested;
  const status = error ? "failed" : cancelled ? "cancelled" : "done";
  const note = error ?? (cancelled && control.mode === "force" ? FORCE_NOTE : null);
  finishBatch(deps.db, batchId, status, note);
  try {
    deps.onFinished?.(batchId);
  } catch (e) {
    console.error("Batch 結束後的收尾失敗：", errorMessage(e));
  }
  deps.hub.emit(batchId, note ? { type: "finished", status, error: note } : { type: "finished", status });
}
