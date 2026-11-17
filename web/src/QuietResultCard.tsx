import { type QuietOutcome, type StoredSighting } from "@shell/shared";
import { SightingCard } from "./SightingCard.js";
import { Shot, toVerdict, VerdictBadge } from "./ui.js";

/** 一個 Waypoint 的 `quiet` 結果：答案、reason、claimed、unread，giants 用 Sighting 卡片。 */
export function QuietResultCard({ outcome, name, giants }: { outcome: QuietOutcome; name: string; giants: StoredSighting[] }) {
  const { result, radius, index } = outcome;
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{index}</span>
        <span className="title">{name}</span>
        <VerdictBadge v={toVerdict(result.verdict)} />
      </div>
      <p>{result.reason}</p>
      {result.claimed && (
        <p>
          有人在打：第 {result.claimed.cell + 1} 格，
          {result.claimed.participant_count === null ? "人數讀不到" : `${result.claimed.participant_count} 人`}
        </p>
      )}
      <p className="muted">半徑 {radius} m</p>
      {result.unread > 0 && <p className="muted">另有 {result.unread} 顆沒讀到名稱</p>}
      {outcome.screenshotUrl && (
        <div className="shots">
          <Shot url={outcome.screenshotUrl} alt="abort.png" />
        </div>
      )}
      {giants.map((s) => (
        <SightingCard key={s.id} s={s} />
      ))}
    </div>
  );
}
