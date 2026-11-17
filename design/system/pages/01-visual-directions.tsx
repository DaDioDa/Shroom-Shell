import type { CSSProperties, ReactNode } from "react";
import { themes, verdict, type Theme } from "../theme.js";
import { AppScreen, LOG } from "../components/AppScreen.js";
import { Page, Section, Themed } from "../components/Doc.js";
import { BatchDrawer, Button, Checkbox, IconButton, Input, QuietResultCard, SectionHead, Select, SightingCard, Slider, Tabs, VerdictBadge, WaypointRow } from "../components/Ui.js";

export const title = "01 視覺方向";

const cols: CSSProperties = { gridTemplateColumns: `160px repeat(${themes.length}, minmax(0, 1fr))` };

/** 一列：左邊列名，右邊每個方向各一格。 */
function Row({ name, note, render }: { name: string; note?: string; render: (t: Theme) => ReactNode }) {
  return (
    <>
      <div className="rowhead">
        {name}
        {note && <span className="note">{note}</span>}
      </div>
      {themes.map((t) => (
        <Themed key={t.id} theme={t} className="sheet pad">
          {render(t)}
        </Themed>
      ))}
    </>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
      <span style={{ height: 34, borderRadius: 6, background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
      <span className="muted">{label}</span>
      <code style={{ fontSize: 10 }}>{color}</code>
    </div>
  );
}

export function Body() {
  return (
    <Page
      title={title}
      subtitle="三個方向並排比較。2026-11-17 選定 A；之後以 00 設計系統為準，這頁只留作決策紀錄。"
      notes={[
        "只畫桌機版：左地圖、右 340 px 面板、地圖底部的 Batch 抽屜，版面結構不變。",
        "地圖底圖是 OpenStreetMap 圖磚，顏色不隨主題變；主題只影響 App 自己畫的標記、方格與浮動控制。",
        "綠＝是、紅＝不是、灰＝無法判斷三個方向都一樣，並加上 ✓ ✕ ? 圖示，不只靠顏色。",
        "字體：中文 Noto Sans TC；A、C 的英數與標題用圓體 Nunito（Google Fonts）。",
      ]}
    >
      <Section title="元件比較" desc="同一組元件套三個方向；每一欄是一個方向，每一列是一種元件。">
        <div className="compare" style={cols}>
          <div />
          {themes.map((t) => (
            <div key={t.id} className="colhead">
              <h3>{t.name}</h3>
              <p className="note">{t.tagline}</p>
            </div>
          ))}

          <Row
            name="色票"
            render={(t) => (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                <Swatch color={t.color.primary} label="主色" />
                <Swatch color={t.color.primaryTint} label="主色淡" />
                <Swatch color={t.color.panelBg} label="面板底" />
                <Swatch color={t.color.ink} label="文字" />
                <Swatch color={t.color.accent} label="點綴" />
              </div>
            )}
          />
          <Row
            name="按鈕"
            note="一般／滑過／停用"
            render={() => (
              <div className="stack">
                <div className="line">
                  <Button kind="primary" icon="play">開始</Button>
                  <Button kind="primary" state="hover" icon="play">開始</Button>
                  <Button kind="primary" state="disabled" icon="play">開始</Button>
                </div>
                <div className="line">
                  <Button>建立</Button>
                  <Button state="hover">建立</Button>
                  <Button icon="plus" state="on">在地圖上新增</Button>
                </div>
                <div className="line">
                  <Button kind="danger" icon="stop">強制停止</Button>
                  <Button kind="danger solid">確定強制停止</Button>
                  <IconButton icon="edit" label="編輯" />
                  <IconButton icon="trash" label="刪除" />
                </div>
              </div>
            )}
          />
          <Row
            name="分頁"
            note="目前分頁／滑過"
            render={() => (
              <div style={{ margin: "0 -14px" }}>
                <Tabs active="無人巨菇" hover="美片菇" />
              </div>
            )}
          />
          <Row name="區塊標題" render={() => <SectionHead title="無人巨菇清單" en="WAYPOINT LIST" />} />
          <Row
            name="輸入"
            note="一般／聚焦／錯誤"
            render={() => (
              <div className="stack">
                <div className="line">
                  <Select value="台北信義區（5）" grow />
                  <Input placeholder="新清單名稱" grow />
                </div>
                <div className="line">
                  <Input value="象山親山步道" state="focus" grow />
                  <Input value="abc" state="invalid" grow />
                </div>
                <span className="err">半徑要是 1 以上的數字</span>
                <Checkbox checked label="間距跟半徑連動（間距 ＝ 2 × 半徑）" />
              </div>
            )}
          />
          <Row
            name="滑桿"
            note="一般／執行中鎖住"
            render={() => (
              <div className="stack">
                <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" />
                <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" disabled />
              </div>
            )}
          />
          <Row
            name="Waypoint 列"
            note="第 2 列是正在編輯"
            render={() => (
              <div className="wplist">
                <WaypointRow n={1} name="象山親山步道" meta="r=500 m" first />
                <WaypointRow n={2} name="信義廣場" meta="未設半徑，用預設" editing />
                <WaypointRow n={3} name="這是一個名字非常非常長、超出一行寬度的 Waypoint 標籤" meta="r=300 m" last />
              </div>
            )}
          />
          <Row
            name="答案"
            render={() => (
              <div className="line">
                {(Object.keys(verdict) as (keyof typeof verdict)[]).map((v) => (
                  <VerdictBadge key={v} v={v} />
                ))}
              </div>
            )}
          />
          <Row
            name="結果卡片"
            note="無人巨菇；第 1 張含 Sighting"
            render={() => (
              <div className="stack">
                <QuietResultCard index={1} name="象山親山步道" v="yes" radius={500} reason="範圍內有 1 顆巨大蘑菇，沒有人在打。">
                  <SightingCard target="巨大 輝煌蘑菇" spot="象山步道入口" participants="無人" expiry="尚未開始倒數" seen="3 分鐘前看到" />
                </QuietResultCard>
                <QuietResultCard index={3} name="四四南村" v="unknown" radius={300} reason="畫面沒讀完，無法判斷。" />
              </div>
            )}
          />
          <Row
            name="Batch 抽屜"
            note="按下強制停止後的確認"
            render={() => (
              <div style={{ margin: -14, padding: 14, background: "#E8E4DA" }}>
                <BatchDrawer state="forcing" log={LOG.slice(0, 2)} />
              </div>
            )}
          />
        </div>
      </Section>

      {themes.map((t) => (
        <Section key={t.id} title={`整體畫面：${t.name}`} desc="無人巨菇分頁，Batch 跑到第 3 個 Waypoint；1、2 已有結果，3～5 是 2R 預覽框。">
          <div className="screen-row">
            <div className="screen-frame">
              <AppScreen theme={t} />
            </div>
            <div className="note">
              <strong>這個方向的取捨</strong>
              <ul>{NOTES[t.id].map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          </div>
        </Section>
      ))}

      <Section title="三個方向共通的版面調整" desc="不論選哪個方向都會套用；有不同意的可以個別拿掉。">
        <div className="note">
          <ul>
            <li>「地圖顯示全部 Sighting」是地圖的設定，從面板移到地圖右上角。</li>
            <li>執行紀錄（stderr）原本在面板和底部抽屜各顯示一次，改成只在抽屜顯示；面板只放設定與結果卡片。</li>
            <li>抽屜的進度改成進度條＋「第 N / M 個 Waypoint」，原本的文字資訊不變。</li>
            <li>清單操作（選清單、建立、在地圖上新增）與 Waypoint 列表收在同一個區塊；Waypoint 的上移／下移／編輯／刪除改成圖示按鈕。</li>
            <li>地圖上的 Waypoint 標記改成帶編號的主題色水滴，與面板列表的編號對應。</li>
          </ul>
        </div>
      </Section>
    </Page>
  );
}

const NOTES: Record<Theme["id"], string[]> = {
  a: [
    "最像 Pikmin Bloom：奶油色面板、白色圓角卡片、膠囊分頁與按鈕。",
    "按鈕下緣的深綠「壓下去」邊取自官網的「詳細資訊」按鈕。",
    "圓角與留白多，面板一屏放得下的內容最少。",
  ],
  b: [
    "最像任天堂官網：白底、紅色頂條、置中標題下面英文小字與紅色短線。",
    "紅色主色和「不是」的紅色撞色，地圖標記只好改用深灰；看結果時比較容易混淆。",
    "置中雙語標題在 340 px 的窄面板裡佔掉不少高度。",
  ],
  c: [
    "主色用 Pikmin 綠，版面借任天堂：底線分頁、左對齊的英文小標、細線分隔。",
    "紅色只出現在「不是」與危險操作，語意最清楚。",
    "白底比奶油色更中性，長時間看結果卡片不累；圓體只用在標題與數字。",
  ],
};
