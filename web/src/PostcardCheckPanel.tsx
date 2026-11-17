import { useState } from "react";
import { featureName, missingSpotNames, type BatchView, type Waypoint, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { CheckResultCard } from "./CheckResultCard.js";
import { CHECK_LABEL, icons, Section, Tally } from "./ui.js";

interface Props {
  list: WaypointList | null;
  waypoints: Waypoint[];
  view: BatchView;
  onStarted: (batchId: number) => void;
}

/** 美片菇：開始（缺 Spot Name 時停用）與結果卡片。Spot Name 的匯入格式寫在清單區塊的「從文字匯入」裡。 */
export function PostcardCheckPanel({ list, waypoints, view, onStarted }: Props) {
  const [startError, setStartError] = useState<string | null>(null);
  const busy = view.status === "running";
  const missing = missingSpotNames(waypoints);
  const nameOf = (p: { label: string; lat: number; lng: number }) => p.label || `${p.lat}, ${p.lng}`;
  const start = async () => {
    if (!list) return;
    setStartError(null);
    try {
      onStarted((await api.startPostcardCheck({ listId: list.id })).batchId);
    } catch (e) {
      setStartError((e as Error).message);
    }
  };
  const results = view.checkResults;
  const counts = { yes: 0, no: 0, unknown: 0 };
  for (const o of results) counts[o.result.found === true ? "yes" : o.result.found === false ? "no" : "unknown"]++;

  return (
    <>
      <Section title={featureName("postcard-check")}>
        <p className="muted">GPS 要夠準：只看冷啟動後的起點畫面，那顆蘑菇不在畫面上就找不到。</p>
        {list && missing.length > 0 && <p className="err">缺 Spot Name：{missing.map((w) => w.label || `${w.lat}, ${w.lng}`).join("、")}。點那一列的編輯補上。</p>}
        <button className="btn primary block" disabled={!list || busy || missing.length > 0} onClick={start}>
          {icons.play}開始
        </button>
        {!list && <p className="muted">先在上面選一份清單。</p>}
        {startError && <p className="err">{startError}</p>}
      </Section>
      {results.length > 0 && (
        <Section title="結果">
          <Tally counts={counts} labels={CHECK_LABEL} />
          {results.map((o) => (
            <CheckResultCard key={o.index} outcome={o} name={nameOf(o.point)} />
          ))}
        </Section>
      )}
    </>
  );
}
