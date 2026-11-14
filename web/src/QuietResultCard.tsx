import { sweepAreaColor, type QuietOutcome, type StoredSighting } from "@shell/shared";
import { SightingCard } from "./SightingCard.js";

const LABEL = { green: "是", red: "不是", gray: "無法判斷" } as const;

/** 一個 Waypoint 的 `quiet` 結果：答案、reason、claimed、unread，giants 用 Target Search 的 Sighting 卡片。 */
export function QuietResultCard({ outcome, name, giants }: { outcome: QuietOutcome; name: string; giants: StoredSighting[] }) {
  const { result, radius, index } = outcome;
  const color = sweepAreaColor(result.verdict);
  return (
    <div className={`card quiet ${color}`}>
      <strong>
        第 {index} 個｜{name}
      </strong>
      ：{LABEL[color]}（半徑 {radius} m）
      <div>{result.reason}</div>
      {result.claimed && (
        <div>
          有人在打：第 {result.claimed.cell + 1} 格，
          {result.claimed.participant_count === null ? "人數讀不到" : `${result.claimed.participant_count} 人`}
        </div>
      )}
      {result.unread > 0 && <div className="muted">另有 {result.unread} 顆沒讀到名稱</div>}
      {giants.map((s) => (
        <SightingCard key={s.id} s={s} />
      ))}
    </div>
  );
}
