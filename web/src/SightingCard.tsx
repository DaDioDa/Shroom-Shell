import { useEffect, useState } from "react";
import { describeSighting, type StoredSighting } from "@shell/shared";
import { api } from "./api.js";
import { icons, Shot } from "./ui.js";

type TeleportState = { state: "idle" | "moving" | "done" } | { state: "error"; message: string };

/**
 * 一筆 Sighting：Target、地點、人數｜到期，以及起點畫面與 Postcard 兩張截圖。
 * 「移到這裡」把手機的模擬 GPS 設到這顆蘑菇；deviceBusy（有 Batch 在跑）時不能按。
 */
export function SightingCard({ s, deviceBusy = false }: { s: StoredSighting; deviceBusy?: boolean }) {
  const d = describeSighting(s, Date.now());
  const [tp, setTp] = useState<TeleportState>({ state: "idle" });
  // 「已移到這裡」只亮一下，免得按過別張卡片後這張還寫著。
  useEffect(() => {
    if (tp.state !== "done") return;
    const t = setTimeout(() => setTp({ state: "idle" }), 4000);
    return () => clearTimeout(t);
  }, [tp.state]);
  const teleport = async () => {
    setTp({ state: "moving" });
    try {
      await api.teleport(s.lat, s.lng);
      setTp({ state: "done" });
    } catch (e) {
      setTp({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };
  const moving = tp.state === "moving";
  return (
    <div className={`card ${d.state}`}>
      <div className="head">
        <span className="title">{s.target}</span>
        <a href={d.mapUrl} target="_blank" rel="noreferrer">
          地圖
        </a>
        <button
          type="button"
          className="btn small"
          disabled={deviceBusy || moving}
          title={deviceBusy ? "有 Batch 正在執行，結束後才能移動 GPS" : "把手機的模擬 GPS 設到這顆蘑菇的位置"}
          onClick={teleport}
        >
          {icons.pin}
          {moving ? "移動中…" : "移到這裡"}
        </button>
      </div>
      <p>{s.spot_name}</p>
      <p className="muted">
        {d.participants}｜{d.expiry}
        {d.seen && `（${d.seen}）`}
      </p>
      {tp.state === "done" && <p className="ok">{icons.check}GPS 已移到這裡</p>}
      {tp.state === "error" && <p className="err">{tp.message}</p>}
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
