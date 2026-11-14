import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DeviceLostError } from "./device.js";

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
    try {
      const { stdout } = await execFileAsync(this.adbPath, args, {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      return stdout;
    } catch (e) {
      const text = `${(e as { stderr?: string }).stderr ?? ""}${(e as Error).message}`;
      if (/no devices\/emulators found|device offline|device '.*' not found|device unauthorized|more than one device/i.test(text)) {
        throw new DeviceLostError(`找不到手機：${text.trim().split(/\r?\n/)[0]}`);
      }
      throw e;
    }
  }
}
