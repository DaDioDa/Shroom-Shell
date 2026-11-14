export interface SliderSpec {
  min: number;
  max: number;
  step: number;
  default: number;
}

/** 各 slider 的規格，集中在這裡。 */
export const SLIDER_SPECS = {
  radius: { min: 100, max: 2000, step: 50, default: 500 },
  spacing: { min: 200, max: 3000, step: 100, default: 1000 },
  skipCrowded: { min: 0, max: 10, step: 1, default: 0 },
} as const satisfies Record<string, SliderSpec>;

/** 夾進範圍並對齊步距；不是有限數字就回預設值。 */
export function clampSlider(spec: SliderSpec, value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return spec.default;
  const clamped = Math.min(spec.max, Math.max(spec.min, n));
  const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, snapped));
}

/** 從儲存的字串還原 slider 值；讀不到或格式壞掉就用預設值。 */
export function parseSliderValue(spec: SliderSpec, raw: string | null): number {
  return clampSlider(spec, raw);
}
