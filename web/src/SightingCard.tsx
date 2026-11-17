import { describeSighting, type StoredSighting } from "@shell/shared";
import { Shot } from "./ui.js";

/** 一筆 Sighting：Target、地點、人數｜到期，以及起點畫面與 Postcard 兩張截圖。 */
export function SightingCard({ s }: { s: StoredSighting }) {
  const d = describeSighting(s, Date.now());
  return (
    <div className={`card ${d.state}`}>
      <div className="head">
        <span className="title">{s.target}</span>
        <a href={d.mapUrl} target="_blank" rel="noreferrer">
          地圖
        </a>
      </div>
      <p>{s.spot_name}</p>
      <p className="muted">
        {d.participants}｜{d.expiry}
        {d.seen && `（${d.seen}）`}
      </p>
      {s.imagesCleared ? (
        <p className="muted">圖片已清除</p>
      ) : (
        <div className="shots">
          {s.frameUrl && <Shot url={s.frameUrl} alt="起點畫面" />}
          {s.postcardUrl ? <Shot url={s.postcardUrl} alt="Postcard" /> : <span className="shot-empty">沒有 Postcard</span>}
        </div>
      )}
    </div>
  );
}
