import { useEffect, useRef, useState } from "react";
import { GIANT_TARGET, addTarget, type BatchView, type WaypointList } from "@shell/shared";
import { api } from "./api.js";
import { SightingCard } from "./SightingCard.js";

interface Props {
  list: WaypointList | null;
  view: BatchView;
  onStarted: (batchId: number) => void;
}

export function TargetSearchPanel({ list, view, onStarted }: Props) {
  const [targets, setTargets] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [radius, setRadius] = useState(500);
  const [skipCrowded, setSkipCrowded] = useState(0);
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
      <h4>Target Search</h4>
      <p>Waypoint List：{list ? `${list.name}（${list.waypointCount}）` : "請先在「Waypoint List」分頁選一份"}</p>

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

      <div>
        <label>
          預設半徑（公尺）
          <input type="number" min={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>
      </div>
      <div>
        <label>
          --skip-crowded（0 = 不略過）
          <input type="number" min={0} value={skipCrowded} onChange={(e) => setSkipCrowded(Number(e.target.value))} />
        </label>
      </div>
      <button disabled={!list || (targets.length === 0 && !input.trim())} onClick={start}>
        開始
      </button>
      {startError && <p className="errors">{startError}</p>}

      {view.status !== "idle" && (
        <>
          <p>
            {queued
              ? `排隊中：前面還有 ${view.queuePosition ?? 1} 個 Batch，輪到才會開始`
              : running
                ? `進度：第 ${view.index} / ${view.total} 個 Waypoint${view.label ? `（${view.label}）` : ""}`
                : view.status === "done"
                  ? `完成：共 ${view.total} 個 Waypoint，找到 ${view.sightings.length} 筆`
                  : view.status === "cancelled"
                    ? `已取消：跑了 ${view.index} / ${view.total} 個 Waypoint，找到 ${view.sightings.length} 筆${view.error ? `。${view.error}` : ""}`
                    : `失敗：${view.error}`}
          </p>
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
