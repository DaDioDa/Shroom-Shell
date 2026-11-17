import type { CSSProperties, ReactNode } from "react";
import { appTheme, themeVars, type Theme } from "../theme.js";

/** 一個變體：上面是說明，下面是套 App 主題的 mock-up。 */
export interface V {
  cap: string;
  sub?: string;
  node: ReactNode;
  /** mock-up 的寬度；不給就用內容寬度。 */
  w?: number;
  /** 不加白紙外框的內距（例如本身就有外框的地圖片段）。 */
  bare?: boolean;
}

/** 同一元件的幾個狀態並排；說明與 mock-up 各自對齊。 */
export function Variants({ items, col }: { items: V[]; col?: string }) {
  const style: CSSProperties = { gridTemplateColumns: items.map((i) => col ?? (i.w ? `${i.w}px` : "max-content")).join(" ") };
  return (
    <div className="variants" style={style}>
      {items.map((i) => (
        <div key={i.cap} className="variant">
          <div className="cap">
            <strong>{i.cap}</strong>
            {i.sub}
          </div>
          <Themed theme={appTheme} className={i.bare ? "sheet" : "sheet pad"}>
            {i.node}
          </Themed>
        </div>
      ))}
    </div>
  );
}

/** 一整個畫面＋右側頁邊註解。 */
export function Screen({ children, notes }: { children: ReactNode; notes: ReactNode[] }) {
  return (
    <div className="screen-row">
      <div className="screen-frame">{children}</div>
      <div className="note">
        <ul>
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 設計稿頁面：標題、副標題、頁首註記。 */
export function Page({ title, subtitle, notes, children }: { title: string; subtitle: string; notes?: ReactNode[]; children: ReactNode }) {
  return (
    <div className="doc">
      <header className="doc-head">
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>
        {notes && (
          <ul>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </header>
      {children}
    </div>
  );
}

/** 一個邏輯單元：標題＋一行說明，與上一段以線分隔。 */
export function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="doc-section">
      <h2>{title}</h2>
      <p className="desc">{desc}</p>
      {children}
    </section>
  );
}

/** 套用某個主題的 UI 根元素：CSS 變數＋形狀開關。 */
export function Themed({ theme, className, style, children }: { theme: Theme; className?: string; style?: CSSProperties; children: ReactNode }) {
  const s = theme.shape;
  return (
    <div
      className={`ui ${className ?? ""}`}
      data-tabs={s.tabs}
      data-heading={s.heading}
      data-card={s.card}
      data-drawer={s.drawer}
      style={{ ...(themeVars(theme) as CSSProperties), ...style }}
    >
      {children}
    </div>
  );
}
