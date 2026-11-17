import { useState, type ReactElement, type ReactNode } from "react";

/** 介面元件，對應 design/pages/00-design-system；樣式在 style.css。 */

const S = { className: "i", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const icons = {
  check: <svg {...S}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  cross: <svg {...S}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  question: <svg {...S}><path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.6V14" /><circle cx="12" cy="18" r=".6" fill="currentColor" /></svg>,
  chevron: <svg {...S}><path d="M6 9l6 6 6-6" /></svg>,
  up: <svg {...S}><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  down: <svg {...S}><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
  edit: <svg {...S}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>,
  trash: <svg {...S}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  plus: <svg {...S}><path d="M12 5v14M5 12h14" /></svg>,
  search: <svg {...S}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>,
  arrow: <svg {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  back: <svg {...S}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  play: <svg className="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>,
  pause: <svg {...S}><path d="M9 6v12M15 6v12" /></svg>,
  stop: <svg className="i" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  map: <svg {...S}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>,
  leaf: (
    <svg className="i" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12C12 7 15 4 20 4c0 5-3 8-8 8z" fill="currentColor" />
      <path d="M12 14c0-3.5-2.2-6-6-6 0 3.8 2.3 6 6 6z" fill="currentColor" opacity=".55" />
    </svg>
  ),
} satisfies Record<string, ReactElement>;

/** App 的標誌：一朵蘑菇加一朵小花。 */
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M4 16C4 9 9.5 4 16 4s12 5 12 12c0 1.2-1 2-2.2 2H6.2C5 18 4 17.2 4 16z" fill="var(--primary)" />
      <circle cx="11" cy="10.5" r="2.2" fill="#fff" />
      <circle cx="19.5" cy="8.5" r="1.6" fill="#fff" />
      <circle cx="22" cy="13.5" r="2" fill="#fff" />
      <path d="M11.5 18h9l-.8 8.2c-.1 1-1 1.8-2 1.8h-3.4c-1 0-1.9-.8-2-1.8L11.5 18z" fill="#F6EBD3" stroke="var(--primary-edge)" strokeWidth="1" />
      <g transform="translate(25 25)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-3.2" rx="2" ry="2.8" fill="#fff" stroke="var(--border-strong)" strokeWidth=".6" transform={`rotate(${r})`} />
        ))}
        <circle r="1.9" fill="var(--accent)" />
      </g>
    </svg>
  );
}

/** 面板裡的一個白色區塊，左上是葉子標題。 */
export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="sec">
      {title && (
        <h3 className="sec-title">
          {icons.leaf}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/**
 * 欄位：上面標籤（＋右側補充說明），下面輸入，錯誤在最下面。
 * 只包一個輸入框時用 <label>，點標籤會聚焦；裡面有按鈕（例如 Target 標籤的 ×）時傳 group，改用 <div>，免得點標籤觸發按鈕。
 */
export function Field({ label, hint, req, err, group, children }: { label: string; hint?: string; req?: boolean; err?: string | null; group?: boolean; children: ReactNode }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="field">
      <span className="top">
        <span className="field-label">
          {label}
          {req && <span className="req">（必填）</span>}
        </span>
        {hint && <span className="muted">{hint}</span>}
      </span>
      {children}
      {err && <span className="err">{err}</span>}
    </Tag>
  );
}

/** 可收合的一列；open 不給時自己記開合。 */
export function Disclosure({ label, count, open, defaultOpen = false, onToggle, children }: { label: ReactNode; count?: string; open?: boolean; defaultOpen?: boolean; onToggle?: (open: boolean) => void; children: ReactNode }) {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const toggle = () => (onToggle ? onToggle(!isOpen) : setOwn(!isOpen));
  return (
    <div className={`disc ${isOpen ? "open" : ""}`}>
      <button type="button" className="disc-head" aria-expanded={isOpen} onClick={toggle}>
        <span>
          {label}
          {count && <span className="count">　{count}</span>}
        </span>
        {icons.chevron}
      </button>
      {isOpen && <div className="disc-body">{children}</div>}
    </div>
  );
}

/** 小型分段切換。 */
export function Seg<T extends string>({ items, value, disabled, onChange }: { items: { value: T; label: string }[]; value: T; disabled?: boolean; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {items.map((i) => (
        <button key={i.value} type="button" role="radio" aria-checked={i.value === value} className={i.value === value ? "on" : ""} disabled={disabled} onClick={() => onChange(i.value)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

/** 答案：綠＝是、紅＝不是、灰＝無法判斷。 */
export type Verdict = "yes" | "no" | "unknown";
const VERDICT_ICON = { yes: icons.check, no: icons.cross, unknown: icons.question } as const;
export const VERDICT_LABEL: Record<Verdict, string> = { yes: "是", no: "不是", unknown: "無法判斷" };
export const CHECK_LABEL: Record<Verdict, string> = { yes: "找到", no: "沒找到", unknown: "沒讀完" };
export const toVerdict = (v: boolean | null): Verdict => (v === true ? "yes" : v === false ? "no" : "unknown");

export function VerdictBadge({ v, label }: { v: Verdict; label?: string }) {
  return (
    <span className={`badge ${v}`}>
      {VERDICT_ICON[v]}
      {label ?? VERDICT_LABEL[v]}
    </span>
  );
}

/** 答案統計：徽章＋數量，也當地圖顏色的圖例。 */
export function Tally({ counts, labels = VERDICT_LABEL }: { counts: Record<Verdict, number>; labels?: Record<Verdict, string> }) {
  return (
    <div className="tally">
      {(["yes", "no", "unknown"] as const).map((v) => (
        <span key={v} className={`badge ${v}`}>
          {VERDICT_ICON[v]}
          {labels[v]}
          <span className="num"> {counts[v]}</span>
        </span>
      ))}
    </div>
  );
}

export const countVerdicts = (vs: (boolean | null)[]): Record<Verdict, number> => {
  const c = { yes: 0, no: 0, unknown: 0 };
  for (const v of vs) c[toVerdict(v)]++;
  return c;
};

export const STATUS_LABEL: Record<string, string> = { running: "執行中", queued: "排隊中", done: "完成", failed: "失敗", cancelled: "已取消" };
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** 截圖：點開看原圖。 */
export function Shot({ url, alt }: { url: string; alt: string }) {
  return (
    <a className="shot" href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} />
    </a>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <div className="fill" style={{ width: `${total > 0 ? Math.min(100, (value / total) * 100) : 0}%` }} />
    </div>
  );
}
