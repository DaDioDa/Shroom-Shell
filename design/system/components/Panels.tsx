import type { ReactNode } from "react";
import { verdict, type Verdict } from "../theme.js";
import { icons } from "./icons.js";
import { Button, IconButton, Input, SectionHead, Select, StatusBadge, STATUS_LABEL, Textarea, WaypointRow, FrameShot, type BatchStatus } from "./Ui.js";

/** 有清單的三個功能分頁。 */
export type ListFeature = "無人巨菇" | "美片菇" | "指定菇菇";

export interface Wp {
  name: string;
  meta: string;
  /** meta 是錯誤（例如缺 Spot Name）。 */
  bad?: boolean;
}

/** 欄位：上面標籤（＋右側補充說明），下面輸入，錯誤在最下面。 */
export function Field({ label, hint, req, err, children }: { label: string; hint?: string; req?: boolean; err?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="top">
        <span className="field-label">
          {label}
          {req && <span className="req">（必填）</span>}
        </span>
        {hint && <span className="muted">{hint}</span>}
      </div>
      {children}
      {err && <span className="err">{err}</span>}
    </div>
  );
}

/** 可收合的一列：標題、右邊數量，展開時下面接內容。 */
export function Disclosure({ label, count, open, children }: { label: string; count?: string; open?: boolean; children?: ReactNode }) {
  return (
    <div className={`disc ${open ? "open" : ""}`}>
      <div className="disc-head">
        <span>
          {label}
          {count && <span className="count">　{count}</span>}
        </span>
        {icons.chevron}
      </div>
      {open && <div className="disc-body">{children}</div>}
    </div>
  );
}

/** 小型分段切換（兩、三個選項擇一）。 */
export function Seg({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="seg">
      {items.map((i) => (
        <span key={i} className={i === active ? "on" : ""}>
          {i}
        </span>
      ))}
    </div>
  );
}

/** 答案統計：徽章＋數量，同時當作地圖顏色的圖例。 */
export function Tally({ counts, labels }: { counts: Record<Verdict, number>; labels?: Record<Verdict, string> }) {
  return (
    <div className="tally">
      {(Object.keys(verdict) as Verdict[]).map((v) => (
        <span key={v} className={`badge ${v}`}>
          {icons[verdict[v].icon]}
          {labels?.[v] ?? verdict[v].label}
          <span className="num">{counts[v]}</span>
        </span>
      ))}
    </div>
  );
}

export const CHECK_LABELS: Record<Verdict, string> = { yes: "找到", no: "沒找到", unknown: "沒讀完" };

/** Waypoint 表單：嵌在清單裡正在編輯的那一列下面；新增時接在清單最後。 */
export function WaypointForm({ feature, title, label, radius, spot, err }: { feature: ListFeature; title: string; label?: string; radius?: string; spot?: string; err?: { radius?: string; spot?: string; form?: string } }) {
  return (
    <div className="wpform">
      <div className="wpform-title">{title}</div>
      <Field label="標籤">
        <Input value={label} placeholder="可留空，地圖與清單會顯示座標" />
      </Field>
      {feature === "美片菇" ? (
        <Field label="Spot Name" req err={err?.spot}>
          <Input value={spot} placeholder="遊戲裡這個地點的名稱" state={err?.spot ? "invalid" : undefined} />
        </Field>
      ) : (
        <Field label="半徑" hint="公尺；留空＝用預設半徑" err={err?.radius}>
          <Input value={radius} placeholder="例如 300" state={err?.radius ? "invalid" : undefined} />
        </Field>
      )}
      {err?.form && <span className="err">{err.form}</span>}
      <div className="line">
        <Button kind="primary" size="small">儲存</Button>
        <Button size="small">取消</Button>
      </div>
    </div>
  );
}

const IMPORT_HINT: Record<ListFeature, string> = {
  美片菇: "每行都要有 @Spot Name（寫在行尾），不能帶半徑。",
  無人巨菇: "每行 lat,lng [r=半徑公尺] [標籤]，或 Google Maps 連結；不使用 Spot Name。",
  指定菇菇: "每行 lat,lng [r=半徑公尺] [標籤]，或 Google Maps 連結；不使用 Spot Name。",
};
const IMPORT_PLACEHOLDER: Record<ListFeature, string> = {
  美片菇: "25.033964,121.564468 台北 101 @生賀神社",
  無人巨菇: "25.033964,121.564468 r=300 台北 101",
  指定菇菇: "25.033964,121.564468 r=300 台北 101",
};

/** 從文字匯入：平常收合；匯入後無法解析的行留在文字框，錯誤列在下面。 */
export function ImportBox({ feature, list, state }: { feature: ListFeature; list: string; state: "closed" | "open" | "errors" }) {
  return (
    <Disclosure label={`從文字匯入到「${list}」`} open={state !== "closed"}>
      <p className="muted">{IMPORT_HINT[feature]}</p>
      {state === "errors" ? <Textarea value={"95.1,121.5 測試點\nhttps://maps.app.goo.gl/AbCd"} /> : <Textarea placeholder={IMPORT_PLACEHOLDER[feature]} />}
      {state === "errors" && (
        <div className="errbox">
          <p>有 2 行無法匯入（已留在文字框）：</p>
          <p>第 2 行：緯度需在 -90 到 90 之間</p>
          <p>第 5 行：短網址無法解析，請貼完整的 Google Maps 連結</p>
        </div>
      )}
      <div>
        <Button>匯入</Button>
      </div>
    </Disclosure>
  );
}

/**
 * 三個功能分頁共用的清單區塊。
 * list 為 null 表示還沒選清單。rows 收合時只顯示「Waypoint（N）」一列。
 * editIndex：那一列反白，form 接在它下面；editIndex 為 -1 表示新增，form 接在最後。
 */
export function ListSection({
  feature,
  list = "台北信義區",
  rows = [],
  mode,
  adding,
  collapsed,
  editIndex,
  form,
  importBox = "closed",
}: {
  feature: ListFeature;
  list?: string | null;
  rows?: Wp[];
  mode?: "renaming" | "deleting";
  adding?: boolean;
  collapsed?: boolean;
  editIndex?: number;
  form?: ReactNode;
  importBox?: "closed" | "open" | "errors";
}) {
  return (
    <div className="sec boxed">
      <SectionHead title={`${feature}清單`} en="WAYPOINT LIST" />
      {mode === "renaming" ? (
        <div className="line">
          <Input value={list ?? ""} state="focus" grow />
          <Button size="small" kind="primary">儲存</Button>
          <Button size="small">取消</Button>
        </div>
      ) : (
        <div className="line">
          <Select value={list ? `${list}（${rows.length}）` : "（未選清單）"} grow />
          {list && <Button size="small">改名</Button>}
          {list && (mode === "deleting" ? <Button size="small" kind="danger solid">確定刪除？</Button> : <Button size="small" kind="danger">刪除</Button>)}
        </div>
      )}
      <div className="line">
        <Input placeholder="新清單名稱" grow />
        <Button>建立</Button>
      </div>
      {list === null ? (
        <p className="muted">先選一份清單，或建立新的清單，才能加 Waypoint。</p>
      ) : (
        <>
          <Button icon="plus" state={adding ? "on" : undefined}>
            在地圖上新增
          </Button>
          {collapsed ? (
            <Disclosure label="Waypoint" count={`${rows.length} 個`} />
          ) : (
            <div className="wplist">
              {rows.map((w, i) => (
                <div key={w.name}>
                  <WaypointRow n={i + 1} name={w.name} meta={w.meta} bad={w.bad} first={i === 0} last={i === rows.length - 1} editing={editIndex === i} />
                  {editIndex === i && form}
                </div>
              ))}
              {editIndex === -1 && form}
            </div>
          )}
          <ImportBox feature={feature} list={list} state={importBox} />
        </>
      )}
    </div>
  );
}

/** 探索區域的格子統計；bad 時（Region 太大）整塊變紅並寫原因。 */
export function RegionStats({ bad }: { bad?: boolean }) {
  return bad ? (
    <div className="stats bad">
      <span className="big num">13 × 6 格 = 78 點</span>
      <span>Region：12.4 km × 6.0 km，格子 1000 × 1000 m</span>
      <span className="err">Region 最大 10 km × 10 km；目前是 12.4 km × 6.0 km，請縮小</span>
    </div>
  ) : (
    <div className="stats">
      <span className="big num">6 × 4 格 = 24 點</span>
      <span>Region：6.0 km × 4.0 km，格子 1000 × 1000 m</span>
      <span>預估 1 小時 12 分鐘（依過去 quiet 的平均耗時）</span>
      <span className="muted">無縫，重疊約 0%</span>
    </div>
  );
}

/**
 * 點探索區域的格子後浮出的卡片：答案與原因；綠格可以加入無人巨菇清單。
 * state：view 只看、pick 選清單、new 新建清單、added 已加入、dup 已在清單裡。
 */
export function CellPopover({ n, v, reason, state = "view", static: isStatic, at }: { n: number; v: Verdict; reason: string; state?: "view" | "pick" | "new" | "added" | "dup"; static?: boolean; at?: { left: number; top: number } }) {
  const d = verdict[v];
  return (
    <div className={`popover ${isStatic ? "static" : ""}`} style={at}>
      <div className="head">
        <span className="title">格 {n}</span>
        <span className={`badge ${v}`}>
          {icons[d.icon]}
          {d.label}
        </span>
        <span className="x">{icons.cross}</span>
      </div>
      <p>{reason}</p>
      <p className="muted">半徑 500 m</p>
      {v === "yes" && state === "view" && (
        <div>
          <Button size="small" icon="plus">加入無人巨菇清單</Button>
        </div>
      )}
      {(state === "pick" || state === "new") && (
        <>
          <Field label="加到哪份清單">
            <Select value={state === "new" ? "新建清單…" : "台北信義區（5）"} />
          </Field>
          {state === "new" && (
            <Field label="新清單名稱">
              <Input placeholder="新清單的名稱" state="focus" />
            </Field>
          )}
          <div className="line">
            <Button size="small" kind="primary">加入</Button>
            <Button size="small">取消</Button>
          </div>
        </>
      )}
      {state === "added" && <p className="ok">{icons.check}已加入「台北信義區」</p>}
      {state === "dup" && <p className="err">已在清單裡</p>}
    </div>
  );
}

/** 指定菇菇的 Target 標籤。 */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="chip">
      {children}
      <span className="x">{icons.cross}</span>
    </span>
  );
}

/** 輸入框下的建議清單（之前搜過的 Target）；hover 那項反白，打的字加粗。 */
export function Suggest({ typed, items, hover }: { typed: string; items: string[]; hover?: number }) {
  return (
    <div className="suggest">
      {items.map((s, i) => (
        <span key={s} className={i === hover ? "hover" : ""}>
          {s.split(typed).flatMap((part, k) => (k === 0 ? [part] : [<mark key={k}>{typed}</mark>, part]))}
        </span>
      ))}
    </div>
  );
}

/** 指定菇菇某個 Waypoint 失敗：原因＋abort 截圖。 */
export function FailureCard({ index, name, error }: { index: number; name: string; error: string }) {
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{index}</span>
        <span className="title">{name}</span>
        <span className="badge no">{icons.cross}失敗</span>
      </div>
      <p className="err">{error}</p>
      <div className="shots">
        <span className="shot">
          <FrameShot />
        </span>
      </div>
    </div>
  );
}

/** 歷史列表的一個 Batch。 */
export function HistoryCard({ id, feature, status, list, time, summary, cleared, deleting }: { id: number; feature: string; status: BatchStatus; list: string; time: string; summary: string; cleared?: boolean; deleting?: boolean }) {
  const busy = status === "running" || status === "queued";
  return (
    <div className="card">
      <div className="head">
        <span className="idx num">#{id}</span>
        <span className="title">{feature}</span>
        <StatusBadge kind={status}>{STATUS_LABEL[status]}</StatusBadge>
      </div>
      <p className="muted">
        {list}｜<span className="num">{time}</span>
      </p>
      <p>{summary}</p>
      {cleared && <p className="muted">圖片已清除</p>}
      <div className="line">
        <a className="grow link-more">查看結果{icons.arrow}</a>
        {deleting ? <Button size="small" kind="danger solid">確定刪除？</Button> : <IconButton icon="trash" label="刪除" state={busy ? "disabled" : undefined} />}
      </div>
    </div>
  );
}
