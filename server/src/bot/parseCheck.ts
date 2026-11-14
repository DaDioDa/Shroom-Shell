import type { CheckResult } from "@shell/shared";

const isStr = (v: unknown) => typeof v === "string";
const isNum = (v: unknown) => typeof v === "number";
const optNum = (v: unknown) => v === undefined || v === null || isNum(v);

function isCheckResult(v: unknown): v is CheckResult {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (!isStr(r.spot_name)) return false;
  if (r.found === true) {
    return isStr(r.name) && isNum(r.lat) && isNum(r.lng) && (r.participant_count === null || isNum(r.participant_count)) &&
      (r.remaining_seconds === null || isNum(r.remaining_seconds)) && isStr(r.observed_at) && isStr(r.frame) && (r.postcard === null || isStr(r.postcard));
  }
  if (r.found === false) return isNum(r.unread);
  if (r.found === null) return isStr(r.reason) && (r.name === undefined || isStr(r.name)) && optNum(r.participant_count);
  return false;
}

/** 解析 `check` 的 stdout：一行 JSON。空白（冷啟動前就失敗）回 null。 */
export function parseCheckStdout(stdout: string): CheckResult | null {
  const last = stdout.split(/\r?\n/).filter((l) => l.trim()).at(-1)?.trim();
  if (!last) return null;
  let data: unknown;
  try {
    data = JSON.parse(last);
  } catch {
    throw new Error(`bot stdout 不是合法 JSON：${last.slice(0, 80)}`);
  }
  if (!isCheckResult(data)) throw new Error("bot stdout 不是 check 的答案");
  return data;
}
