import { describePostcardCheck, type CheckOutcome } from "@shell/shared";

/** 一個 Waypoint 的 `check` 結果：找到／沒找到／沒讀完三種樣式。 */
export function CheckResultCard({ outcome, name }: { outcome: CheckOutcome; name: string }) {
  const d = describePostcardCheck(outcome.result, Date.now());
  return (
    <div className={`card check ${d.kind}`}>
      <strong>
        第 {outcome.index} 個｜{name}
      </strong>
      ：{d.kind === "found" ? "找到" : d.title}
      {d.kind === "found" ? (
        <div>
          {d.title}｜{d.participants}｜{d.message}
        </div>
      ) : (
        <div>{d.message}</div>
      )}
      {d.partial.length > 0 && <div>已讀到：{d.partial.join("｜")}</div>}
      {d.note && <div className="muted">{d.note}</div>}
      {d.mapUrl && (
        <a href={d.mapUrl} target="_blank" rel="noreferrer">
          地圖
        </a>
      )}
      <div className="shots">
        {outcome.frameUrl && (
          <a href={outcome.frameUrl} target="_blank" rel="noreferrer">
            <img src={outcome.frameUrl} alt="起點畫面" />
          </a>
        )}
        {outcome.result.found === true &&
          (outcome.postcardUrl ? (
            <a href={outcome.postcardUrl} target="_blank" rel="noreferrer">
              <img src={outcome.postcardUrl} alt="Postcard" />
            </a>
          ) : (
            <span className="muted">沒有 Postcard</span>
          ))}
      </div>
    </div>
  );
}
