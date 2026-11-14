import type { QuietResult } from "@shell/shared";
import { isSighting } from "./parseHunt.js";

const nullableBool = (v: unknown) => v === null || typeof v === "boolean";

function isQuietResult(v: unknown): v is QuietResult {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  const claimed = r.claimed as Record<string, unknown> | null;
  return (
    nullableBool(r.verdict) &&
    nullableBool(r.quiet_area) &&
    typeof r.reason === "string" &&
    Array.isArray(r.giants) &&
    r.giants.every(isSighting) &&
    typeof r.unread === "number" &&
    (claimed === null ||
      (typeof claimed === "object" &&
        typeof claimed.cell === "number" &&
        (claimed.participant_count === null || typeof claimed.participant_count === "number")))
  );
}

/**
 * 解析 `quiet` 的 stdout：前面可能先有（多行縮排的）Sighting 陣列，
 * **最後一行**才是單行 JSON 的答案。空白 stdout 回 null（冷啟動前就中止）。
 */
export function parseQuietStdout(stdout: string): QuietResult | null {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim());
  const last = lines.at(-1)?.trim();
  if (!last) return null;
  let data: unknown;
  try {
    data = JSON.parse(last);
  } catch {
    throw new Error(`bot stdout 最後一行不是合法 JSON：${last.slice(0, 80)}`);
  }
  if (!isQuietResult(data)) throw new Error("bot stdout 最後一行不是 quiet 的答案");
  return data;
}
