import { useEffect, useRef, useState } from "react";
import type { BatchView, Waypoint, WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { QuietResultCard } from "./QuietResultCard.js";

interface Props {
  list: WaypointList | null;
  waypoints: Waypoint[];
  view: BatchView;
  onStarted: (batchId: number) => void;
}

export function QuietSearchPanel({ list, waypoints, view, onStarted }: Props) {
  const [radius, setRadius] = useState(500);
  const [startError, setStartError] = useState<string | null>(null);
  const log = useRef<HTMLPreElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [view.stderr.length]);

  const running = view.status === "running";
  const start = async () => {
    if (!list) return;
    setStartError(null);
    try {
      const { batchId } = await api.startQuietSearch({ listId: list.id, radius });
      onStarted(batchId);
    } catch (e) {
      setStartError((e as Error).message);
    }
  };
  const nameOf = (id: number) => {
    const w = waypoints.find((x) => x.id === id);
    return w ? w.label || `${w.lat}, ${w.lng}` : `Waypoint ${id}`;
  };

  return (
    <div>
      <h4>Quiet Giant Search</h4>
      <p>Waypoint List：{list ? `${list.name}（${list.waypointCount}）` : "請先在「Waypoint List」分頁選一份"}</p>
      <p className="muted">
        每個 Waypoint 跑 <code>quiet --radius R</code>。R 用 Waypoint 自己的半徑，沒有就用下面的預設半徑。
        Waypoint 半徑可在匯入時寫 <code>lat,lng r=300 標籤</code>，或點地圖標記編輯。
      </p>
      <div>
        <label>
          預設半徑（公尺）
          <input type="number" min={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>
      </div>
      <button disabled={!list || running || !(radius > 0)} onClick={start}>
        開始
      </button>
      {startError && <p className="errors">{startError}</p>}
      <p className="muted">地圖：綠＝是、紅＝不是、灰＝無法判斷（正方形邊長 2R）。</p>

      {view.status !== "idle" && (
        <>
          <p>
            {running
              ? `進度：第 ${view.index} / ${view.total} 個 Waypoint${view.label ? `（${view.label}）` : ""}`
              : view.status === "done"
                ? `完成：共 ${view.total} 個 Waypoint`
                : `失敗：${view.error}`}
          </p>
          <pre ref={log} className="log">
            {view.stderr.join("\n")}
          </pre>
          {view.quietResults.map((o) => (
            <QuietResultCard
              key={o.index}
              outcome={o}
              name={nameOf(o.waypointId)}
              giants={view.sightings.filter((s) => s.waypointId === o.waypointId)}
            />
          ))}
        </>
      )}
    </div>
  );
}
