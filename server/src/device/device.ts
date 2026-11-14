import type { LatLng } from "./teleporter.js";

/** 找不到手機（adb 斷線、裝置離線）。Batch 遇到就整個停下。 */
export class DeviceLostError extends Error {}

/** Batch 對手機的需求。真實作是 Teleporter，測試與沒接手機時用假的。 */
export interface Device {
  /** 把模擬 GPS 設到這裡，到位才 resolve。 */
  teleport(to: LatLng): Promise<unknown>;
  /** 停止模擬，恢復真實 GPS。 */
  stop(): Promise<void>;
  /** 其他正在運作的模擬定位 App（套件名稱）；有的話 Batch 不開始。 */
  otherActiveMockApps(): Promise<string[]>;
}
