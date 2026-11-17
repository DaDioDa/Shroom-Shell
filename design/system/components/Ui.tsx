import type { ReactNode } from "react";
import { verdict, type Verdict } from "../theme.js";
import { icons, type IconName } from "./icons.js";

type BtnState = "hover" | "disabled" | "on";

export function Button({ kind = "default", state, size, icon, children }: { kind?: "default" | "primary" | "danger" | "danger solid"; state?: BtnState; size?: "block" | "small"; icon?: IconName; children: ReactNode }) {
  return (
    <span className={["btn", kind !== "default" && kind, state, size].filter(Boolean).join(" ")}>
      {icon && icons[icon]}
      {children}
    </span>
  );
}

export function IconButton({ icon, state, danger, label }: { icon: IconName; state?: "disabled"; danger?: boolean; label: string }) {
  return (
    <span className={["btn icon", state, danger && "danger"].filter(Boolean).join(" ")} aria-label={label}>
      {icons[icon]}
    </span>
  );
}

export const TABS = ["無人巨菇", "探索區域", "美片菇", "指定菇菇", "歷史"] as const;
export function Tabs({ active, hover }: { active: (typeof TABS)[number]; hover?: (typeof TABS)[number] }) {
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <span key={t} className={["tab", t === active && "active", t === hover && "hover"].filter(Boolean).join(" ")}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** 區塊標題；英文小字只在雙語標題的方向顯示。 */
export function SectionHead({ title, en }: { title: string; en: string }) {
  return (
    <div className="sec-head">
      <h3 className="sec-title">
        {icons.leaf}
        {title}
      </h3>
      <span className="sec-en">{en}</span>
    </div>
  );
}

export function Select({ value, grow }: { value: string; grow?: boolean }) {
  return (
    <span className={`select ${grow ? "grow" : ""}`}>
      <span>{value}</span>
      {icons.chevron}
    </span>
  );
}

export function Input({ value, placeholder, state, grow }: { value?: string; placeholder?: string; state?: "focus" | "invalid"; grow?: boolean }) {
  return <span className={["input", !value && "placeholder", state, grow && "grow"].filter(Boolean).join(" ")}>{value ?? placeholder}</span>;
}

export function Textarea({ placeholder, value }: { placeholder?: string; value?: string }) {
  return <div className={`textarea ${value ? "filled" : ""}`}>{value ?? placeholder}</div>;
}

export function Checkbox({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <span className="check">
      <span className={`box ${checked ? "on" : ""}`}>{checked && icons.check}</span>
      {label}
    </span>
  );
}

export function Slider({ label, value, min, max, unit, note, disabled, valueText }: { label: string; value: number; min: number; max: number; unit?: string; note?: string; disabled?: boolean; valueText?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`slider ${disabled ? "disabled" : ""}`}>
      <div className="top">
        <span className="field-label">{label}</span>
        {note && <span className="muted">{note}</span>}
      </div>
      <div className="bottom">
        <div className="track">
          <div className="fill" style={{ width: `${pct}%` }} />
          <div className="thumb" style={{ left: `${pct}%` }} />
        </div>
        <span className={`numbox num ${valueText ? "text" : ""}`}>{valueText ?? value}</span>
        {unit && !valueText && <span className="muted">{unit}</span>}
      </div>
    </div>
  );
}

/** Sweep Area 的答案：圖示＋文字＋顏色，不只靠顏色。 */
export function VerdictBadge({ v }: { v: Verdict }) {
  const d = verdict[v];
  return (
    <span className={`badge ${v}`}>
      {icons[d.icon]}
      {d.label}
    </span>
  );
}

export type BatchStatus = "running" | "queued" | "done" | "failed" | "cancelled";
export const STATUS_LABEL: Record<BatchStatus, string> = { running: "執行中", queued: "排隊中", done: "完成", failed: "失敗", cancelled: "已取消" };

export function StatusBadge({ kind, children }: { kind: BatchStatus; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function QuietResultCard({ index, name, v, radius, reason, children }: { index: number; name: string; v: Verdict; radius: number; reason: string; children?: ReactNode }) {
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{index}</span>
        <span className="title">{name}</span>
        <VerdictBadge v={v} />
      </div>
      <p>{reason}</p>
      <p className="muted">半徑 {radius} m</p>
      {children}
    </div>
  );
}

/** 截圖列：起點畫面／Postcard；圖片被 retention 清掉時只留一行字。 */
function Shots({ postcard, cleared }: { postcard: boolean | "n/a"; cleared?: boolean }) {
  if (cleared) return <p className="muted">圖片已清除</p>;
  return (
    <div className="shots">
      <span className="shot">
        <FrameShot />
      </span>
      {postcard === true && (
        <span className="shot">
          <PostcardShot />
        </span>
      )}
      {postcard === false && <span className="shot-empty">沒有 Postcard</span>}
    </div>
  );
}

export function SightingCard({ target, spot, participants, expiry, seen, postcard = true, expired, cleared }: { target: string; spot: string; participants: string; expiry: string; seen?: string; postcard?: boolean; expired?: boolean; cleared?: boolean }) {
  return (
    <div className={`card ${expired ? "expired" : ""}`}>
      <div className="head">
        <span className="title">{target}</span>
        <a className="link-arrow">地圖</a>
      </div>
      <p>{spot}</p>
      <p className="muted">
        {participants}｜{expiry}
        {seen && `（${seen}）`}
      </p>
      <Shots postcard={postcard} cleared={cleared} />
    </div>
  );
}

const CHECK = { found: { v: "yes", label: "找到" }, missing: { v: "no", label: "沒找到" }, unfinished: { v: "unknown", label: "沒讀完" } } as const;

/** 美片菇（Postcard Check）一個 Waypoint 的結果。 */
export function CheckResultCard({ index, name, kind, children, postcard = true }: { index: number; name: string; kind: keyof typeof CHECK; children: ReactNode; postcard?: boolean | "n/a" }) {
  const c = CHECK[kind];
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{index}</span>
        <span className="title">{name}</span>
        <span className={`badge ${c.v}`}>
          {icons[verdict[c.v].icon]}
          {c.label}
        </span>
      </div>
      {children}
      <Shots postcard={kind === "found" ? postcard : "n/a"} />
    </div>
  );
}

export function WaypointRow({ n, name, meta, first, last, editing, bad }: { n: number; name: string; meta: string; first?: boolean; last?: boolean; editing?: boolean; bad?: boolean }) {
  return (
    <div className={`wp ${editing ? "editing" : ""}`}>
      <span className="n">{n}</span>
      <div className="grow">
        <div className="name">{name}</div>
        <div className={`meta ${bad ? "err" : ""}`}>{meta}</div>
      </div>
      <span className="acts">
        <IconButton icon="up" label="上移" state={first ? "disabled" : undefined} />
        <IconButton icon="down" label="下移" state={last ? "disabled" : undefined} />
        <IconButton icon="edit" label="編輯" />
        <IconButton icon="trash" label="刪除" />
      </span>
    </div>
  );
}

export function Log({ lines }: { lines: string[] }) {
  return <div className="log">{lines.join("\n")}</div>;
}

export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div className="progress">
      <div className="fill" style={{ width: `${(value / total) * 100}%` }} />
    </div>
  );
}

/** 底部抽屜：執行中的 Batch、進度、停止，以及排隊中的 Batch；沒有在跑時顯示目前分頁 Batch 的結束狀態。 */
export function BatchDrawer({
  state = "running",
  log,
  queue = true,
  title = "#42 無人巨菇｜台北信義區",
  at = 3,
  total = 12,
  unit = "Waypoint",
  label = "象山親山步道",
  result,
}: {
  state?: "running" | "forcing" | "done" | "failed";
  log?: string[];
  queue?: boolean;
  /** Batch 編號、功能與清單。 */
  title?: string;
  at?: number;
  total?: number;
  /** 進度的單位：Waypoint 或格子。 */
  unit?: string;
  label?: string;
  /** 結束時的那一行；不給就用預設文字。 */
  result?: string;
}) {
  if (state === "done" || state === "failed") {
    return (
      <div className="drawer">
        {state === "done" ? <p>{result ?? `完成：共 ${total} 個 ${unit}`}</p> : <p className="err">{result ?? "失敗：找不到手機（adb devices 沒有裝置）"}</p>}
        {log && <Log lines={log} />}
        {queue && <QueueRow />}
      </div>
    );
  }
  const forcing = state === "forcing";
  return (
    <div className="drawer">
      <div className="line">
        <StatusBadge kind="running">執行中</StatusBadge>
        <a className="grow">{title}</a>
        <Button size="small" icon="pause">跑完這點就停</Button>
        <Button size="small" kind="danger" icon="stop">強制停止</Button>
      </div>
      {forcing && (
        <div className="warn">
          強制停止會立刻結束 bot 的程序。遊戲可能還開著、手機螢幕可能沒鎖，之後要自己處理。
          <span className="line">
            <Button size="small" kind="danger solid">確定強制停止</Button>
            <Button size="small">取消</Button>
          </span>
        </div>
      )}
      <div className="line">
        <span className="grow">
          <Progress value={at} total={total} />
        </span>
        <span className="muted num">
          第 {at} / {total} 個 {unit}
          {label && `（${label}）`}
        </span>
      </div>
      {log && <Log lines={log} />}
      {queue && <QueueRow />}
    </div>
  );
}

function QueueRow() {
  return (
    <div className="queue">
      <StatusBadge kind="queued">排隊 1</StatusBadge>
      <a className="grow">#43 美片菇｜每日巡邏</a>
      <Button size="small">移出佇列</Button>
    </div>
  );
}

/** 截圖的示意圖（不是真的圖片）。 */
export function FrameShot() {
  return (
    <svg viewBox="0 0 76 96" preserveAspectRatio="xMidYMid slice">
      <rect width="76" height="96" fill="#8FD18B" />
      <path d="M0 60 Q20 52 38 58 T76 54 V96 H0z" fill="#6DBF6A" />
      <circle cx="38" cy="44" r="14" fill="#C2410C" />
      <circle cx="33" cy="40" r="3" fill="#fff" />
      <circle cx="43" cy="42" r="2.5" fill="#fff" />
      <rect x="33" y="50" width="10" height="10" rx="3" fill="#F6EBD3" />
    </svg>
  );
}

export function PostcardShot() {
  return (
    <svg viewBox="0 0 76 96" preserveAspectRatio="xMidYMid slice">
      <rect width="76" height="96" fill="#BFE3F5" />
      <rect x="6" y="6" width="64" height="84" fill="#FFFDF6" />
      <rect x="10" y="10" width="56" height="54" fill="#9CC7E5" />
      <path d="M10 50 L26 36 L38 46 L50 32 L66 48 V64 H10z" fill="#5E9D6A" />
      <rect x="14" y="70" width="40" height="3" rx="1.5" fill="#D6CFBE" />
      <rect x="14" y="77" width="28" height="3" rx="1.5" fill="#D6CFBE" />
    </svg>
  );
}
