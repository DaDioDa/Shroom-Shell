import { useState } from "react";
import { SLIDER_SPECS, featureName, type BatchView, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { QuietResultCard } from "./QuietResultCard.js";
import { Slider } from "./Slider.js";
import { countVerdicts, icons, Section, Tally } from "./ui.js";

interface Props {
  list: WaypointList | null;
  view: BatchView;
  radius: number;
  onRadiusChange: (r: number) => void;
  onStarted: (batchId: number) => void;
}

/** 無人巨菇：預設半徑與開始；結果卡片。進度、停止與執行紀錄在地圖底部的抽屜。 */
export function QuietSearchPanel({ list, view, radius, onRadiusChange, onStarted }: Props) {
  const [startError, setStartError] = useState<string | null>(null);
  const busy = view.status === "running";
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
    <>
      <Section title={featureName("quiet-search")}>
        <Slider label="預設半徑" note="沒設半徑的 Waypoint 用這個" spec={SLIDER_SPECS.radius} value={radius} unit="m" disabled={busy} onChange={onRadiusChange} />
        <button className="btn primary block" disabled={!list || busy} onClick={start}>
          {icons.play}開始
        </button>
        {!list && <p className="muted">先在上面選一份清單。</p>}
        {startError && <p className="err">{startError}</p>}
      </Section>
      {view.quietResults.length > 0 && (
        <Section title="結果">
          <Tally counts={countVerdicts(view.quietResults.map((o) => o.result.verdict))} />
          {view.quietResults.map((o) => (
            <QuietResultCard key={o.index} outcome={o} name={nameOf(o.point)} giants={view.sightings.filter((s) => s.waypointId === o.waypointId)} />
          ))}
        </Section>
      )}
    </>
  );
}
