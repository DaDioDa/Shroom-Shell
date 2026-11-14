import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEFAULT_ADB_PATH =
  "C:\\Users\\darkl\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";

export interface AdbOptions {
  adbPath?: string;
  /** 只連一台手機時可省略。 */
  serial?: string;
}

/** 對一台手機下 adb 指令的最小包裝。 */
export class Adb {
  private readonly adbPath: string;
  private readonly serial?: string;

  constructor(opts: AdbOptions = {}) {
    this.adbPath = opts.adbPath ?? DEFAULT_ADB_PATH;
    this.serial = opts.serial;
  }

  async shell(command: string, timeoutMs = 15_000): Promise<string> {
    const args = [...(this.serial ? ["-s", this.serial] : []), "shell", command];
    const { stdout } = await execFileAsync(this.adbPath, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  }
}
