import { Adb } from "./adb.js";
import type { Device } from "./device.js";

const PKG = "io.appium.settings";
const LOCATION_SERVICE = `${PKG}/.LocationService`;
const LAUNCH_ACTIVITY = `${PKG}/.Settings`;
/** 與目標座標相差在這之內就算到位（約 1 公尺）。 */
const MATCH_EPSILON = 1e-5;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TeleportResult {
  /** 從下指令到手機回報新位置花的毫秒數。 */
  settledMs: number;
  /** 是否重啟過 LocationService 才到位。 */
  restarted: boolean;
}

export class TeleportError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 透過 Appium Settings 設定手機的模擬 GPS。
 *
 * 坑：其他模擬定位 App 停掉時會一併移除系統的 test provider，
 * Appium 的 LocationService 若還活著就會一直報 `Provider "gps" unknown`。
 * 所以第一次下指令沒到位時，要重啟 LocationService 讓它重新註冊 provider。
 */
export class Teleporter implements Device {
  constructor(private readonly adb: Adb) {}

  async teleport(to: LatLng, timeoutMs = 10_000): Promise<TeleportResult> {
    validate(to);
    await this.adb.shell(`appops set ${PKG} android:mock_location allow`);

    const started = Date.now();
    await this.startService(to);
    if (await this.waitFor(to, Math.min(timeoutMs, 4_000))) {
      return { settledMs: Date.now() - started, restarted: false };
    }

    await this.adb.shell(`am stopservice -n ${LOCATION_SERVICE}`);
    await sleep(500);
    await this.startService(to);
    if (await this.waitFor(to, timeoutMs)) {
      return { settledMs: Date.now() - started, restarted: true };
    }
    const now = await this.currentGps();
    throw new TeleportError(
      `手機位置沒有變成 ${fmt(to)}（目前 gps：${now ? fmt(now) : "讀不到"}）。` +
        "檢查是否有其他模擬定位 App 正在運作。",
    );
  }

  /** 停止模擬，恢復真實 GPS。 */
  async stop(): Promise<void> {
    await this.adb.shell(`am stopservice -n ${LOCATION_SERVICE}`);
  }

  /** 其他有模擬定位權限、而且有服務在跑的 App（會搶走模擬位置）。 */
  async otherActiveMockApps(): Promise<string[]> {
    const out = await this.adb.shell("appops query-op android:mock_location allow");
    const pkgs = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== PKG);
    const active: string[] = [];
    for (const p of pkgs) {
      const svc = await this.adb.shell(`dumpsys activity services ${p}`);
      if (svc.includes("ServiceRecord{")) active.push(p);
    }
    return active;
  }

  /** dumpsys 裡最近一筆 gps 位置；沒有就回傳 null。 */
  async currentGps(): Promise<(LatLng & { mock: boolean }) | null> {
    const out = await this.adb.shell("dumpsys location");
    const m = out.match(/^\s*gps: Location\[gps (-?[\d.]+),(-?[\d.]+)([^\n]*)/m);
    if (!m) return null;
    return { lat: Number(m[1]), lng: Number(m[2]), mock: /\bmock\b/.test(m[3]) };
  }

  private async startService(to: LatLng): Promise<void> {
    const cmd =
      `am start-foreground-service -n ${LOCATION_SERVICE} ` +
      `--es latitude ${to.lat} --es longitude ${to.lng} --es altitude 10`;
    let out = await this.adb.shell(cmd);
    if (/Error: Not found/.test(out)) {
      // 剛安裝、從沒開過的 App 啟動不了服務；先開一次主畫面再試。
      await this.adb.shell(`am start -n ${LAUNCH_ACTIVITY}`);
      await sleep(1_500);
      out = await this.adb.shell(cmd);
      if (/Error/.test(out)) throw new TeleportError(`啟動 LocationService 失敗：${out.trim()}`);
    }
  }

  private async waitFor(to: LatLng, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const now = await this.currentGps();
      if (
        now &&
        Math.abs(now.lat - to.lat) < MATCH_EPSILON &&
        Math.abs(now.lng - to.lng) < MATCH_EPSILON
      ) {
        return true;
      }
      await sleep(500);
    }
    return false;
  }
}

function validate({ lat, lng }: LatLng): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new TeleportError(`緯度不合法：${lat}`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new TeleportError(`經度不合法：${lng}`);
}

const fmt = ({ lat, lng }: LatLng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
