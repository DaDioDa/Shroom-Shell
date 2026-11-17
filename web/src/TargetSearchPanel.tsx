import { useEffect, useState } from "react";
import { GIANT_TARGET, SLIDER_SPECS, addTarget, featureName, type BatchView, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { SightingCard } from "./SightingCard.js";
import { Slider } from "./Slider.js";
import { useStoredSlider } from "./storage.js";
import { Field, icons, Section, Shot } from "./ui.js";

interface Props {
  list: WaypointList | null;
  view: BatchView;
  radius: number;
  onRadiusChange: (r: number) => void;
  onStarted: (batchId: number) => void;
}

/** 打的字在建議裡加粗。 */
function Highlight({ text, typed }: { text: string; typed: string }) {
  const i = text.indexOf(typed);
  if (i < 0 || !typed) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{typed}</mark>
      {text.slice(i + typed.length)}
    </>
  );
}

/** 指定菇菇：Target 標籤、半徑、--skip-crowded、開始；失敗的 Waypoint 與 Sighting 卡片。 */
export function TargetSearchPanel({ list, view, radius, onRadiusChange, onStarted }: Props) {
  const [targets, setTargets] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [skipCrowded, setSkipCrowded] = useStoredSlider("slider.skipCrowded", SLIDER_SPECS.skipCrowded);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => void api.targets().then(setKnown), [view.status]);

  const running = view.status === "running";
  const queued = view.status === "queued";
  const add = (raw: string) => {
    setTargets((t) => addTarget(t, raw));
    setInput("");
  };
  const typed = input.trim();
  const suggestions = typed ? known.filter((k) => k.includes(typed) && !targets.includes(k)).slice(0, 6) : [];
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
  const noTarget = targets.length === 0 && !typed;

  return (
    <>
      <Section title={featureName("target-search")}>
        <Field label="Target" hint="可以放好幾個" group>
          {targets.length > 0 && (
            <div className="chips">
              {targets.map((t) => (
                <span key={t} className="chip">
                  {t}
                  <button type="button" title={`移除 ${t}`} aria-label={`移除 ${t}`} onClick={() => setTargets(targets.filter((x) => x !== t))}>
                    {icons.cross}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="line">
            <input
              className="input grow"
              aria-label="Target 名稱"
              value={input}
              placeholder="輸入名稱後按 Enter，例如 巨大 輝煌蘑菇"
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add(input);
                if (e.key === "Escape") setInput("");
              }}
            />
            <button type="button" className="btn" title={`加入 ${GIANT_TARGET}`} onClick={() => add(GIANT_TARGET)}>
              {icons.plus}巨菇
            </button>
          </div>
          {focused && suggestions.length > 0 && (
            <div className="suggest" role="listbox">
              {suggestions.map((s) => (
                // 用 onMouseDown 才不會先觸發輸入框的 blur 把建議收掉
                <button key={s} type="button" role="option" aria-selected={false} onMouseDown={(e) => (e.preventDefault(), add(s))}>
                  <Highlight text={s} typed={typed} />
                </button>
              ))}
            </div>
          )}
        </Field>
        <Slider label="預設半徑" spec={SLIDER_SPECS.radius} value={radius} unit="m" disabled={running || queued} onChange={onRadiusChange} />
        <Slider label="--skip-crowded" spec={SLIDER_SPECS.skipCrowded} value={skipCrowded} disabled={running || queued} valueText={(v) => (v === 0 ? "不略過" : null)} onChange={setSkipCrowded} />
        <button className="btn primary block" disabled={!list || noTarget} onClick={start}>
          {icons.play}開始
        </button>
        {!list && <p className="muted">先在上面選一份清單。</p>}
        {list && noTarget && <p className="muted">至少要有一個 Target 才能開始。</p>}
        {startError && <p className="err">{startError}</p>}
      </Section>
      {(view.failures.length > 0 || view.sightings.length > 0) && (
        <Section title="結果">
          {view.failures.map((f) => (
            <div key={f.index} className="card">
              <div className="head">
                <span className="idx num">#{f.index}</span>
                <span className="title">第 {f.index} 個 Waypoint</span>
                <span className="badge no">{icons.cross}失敗</span>
              </div>
              <p className="err">{f.error}</p>
              {f.screenshotUrl && (
                <div className="shots">
                  <Shot url={f.screenshotUrl} alt="abort.png" />
                </div>
              )}
            </div>
          ))}
          {view.sightings.map((s) => (
            <SightingCard key={s.id} s={s} />
          ))}
        </Section>
      )}
    </>
  );
}
