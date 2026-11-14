import { describeSighting, type StoredSighting } from "@shell/shared";

export function SightingCard({ s }: { s: StoredSighting }) {
  const d = describeSighting(s, Date.now());
  return (
    <div className={`card ${d.state}`}>
      <strong>{s.target}</strong>｜{s.spot_name}
      <div>
        {d.participants}｜{d.expiry}
        {d.seen && `（${d.seen}）`}
      </div>
      <a href={d.mapUrl} target="_blank" rel="noreferrer">
        地圖
      </a>
      <div className="shots">
        {s.imagesCleared && <span className="muted">圖片已清除</span>}
        {!s.imagesCleared && s.frameUrl && (
          <a href={s.frameUrl} target="_blank" rel="noreferrer">
            <img src={s.frameUrl} alt="截圖" />
          </a>
        )}
        {s.imagesCleared ? null : s.postcardUrl ? (
          <a href={s.postcardUrl} target="_blank" rel="noreferrer">
            <img src={s.postcardUrl} alt="Postcard" />
          </a>
        ) : (
          <span className="muted">沒有 Postcard</span>
        )}
      </div>
    </div>
  );
}
