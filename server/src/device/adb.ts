import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DeviceLostError } from "./device.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_ADB_PATH =
  "C:\\Users\\darkl\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe";

/** 執行一次 adb；回傳 stdout。預設是 execFile，測試可換掉。 */
export type AdbExec = (file: string, args: string[], timeoutMs: number) => Promise<string>;

const defaultExec: AdbExec = async (file, args, timeoutMs) =>
  (await execFileAsync(file, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 })).stdout;

export interface AdbOptions {
  adbPath?: string;
  /** 只連一台手機時可省略。 */
  serial?: string;
  exec?: AdbExec;
}

/** 環境變數 ADB_PATH、ADB_SERIAL（App 與 CLI 共用）。 */
export function adbOptionsFromEnv(env: Record<string, string | undefined> = process.env): AdbOptions {
  return { adbPath: env.ADB_PATH || undefined, serial: env.ADB_SERIAL || undefined };
}

/** 連了多台裝置又沒指定序號：不是斷線，要使用者指定。 */
export class MultipleDevicesError extends Error {}

/** 對一台手機下 adb 指令的最小包裝。 */
export class Adb {
  private readonly adbPath: string;
  private readonly serial?: string;
  private readonly exec: AdbExec;

  constructor(opts: AdbOptions = {}) {
    this.adbPath = opts.adbPath ?? DEFAULT_ADB_PATH;
    this.serial = opts.serial;
    this.exec = opts.exec ?? defaultExec;
  }

  async shell(command: string, timeoutMs = 15_000): Promise<string> {
    const args = [...(this.serial ? ["-s", this.serial] : []), "shell", command];
    try {
      return await this.exec(this.adbPath, args, timeoutMs);
    } catch (e) {
      const text = `${(e as { stderr?: string }).stderr ?? ""}${(e as Error).message}`;
      if (/more than one device/i.test(text)) {
        throw new MultipleDevicesError("連了多台裝置，不知道要用哪一台：請設定環境變數 ADB_SERIAL 指定裝置序號（adb devices 可查），再重新啟動 App");
      }
      if (/no devices\/emulators found|device offline|device '.*' not found|device unauthorized/i.test(text)) {
        throw new DeviceLostError(`找不到手機：${text.trim().split(/\r?\n/)[0]}`);
      }
      throw e;
    }
  }
}
