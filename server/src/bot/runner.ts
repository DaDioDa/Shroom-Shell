import { execFile, spawn } from "node:child_process";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 對 pikmin_bloom_bot 下的一次指令。`--runs-dir` 由 runner 負責加。 */
export interface BotRunRequest {
  /** `hunt`、`quiet`、`check`…… */
  command: string;
  args: string[];
  /** run 資料夾的上層目錄（絕對路徑）。 */
  runsDir: string;
  /** bot 每印一行 stderr 就呼叫一次（不含換行）。 */
  onStderrLine?: (line: string) => void;
  /** abort 時立刻 kill bot 的程序（強制停止）。 */
  signal?: AbortSignal;
}

export interface BotRunResult {
  exitCode: number;
  /** 完整 stdout。 */
  stdout: string;
  /** 這次執行建立的 run 資料夾（絕對路徑）；找不到就是 null。 */
  runDir: string | null;
  /** true = 被 signal 強制結束，不是 bot 自己收尾。 */
  killed?: boolean;
}

/** 真 bot 與假 bot 共用的介面。 */
export interface BotRunner {
  run(req: BotRunRequest): Promise<BotRunResult>;
}

export const DEFAULT_BOT_REPO = "C:\\Users\\Ss\\Shroom-Drone";

export interface RealBotOptions {
  /** bot repo 路徑，預設取環境變數 BOT_REPO，再退回 DEFAULT_BOT_REPO。 */
  repoDir?: string;
  /** 測試用：換掉 `.venv` 的 python。 */
  executable?: string;
  /** 測試用：換掉 `-m mushroom_sweep`。 */
  baseArgs?: string[];
}

function listDirs(dir: string): Set<string> {
  try {
    return new Set(readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()));
  } catch {
    return new Set();
  }
}

/** 在 bot repo 根目錄用它的 `.venv` 執行 `python -m mushroom_sweep <指令>`。 */
export class RealBotRunner implements BotRunner {
  private readonly repoDir: string;
  private readonly executable: string;
  private readonly baseArgs: string[];
  constructor(opts: RealBotOptions = {}) {
    this.repoDir = opts.repoDir ?? process.env.BOT_REPO ?? DEFAULT_BOT_REPO;
    this.executable = opts.executable ?? join(this.repoDir, ".venv", "Scripts", "python.exe");
    this.baseArgs = opts.baseArgs ?? ["-m", "mushroom_sweep"];
  }

  run(req: BotRunRequest): Promise<BotRunResult> {
    mkdirSync(req.runsDir, { recursive: true });
    const before = listDirs(req.runsDir);
    const args = [...this.baseArgs, req.command, ...req.args, "--runs-dir", req.runsDir];

    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, args, {
        cwd: this.repoDir,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
      let stdout = "";
      let pending = "";
      child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
      child.stderr.setEncoding("utf8").on("data", (d: string) => {
        pending += d;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const l of lines) req.onStderrLine?.(l);
      });
      let killed = false;
      const kill = () => {
        killed = true;
        killTree(child.pid);
      };
      if (req.signal?.aborted) kill();
      else req.signal?.addEventListener("abort", kill, { once: true });
      child.on("error", reject);
      child.on("close", (code) => {
        req.signal?.removeEventListener("abort", kill);
        if (pending) req.onStderrLine?.(pending);
        const created = [...listDirs(req.runsDir)].filter((n) => !before.has(n)).sort();
        const runDir = created.length ? join(req.runsDir, created[created.length - 1]!) : null;
        resolve({ exitCode: code ?? 2, stdout, runDir, killed });
      });
    });
  }
}

/** 連同子程序一起殺掉（bot 底下還會開 adb 等）。 */
function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }, () => {});
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 已經結束
    }
  }
}
