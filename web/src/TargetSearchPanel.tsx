import { useEffect, useRef, useState } from "react";
import { GIANT_TARGET, SLIDER_SPECS, addTarget, batchStatusText, featureName, type BatchView, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { SightingCard } from "./SightingCard.js";
import { Slider } from "./Slider.js";
import { useStoredSlider } from "./storage.js";

interface Props {
  list: WaypointList | null;
  view: BatchView;
  radius: number;
  onRadiusChange: (r: number) => void;
  onStarted: (batchId: number) => void;
}

export function TargetSearchPanel({ list, view, radius, onRadiusChange, onStarted }: Props) {
  const [targets, setTargets] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [skipCrowded, setSkipCrowded] = useStoredSlider("slider.skipCrowded", SLIDER_SPECS.skipCrowded);
  const [startError, setStartError] = useState<string | null>(null);
  const log = useRef<HTMLPreElement>(null);

  useEffect(() => void api.targets().then(setKnown), [view.status]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [view.stderr.length]);

  const running = view.status === "running";
  const queued = view.status === "queued";
  const add = (raw: string) => {
    setTargets((t) => addTarget(t, raw));
    setInput("");
  };
  const start = async () => {
    if (!list) return;
    setStartError(null);
    // 輸入框裡還沒按 Enter 的字也算
    const all = addTarget(targets, input);
    setTargets(all);
    setInput("");
    try {
      const { batchId } = await api.startTargetSearch({ listId: list.id, targets: all, radius, skipCrowded });
      onStarted(batchId);
    } catch (e) {
      setStartError((e as Error).message);
    }
  };

  return (
    <div>
      <h4>{featureName("target-search")}</h4>
      <p>清單：{list ? `${list.name}（${list.waypointCount}）` : "請先在上方選一份清單"}</p>

      <div>
        Target：
        {targets.map((t) => (
          <span key={t} className="chip">
            {t} <button onClick={() => setTargets(targets.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <input
        list="known-targets"
        value={input}
        placeholder="輸入名稱後按 Enter，例如 巨大 輝煌蘑菇"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add(input)}
      />
      <datalist id="known-targets">
        {known.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <button onClick={() => add(GIANT_TARGET)}>巨菇</button>

      <Slider label="預設半徑" spec={SLIDER_SPECS.radius} value={radius} unit="m" disabled={running || queued} onChange={onRadiusChange} />
      <Slider label="--skip-crowded" spec={SLIDER_SPECS.skipCrowded} value={skipCrowded} disabled={running || queued} valueText={(v) => (v === 0 ? "不略過" : null)} onChange={setSkipCrowded} />
      <button disabled={!list || (targets.length === 0 && !input.trim())} onClick={start}>
        開始
      </button>
      {startError && <p className="errors">{startError}</p>}

      {view.status !== "idle" && (
        <>
          <p>{batchStatusText(view, view.sightings.length)}</p>
          {view.failures.length > 0 && (
            <div className="errors">
              {view.failures.map((f) => (
                <p key={f.index}>
                  第 {f.index} 個 Waypoint 失敗：{f.error}
                  {f.screenshotUrl && (
                    <>
                      <br />
                      <a href={f.screenshotUrl} target="_blank" rel="noreferrer">
                        <img src={f.screenshotUrl} alt="abort.png" style={{ maxWidth: 140, maxHeight: 140 }} />
                      </a>
                    </>
                  )}
                </p>
              ))}
            </div>
          )}
          <pre ref={log} className="log">
            {view.stderr.join("\n")}
          </pre>
          {view.sightings.map((s) => (
            <SightingCard key={s.id} s={s} />
          ))}
        </>
      )}
    </div>
  );
}
