import { useEffect, useRef, useState } from "react";
import { SLIDER_SPECS, batchStatusText, featureName, type BatchView, Waypoint, WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { QuietResultCard } from "./QuietResultCard.js";
import { Slider } from "./Slider.js";

interface Props {
  list: WaypointList | null;
  waypoints: Waypoint[];
  view: BatchView;
  radius: number;
  onRadiusChange: (r: number) => void;
  onStarted: (batchId: number) => void;
}

export function QuietSearchPanel({ list, waypoints, view, radius, onRadiusChange, onStarted }: Props) {
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
  const nameOf = (p: { label: string; lat: number; lng: number }) => p.label || `${p.lat}, ${p.lng}`;

  return (
    <div>
      <h4>{featureName("quiet-search")}</h4>
      <p>清單：{list ? `${list.name}（${list.waypointCount}）` : "請先在上方選一份清單"}</p>
      <p className="muted">
        每個 Waypoint 跑 <code>quiet --radius R</code>。R 用 Waypoint 自己的半徑，沒有就用下面的預設半徑。
        Waypoint 半徑可在匯入時寫 <code>lat,lng r=300 標籤</code>，或點地圖標記編輯。
      </p>
      <Slider label="預設半徑" spec={SLIDER_SPECS.radius} value={radius} unit="m" disabled={running} onChange={onRadiusChange} />
      <button disabled={!list || running} onClick={start}>
        開始
      </button>
      {startError && <p className="errors">{startError}</p>}
      <p className="muted">拉半徑時，地圖會在每個 Waypoint 周圍畫出 2R 的藍色預覽正方形。地圖：綠＝是、紅＝不是、灰＝無法判斷（正方形邊長 2R）。</p>

      {view.status !== "idle" && (
        <>
          <p>{batchStatusText(view)}</p>
          <pre ref={log} className="log">
            {view.stderr.join("\n")}
          </pre>
          {view.quietResults.map((o) => (
            <QuietResultCard
              key={o.index}
              outcome={o}
              name={nameOf(o.point)}
              giants={view.sightings.filter((s) => s.waypointId === o.waypointId)}
            />
          ))}
        </>
      )}
    </div>
  );
}
