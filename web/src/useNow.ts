import { useEffect, useState } from "react";

/** 每隔一段時間更新的「現在」（epoch 毫秒），讓到期與「N 分鐘前看到」跟著時間變。 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
