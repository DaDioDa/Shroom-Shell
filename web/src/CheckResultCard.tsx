import { describePostcardCheck, type CheckOutcome } from "@shell/shared";
import { CHECK_LABEL, Shot, VerdictBadge, type Verdict } from "./ui.js";

const KIND_VERDICT: Record<"found" | "missing" | "unfinished", Verdict> = { found: "yes", missing: "no", unfinished: "unknown" };

/** 一個 Waypoint 的 `check` 結果：找到／沒找到／沒讀完。 */
export function CheckResultCard({ outcome, name }: { outcome: CheckOutcome; name: string }) {
  const d = describePostcardCheck(outcome.result, Date.now());
  const v = KIND_VERDICT[d.kind];
  const found = outcome.result.found === true;
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{outcome.index}</span>
        <span className="title">{name}</span>
        <VerdictBadge v={v} label={CHECK_LABEL[v]} />
      </div>
      {found ? (
        <p>
          {d.title}｜{d.participants}｜{d.message}
        </p>
      ) : (
        <p>{d.message}</p>
      )}
      {d.partial.length > 0 && <p>已讀到：{d.partial.join("｜")}</p>}
      {d.note && <p className="muted">{d.note}</p>}
      {d.mapUrl && (
        <a href={d.mapUrl} target="_blank" rel="noreferrer">
          地圖
        </a>
      )}
      {outcome.imagesCleared ? (
        <p className="muted">圖片已清除</p>
      ) : (
        (outcome.abortUrl || outcome.frameUrl || found) && (
          <div className="shots">
            {outcome.abortUrl && <Shot url={outcome.abortUrl} alt="abort.png" />}
            {outcome.frameUrl && <Shot url={outcome.frameUrl} alt="起點畫面" />}
            {found && (outcome.postcardUrl ? <Shot url={outcome.postcardUrl} alt="Postcard" /> : <span className="shot-empty">沒有 Postcard</span>)}
          </div>
        )
      )}
    </div>
  );
}
