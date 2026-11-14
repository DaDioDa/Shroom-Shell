import { checkWaypointFields } from "./parseWaypoints.js";
import type { ListFeature } from "./types.js";

export interface WaypointFormInput {
  label: string;
  radiusText: string;
  spotName: string;
}
export type WaypointFormResult =
  | { ok: true; patch: { label: string; radius?: number | null; spotName?: string | null } }
  | { ok: false; errors: { radius?: string; spotName?: string } };

/** 編輯表單一次儲存的驗證：欄位依功能決定，錯誤回報在對應欄位。 */
export function validateWaypointForm(feature: ListFeature, f: WaypointFormInput): WaypointFormResult {
  const label = f.label.trim();
  if (feature === "postcard-check") {
    const spotName = f.spotName.trim();
    const c = checkWaypointFields(feature, { radius: null, spotName });
    return c.ok ? { ok: true, patch: { label, spotName } } : { ok: false, errors: { spotName: c.reason } };
  }
  const text = f.radiusText.trim();
  const radius = text === "" ? null : Number(text);
  if (radius !== null && !(radius > 0)) return { ok: false, errors: { radius: "半徑要是正數" } };
  return { ok: true, patch: { label, radius } };
}

/** 第一次按之後，這段時間內再按一次才算確認。 */
export const CONFIRM_WINDOW_MS = 4000;
export interface Armed {
  key: string;
  at: number;
}
/** 二次確認：回傳新的待確認狀態與這次按是否已確認。 */
export function pressConfirm(armed: Armed | null, key: string, now: number): { armed: Armed | null; confirmed: boolean } {
  if (armed && armed.key === key && now - armed.at <= CONFIRM_WINDOW_MS) return { armed: null, confirmed: true };
  return { armed: { key, at: now }, confirmed: false };
}
