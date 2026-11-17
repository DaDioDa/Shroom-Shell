import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BotSighting } from "@shell/shared";
import type { Device } from "../device/device.js";
import type { LatLng } from "../device/teleporter.js";
import { localIso } from "./parseHunt.js";
import type { BotRunRequest, BotRunResult, BotRunner } from "./runner.js";

/** 1×1 的 PNG，當假截圖用。 */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 假 bot 對一次呼叫的回放內容，依 cli.md 的格式。 */
export interface FakeReply {
  exitCode: number;
  stdout: string;
  stderr?: string[];
  /** 寫進這次的 run 資料夾的檔案（檔名 → 內容）。 */
  files?: Record<string, Buffer | string>;
  /** true = 模擬「連 run 資料夾都沒建」。 */
  noRunDir?: boolean;
  /** true = 模擬長時間執行的 bot：卡住直到被 kill（signal abort）。 */
  hang?: boolean;
}

export type FakeScript = (req: BotRunRequest, callIndex: number) => FakeReply | Promise<FakeReply>;

/** 依 cli.md 回放 stdout、stderr、exit code 的假 bot，並記下每次呼叫。 */
export class FakeBotRunner implements BotRunner {
  readonly calls: BotRunRequest[] = [];
  /** 被強制 kill 的呼叫編號（從 1 起算）。 */
  readonly killed: number[] = [];
  constructor(private readonly script: FakeScript) {}

  async run(req: BotRunRequest): Promise<BotRunResult> {
    const index = this.calls.length;
    this.calls.push({ command: req.command, args: [...req.args], runsDir: req.runsDir });
    const reply = await this.script(req, index);
    if (reply.hang) {
      await new Promise<void>((resolve) => {
        if (req.signal?.aborted) return resolve();
        req.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      this.killed.push(index + 1);
      return { exitCode: 1, stdout: "", runDir: null, killed: true };
    }
    let runDir: string | null = null;
    if (!reply.noRunDir) {
      runDir = join(req.runsDir, `fake-run-${String(index + 1).padStart(3, "0")}`);
      mkdirSync(runDir, { recursive: true });
      for (const [name, content] of Object.entries(reply.files ?? {})) writeFileSync(join(runDir, name), content);
    }
    for (const line of reply.stderr ?? []) req.onStderrLine?.(line);
    return { exitCode: reply.exitCode, stdout: reply.stdout, runDir };
  }
}

/** 記下每次 Teleport 與 stop 的假手機。 */
export class FakeDevice implements Device {
  readonly log: string[] = [];
  current: LatLng | null = null;
  /** 設了就讓 teleport 丟這個錯。 */
  failWith: Error | null = null;
  /** otherActiveMockApps 要回報的套件。 */
  otherMockApps: string[] = [];

  async teleport(to: LatLng): Promise<void> {
    this.log.push(`teleport ${to.lat},${to.lng}`);
    if (this.failWith) throw this.failWith;
    this.current = to;
  }
  async otherActiveMockApps(): Promise<string[]> {
    return this.otherMockApps;
  }
  async stop(): Promise<void> {
    this.log.push("stop");
    this.current = null;
  }
}

/** 依 cli.md 的 stderr 格式描述一筆 Sighting。 */
export function sightingStderr(s: BotSighting, postcardPath: string | null): string[] {
  const count = s.participant_count === null ? "不明" : String(s.participant_count);
  // 「到期」是看到的時間加剩餘時間，以 bot 所在機器（本機）的時間印。
  const time = s.remaining_seconds === null ? "尚未開始倒數" : `到期 ${localIso(new Date(Date.parse(s.observed_at) + s.remaining_seconds * 1000)).slice(0, 16).replace("T", " ")}`;
  return [
    `【找到 Target】${s.target}｜${s.spot_name}`,
    `  參與人數 ${count}｜${time}`,
    `  地圖 https://maps.google.com/?q=${s.lat},${s.lng}`,
    `  Postcard ${postcardPath ?? "（沒有）"}`,
  ];
}

/**
 * 沒接手機時開發用：假 Device 記住最後 Teleport 的位置，
 * 假 bot 在那個位置回報一筆 Sighting（target 取自 `--target`）。
 * Target 叫「錯字」時模擬 argparse 錯誤（exit 2）。
 */
export function createDevFakes(): { bot: FakeBotRunner; device: FakeDevice } {
  const device = new FakeDevice();
  const bot = new FakeBotRunner((req) => {
    const targets = req.args.flatMap((a, i) => (req.args[i - 1] === "--target" ? [a] : []));
    if (targets.includes("錯字")) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: ["usage: mushroom_sweep hunt [-h] ...", "mushroom_sweep hunt: error: 找不到 Target「錯字」"],
        noRunDir: true,
      };
    }
    const at = device.current ?? { lat: 25.033964, lng: 121.564468 };
    const sighting: BotSighting = {
      target: targets[0] ?? "巨大 *",
      lat: at.lat,
      lng: at.lng,
      spot_name: "假的地點",
      participant_count: 0,
      remaining_seconds: null,
      observed_at: new Date().toISOString(),
      map_position: [672, 814],
      frame: "sighting-01.png",
      postcard: "postcard-01.png",
    };
    return {
      exitCode: 0,
      stdout: JSON.stringify([sighting], null, 2),
      stderr: [...sightingStderr(sighting, "postcard-01.png"), "可點徽章 12 顆（重複略過 3），Sighting 1 筆", "【結束】找到 1 顆，花了 0 分 1 秒"],
      files: { "sighting-01.png": TINY_PNG, "postcard-01.png": TINY_PNG },
    };
  });
  return { bot, device };
}
