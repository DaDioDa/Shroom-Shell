import type { BotSighting } from "@shell/shared";

export function isSighting(v: unknown): v is BotSighting {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.target === "string" &&
    typeof s.lat === "number" &&
    typeof s.lng === "number" &&
    typeof s.spot_name === "string" &&
    typeof s.observed_at === "string" &&
    (s.participant_count === null || typeof s.participant_count === "number") &&
    (s.remaining_seconds === null || typeof s.remaining_seconds === "number")
  );
}

/**
 * 解析 `hunt` 的 stdout。
 * - Sighting 陣列：正常結果（`[]` 表示沒找到）
 * - 空白：冷啟動就中止，回 null
 */
export function parseHuntStdout(stdout: string): BotSighting[] | null {
  const text = stdout.trim();
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`bot stdout 不是合法 JSON：${text.slice(0, 80)}`);
  }
  if (!Array.isArray(data)) throw new Error("bot stdout 不是 Sighting 陣列");
  if (!data.every(isSighting)) throw new Error("bot stdout 有格式不對的 Sighting");
  return data;
}
