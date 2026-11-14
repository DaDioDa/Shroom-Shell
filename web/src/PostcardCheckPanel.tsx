import { useState } from "react";
import { missingSpotNames, type BatchView, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { CheckResultCard } from "./CheckResultCard.js";

interface Props {
  list: WaypointList | null;
  waypoints: Waypoint[];
  view: BatchView;
  onStarted: (batchId: number) => void;
}

export function PostcardCheckPanel({ list, waypoints, view, onStarted }: Props) {
  const [startError, setStartError] = useState<string | null>(null);
  const running = view.status === "running";
  const missing = missingSpotNames(waypoints);
  const nameOf = (id: number) => {
    const w = waypoints.find((x) => x.id === id);
    return w ? w.label || `${w.lat}, ${w.lng}` : `Waypoint ${id}`;
  };
  const start = async () => {
    if (!list) return;
    setStartError(null);
    try {
      onStarted((await api.startPostcardCheck({ listId: list.id })).batchId);
    } catch (e) {
      setStartError((e as Error).message);
    }
  };
  return (
    <div>
      <h4>Postcard Check</h4>
      <p>Waypoint List：{list ? `${list.name}（${list.waypointCount}）` : "請先在「Waypoint List」分頁選一份"}</p>
      <p className="muted">
        每個 Waypoint 先 Teleport，再跑 <code>check --spot-name "Spot Name"</code>。Spot Name 可在匯入時寫{" "}
        <code>lat,lng r=300 標籤 @Spot Name</code>，或點地圖標記編輯。
      </p>
      <p className="muted">GPS 要夠準：<code>check</code> 只看冷啟動後的起點畫面，那顆蘑菇不在畫面上就找不到。</p>
      {list && missing.length > 0 && <p className="errors">缺 Spot Name：{missing.map((w) => w.label || `${w.lat}, ${w.lng}`).join("、")}</p>}
      <button disabled={!list || running || missing.length > 0} onClick={start}>
        開始
      </button>
      {startError && <p className="errors">{startError}</p>}
      <p className="muted">地圖：綠＝找到、紅＝沒找到、灰＝沒讀完。</p>
      {view.status !== "idle" && (
        <>
          <p>
            {running
              ? `進度：第 ${view.index} / ${view.total} 個 Waypoint${view.label ? `（${view.label}）` : ""}`
              : view.status === "done"
                ? `完成：共 ${view.total} 個 Waypoint`
                : `失敗：${view.error}`}
          </p>
          {view.checkResults.map((o) => (
            <CheckResultCard key={o.index} outcome={o} name={nameOf(o.waypointId)} />
          ))}
        </>
      )}
    </div>
  );
}
