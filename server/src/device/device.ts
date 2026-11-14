import type { LatLng } from "./teleporter.js";

/** Batch 對手機的需求。真實作是 Teleporter，測試與沒接手機時用假的。 */
export interface Device {
  /** 把模擬 GPS 設到這裡，到位才 resolve。 */
  teleport(to: LatLng): Promise<unknown>;
  /** 停止模擬，恢復真實 GPS。 */
  stop(): Promise<void>;
}
