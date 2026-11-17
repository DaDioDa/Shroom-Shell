import type { ReactElement } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const icons = {
  check: <svg viewBox="0 0 24 24" {...S}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  cross: <svg viewBox="0 0 24 24" {...S}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  question: <svg viewBox="0 0 24 24" {...S}><path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.6V14" /><circle cx="12" cy="18" r=".6" fill="currentColor" /></svg>,
  chevron: <svg viewBox="0 0 24 24" {...S}><path d="M6 9l6 6 6-6" /></svg>,
  up: <svg viewBox="0 0 24 24" {...S}><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  down: <svg viewBox="0 0 24 24" {...S}><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
  edit: <svg viewBox="0 0 24 24" {...S}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>,
  trash: <svg viewBox="0 0 24 24" {...S}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  plus: <svg viewBox="0 0 24 24" {...S}><path d="M12 5v14M5 12h14" /></svg>,
  search: <svg viewBox="0 0 24 24" {...S}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>,
  arrow: <svg viewBox="0 0 24 24" {...S}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>,
  pause: <svg viewBox="0 0 24 24" {...S}><path d="M9 6v12M15 6v12" /></svg>,
  stop: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
  map: <svg viewBox="0 0 24 24" {...S}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>,
  /** 區塊標題前的小葉子（方向 A）。 */
  leaf: (
    <svg viewBox="0 0 24 24">
      <path d="M12 21V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12C12 7 15 4 20 4c0 5-3 8-8 8z" fill="currentColor" />
      <path d="M12 14c0-3.5-2.2-6-6-6 0 3.8 2.3 6 6 6z" fill="currentColor" opacity=".55" />
    </svg>
  ),
  /** 卡片上的「目標」小圓點旗子。 */
  arrowCircle: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M10 8l4 4-4 4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof icons;

/** App 的標誌：一朵蘑菇加一朵小花，顏色跟主題走。 */
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32">
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
