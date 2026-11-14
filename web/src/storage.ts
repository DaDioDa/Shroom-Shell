import { useEffect, useState } from "react";
import { clampSlider, parseSliderValue, type SliderSpec } from "@shell/shared";

/** 讀 localStorage；讀不到（被擋、壞掉）回 null。 */
export function loadStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 寫 localStorage；失敗就算了。 */
export function saveStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無痕視窗或被擋時，只是不保存
  }
}

/** 讀 JSON；讀不到或格式壞掉回 fallback。 */
export function loadJson<T>(key: string, fallback: T): T {
  const raw = loadStored(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  saveStored(key, JSON.stringify(value));
}

/** 值存在 localStorage 的 slider 狀態；讀不到就用預設值。 */
export function useStoredSlider(key: string, spec: SliderSpec): [number, (v: number) => void] {
  const [value, setValue] = useState(() => parseSliderValue(spec, loadStored(key)));
  useEffect(() => saveStored(key, String(value)), [key, value]);
  return [value, (v) => setValue(clampSlider(spec, v))];
}
