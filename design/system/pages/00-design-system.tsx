import type { CSSProperties, ReactNode } from "react";
import { appTheme as t, preview, verdict } from "../theme.js";
import { LOG } from "../components/AppScreen.js";
import { Page, Section, Themed, Variants } from "../components/Doc.js";
import { CheckPin, EditBox, HistoryDot, MapPin, MapSnippet, PendingPin, RegionGrid, SightingPin, SweepSquare } from "../components/MapMock.js";
import { icons } from "../components/icons.js";
import { CHECK_LABELS, CellPopover, Chip, Disclosure, FailureCard, Field, HistoryCard, RegionStats, Seg, Suggest, Tally, WaypointForm } from "../components/Panels.js";
import { BatchDrawer, Button, CheckResultCard, Checkbox, IconButton, Input, Log, QuietResultCard, SectionHead, Select, SightingCard, Slider, StatusBadge, STATUS_LABEL, Tabs, Textarea, VerdictBadge, WaypointRow } from "../components/Ui.js";

export const title = "00 設計系統";

const COLOR_USE: Record<keyof typeof t.color, string> = {
  panelBg: "右側面板底色",
  surface: "卡片、輸入框、浮動控制",
  ink: "主要文字",
  muted: "次要說明、圖示按鈕",
  border: "細線、卡片外框",
  borderStrong: "輸入框外框、次要按鈕外框",
  primary: "主要按鈕、目前分頁、滑桿、核取方塊",
  primaryHover: "主要按鈕滑過",
  onPrimary: "主色上的文字",
  primaryEdge: "主要按鈕下緣「壓下去」的邊",
  primaryTint: "分頁列底、開啟中的按鈕、編輯中的列",
  primaryInk: "標題、連結等主色文字",
  accent: "只當裝飾（標誌花心）",
  marker: "地圖 Waypoint 標記",
  focus: "輸入框聚焦外框",
  focusRing: "輸入框聚焦光暈",
  danger: "危險按鈕、錯誤文字",
  dangerTint: "強制停止的警告框",
  disabledBg: "停用按鈕、鎖住的數字框",
  disabledInk: "停用文字、placeholder",
  logBg: "執行紀錄底色",
  logInk: "執行紀錄文字",
};

function Token({ color, name, use }: { color: string; name: string; use: string }) {
  return (
    <div className="token">
      <span className="chip" style={{ background: color }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 12 }}>{name}</div>
        <code>{color}</code>
        <div className="use">{use}</div>
      </div>
    </div>
  );
}

const lorem = "範圍內有 1 顆巨大蘑菇，沒有人在打。";

export function Body() {
  return (
    <Page
      title={title}
      subtitle="App 的主題與共用元件：方向 A「花園」。各分頁的設計稿與 web/ 的程式都照這頁的元件與數值。"
      notes={["主題值只定義在 design/system/theme.ts；這頁的每個色塊、圓角、字級都從那裡讀。", "同一組變體形狀相同，只差顏色或填色；狀態一律並排畫，不做互動。"]}
    >
      <Section title="顏色" desc="App 介面色。文字色對底色都達 WCAG AA（4.5:1）以上；accent 只當裝飾。">
        <div className="tokens">
          {(Object.keys(t.color) as (keyof typeof t.color)[]).map((k) => (
            <Token key={k} color={t.color[k]} name={k} use={COLOR_USE[k]} />
          ))}
        </div>
      </Section>

      <Section title="答案色" desc="地圖方格與卡片徽章共用；一定和圖示、文字一起出現，不單靠顏色。">
        <div className="tokens">
          {(Object.keys(verdict) as (keyof typeof verdict)[]).flatMap((k) => [
            <Token key={`${k}f`} color={verdict[k].fill} name={`${verdict[k].label}：fill`} use="地圖方格邊線與填色（22% 透明）" />,
            <Token key={`${k}t`} color={verdict[k].tint} name={`${verdict[k].label}：tint`} use="徽章底色" />,
            <Token key={`${k}i`} color={verdict[k].ink} name={`${verdict[k].label}：ink`} use="徽章文字" />,
          ])}
          <Token color={preview.stroke} name="2R 預覽" use="還沒有結果的範圍：藍色虛線框" />
        </div>
      </Section>

      <Section title="字體與字級" desc="中文 Noto Sans TC；英數、數字、品牌字用圓體 Nunito。">
        <Themed theme={t} className="sheet pad" style={{ maxWidth: 900 }}>
          {[
            ["品牌", "Nunito 800 / 16", <span className="brand" style={{ padding: 0 }}><span className="name">Pikmin Bloom <em>Shell</em></span></span>],
            ["區塊標題", "700 / 15，主色文字＋葉子", <SectionHead title="無人巨菇清單" en="" />],
            ["內文", "400 / 14", <p>每個 Waypoint 跑一次 quiet，R 用 Waypoint 自己的半徑。</p>],
            ["卡片標題", "700 / 13", <p style={{ fontWeight: 700, fontSize: 13 }}>象山親山步道</p>],
            ["次要說明", "400 / 12，muted", <p className="muted">未設半徑，用預設</p>],
            ["數字", "Nunito tabular", <p className="num" style={{ fontWeight: 800, fontSize: 22 }}>12 × 8 格 = 96 點</p>],
            ["執行紀錄", "等寬 11", <Log lines={["[quiet] teleport 25.0273,121.5707"]} />],
          ].map(([name, spec, node]) => (
            <div key={name as string} className="type-row" style={{ borderColor: t.color.border }}>
              <div>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div className="muted">{spec}</div>
              </div>
              <div>{node}</div>
            </div>
          ))}
        </Themed>
      </Section>

      <Section title="形狀" desc="圓角與按鈕下緣的「壓下去」邊。">
        <Variants
          items={[
            { cap: "輸入框", sub: t.radius.control, node: <Input placeholder="新清單名稱" />, w: 200 },
            { cap: "按鈕、徽章、分頁", sub: "膠囊", node: <Button kind="primary">開始</Button>, w: 200 },
            { cap: "卡片、區塊", sub: t.radius.card, node: <div className="card">卡片</div>, w: 200 },
            { cap: "Batch 抽屜", sub: t.radius.drawer, node: <div className="drawer" data-drawer="floating">抽屜</div>, w: 200 },
            { cap: "主要按鈕下緣", sub: `0 3px 0 ${t.color.primaryEdge}`, node: <Button kind="primary" icon="play">開始</Button>, w: 200 },
          ]}
        />
      </Section>

      <Section title="按鈕" desc="主要按鈕一個區塊最多一個；其他動作用次要按鈕，列內動作用圖示按鈕。">
        <Variants
          items={[
            { cap: "主要", sub: "一般", node: <Button kind="primary" icon="play">開始</Button> },
            { cap: "主要", sub: "滑過", node: <Button kind="primary" state="hover" icon="play">開始</Button> },
            { cap: "主要", sub: "停用／執行中", node: <Button kind="primary" state="disabled" icon="play">開始</Button> },
            { cap: "主要．滿版", sub: "區塊底部的開始", node: <Button kind="primary" size="block" icon="play">開始</Button>, w: 300 },
          ]}
        />
        <Variants
          items={[
            { cap: "次要", sub: "一般", node: <Button>建立</Button> },
            { cap: "次要", sub: "滑過", node: <Button state="hover">建立</Button> },
            { cap: "次要", sub: "停用", node: <Button state="disabled">建立</Button> },
            { cap: "切換", sub: "關", node: <Button icon="plus">在地圖上新增</Button> },
            { cap: "切換", sub: "開（aria-pressed）", node: <Button icon="plus" state="on">在地圖上新增</Button> },
            { cap: "小尺寸", sub: "列內、抽屜", node: <Button size="small">改名</Button> },
          ]}
        />
        <Variants
          items={[
            { cap: "危險", sub: "外框：第一次按", node: <Button kind="danger" icon="stop">強制停止</Button> },
            { cap: "危險", sub: "實心：確認", node: <Button kind="danger solid">確定強制停止</Button> },
            { cap: "圖示", sub: "一般", node: <IconButton icon="edit" label="編輯" /> },
            { cap: "圖示", sub: "停用（第一列不能上移）", node: <IconButton icon="up" label="上移" state="disabled" /> },
            { cap: "圖示", sub: "刪除", node: <IconButton icon="trash" label="刪除" /> },
          ]}
        />
      </Section>

      <Section title="分頁" desc="面板頂端，五個功能分頁固定順序。">
        <Variants
          col="340px"
          items={[
            { cap: "目前在無人巨菇", node: <div style={{ margin: "0 -14px" }}><Tabs active="無人巨菇" /></div> },
            { cap: "目前在歷史，滑過美片菇", node: <div style={{ margin: "0 -14px" }}><Tabs active="歷史" hover="美片菇" /></div> },
          ]}
        />
      </Section>

      <Section title="面板區塊" desc="面板內容分成白色圓角區塊，標題前加葉子；區塊之間 10 px。">
        <Variants
          col="340px"
          items={[
            {
              cap: "區塊",
              bare: true,
              node: (
                <div style={{ padding: "10px 0" }}>
                  <div className="sec boxed">
                    <SectionHead title="無人巨菇" en="" />
                    <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" />
                    <Button kind="primary" size="block" icon="play">開始</Button>
                  </div>
                </div>
              ),
            },
            {
              cap: "空狀態",
              sub: "還沒選清單",
              bare: true,
              node: (
                <div style={{ padding: "10px 0" }}>
                  <div className="sec boxed">
                    <SectionHead title="無人巨菇清單" en="" />
                    <Select value="（未選清單）" />
                    <p className="muted">請先選擇或建立清單</p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Section>

      <Section title="表單" desc="欄位名稱在上、錯誤訊息在欄位下方；錯誤用紅框＋文字。">
        <Variants
          col="220px"
          items={[
            { cap: "下拉選單", node: <Select value="台北信義區（5）" /> },
            { cap: "輸入框", sub: "placeholder", node: <Input placeholder="新清單名稱" /> },
            { cap: "輸入框", sub: "聚焦", node: <Input value="象山親山步道" state="focus" /> },
            { cap: "輸入框", sub: "錯誤", node: <div className="stack"><Input value="abc" state="invalid" /><span className="err">半徑要是 1 以上的數字</span></div> },
            { cap: "多行輸入", sub: "匯入文字", node: <Textarea placeholder={"每行 lat,lng [r=半徑公尺] [標籤]\n25.033964,121.564468 r=300 台北 101"} /> },
          ]}
        />
        <Variants
          col="300px"
          items={[
            { cap: "核取方塊", sub: "關／開", node: <div className="stack"><Checkbox label="顯示全部 Sighting（含已過期）" /><Checkbox checked label="間距跟半徑連動（間距 ＝ 2 × 半徑）" /></div> },
            { cap: "滑桿", sub: "一般", node: <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" /> },
            { cap: "滑桿", sub: "執行中鎖住", node: <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" disabled /> },
            { cap: "滑桿", sub: "數值附說明", node: <Slider label="間距" value={1000} min={200} max={3000} unit="m" note="連動中 1000 m" disabled /> },
          ]}
        />
      </Section>

      <Section title="徽章" desc="答案徽章＝圖示＋文字＋顏色；狀態徽章只出現在 Batch 抽屜。">
        <Variants
          items={[
            { cap: "是", node: <VerdictBadge v="yes" /> },
            { cap: "不是", node: <VerdictBadge v="no" /> },
            { cap: "無法判斷", node: <VerdictBadge v="unknown" /> },
            { cap: "執行中", node: <StatusBadge kind="running">執行中</StatusBadge> },
            { cap: "排隊", node: <StatusBadge kind="queued">排隊 1</StatusBadge> },
          ]}
        />
      </Section>

      <Section title="Waypoint 列" desc="編號與地圖標記一致；名稱過長截斷，meta 一行。">
        <Variants
          col="312px"
          items={[
            { cap: "第一列", sub: "不能上移", node: <WaypointRow n={1} name="象山親山步道" meta="r=500 m" first /> },
            { cap: "編輯中", sub: "下方開著表單", node: <WaypointRow n={2} name="信義廣場" meta="未設半徑，用預設" editing /> },
            { cap: "美片菇", sub: "meta 是 Spot Name", node: <WaypointRow n={3} name="台北 101" meta="〔生賀神社〕" last /> },
            { cap: "名稱過長", node: <WaypointRow n={12} name="這是一個名字非常非常長、超出一行寬度的 Waypoint 標籤" meta="r=300 m" /> },
          ]}
        />
      </Section>

      <Section title="結果卡片：無人巨菇" desc="右上角是答案；含 Sighting 時把 Sighting 卡片放在裡面。">
        <Variants
          col="312px"
          items={[
            {
              cap: "是",
              sub: "有巨大蘑菇的 Sighting",
              node: (
                <QuietResultCard index={1} name="象山親山步道" v="yes" radius={500} reason={lorem}>
                  <SightingCard target="巨大 輝煌蘑菇" spot="象山步道入口" participants="無人" expiry="尚未開始倒數" seen="3 分鐘前看到" />
                </QuietResultCard>
              ),
            },
            { cap: "不是", sub: "有人在打", node: <QuietResultCard index={2} name="信義廣場" v="no" radius={500} reason="有人在打：第 2 格，3 人。" /> },
            {
              cap: "無法判斷",
              sub: "有沒讀到名稱的蘑菇",
              node: (
                <QuietResultCard index={3} name="四四南村" v="unknown" radius={300} reason="畫面沒讀完，無法判斷。">
                  <p className="muted">另有 2 顆沒讀到名稱</p>
                </QuietResultCard>
              ),
            },
          ]}
        />
      </Section>

      <Section title="結果卡片：美片菇" desc="找到／沒找到／沒讀完；找到時附起點畫面與 Postcard。">
        <Variants
          col="312px"
          items={[
            {
              cap: "找到",
              node: (
                <CheckResultCard index={1} name="台北 101" kind="found">
                  <p>巨大 紅色蘑菇｜3 人｜到期 2026-11-17 18:42</p>
                </CheckResultCard>
              ),
            },
            {
              cap: "沒找到",
              node: (
                <CheckResultCard index={2} name="國父紀念館" kind="missing">
                  <p>起點畫面上沒有這個 Spot Name</p>
                  <p className="muted">可能有 1 顆沒讀到</p>
                </CheckResultCard>
              ),
            },
            {
              cap: "沒讀完",
              node: (
                <CheckResultCard index={3} name="松山文創園區" kind="unfinished">
                  <p>遊戲沒有在 60 秒內進到地圖畫面</p>
                  <p>已讀到：巨大 紅色蘑菇</p>
                </CheckResultCard>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Sighting 卡片" desc="指定菇菇的主要結果；也放在無人巨菇與歷史的卡片裡。">
        <Variants
          col="312px"
          items={[
            { cap: "倒數中", node: <SightingCard target="巨大 輝煌蘑菇" spot="信義廣場噴水池" participants="3 人" expiry="到期 2026-11-17 18:42" /> },
            { cap: "尚未開始倒數", node: <SightingCard target="巨大 紅色蘑菇" spot="四四南村" participants="無人" expiry="尚未開始倒數" seen="3 分鐘前看到" /> },
            { cap: "沒有 Postcard", node: <SightingCard target="巨大 藍色蘑菇" spot="松山文創園區" participants="人數不明" expiry="到期 2026-11-17 19:05" postcard={false} /> },
          ]}
        />
        <Variants
          col="312px"
          items={[
            { cap: "已過期", sub: "整張變淡", node: <SightingCard target="巨大 黃色蘑菇" spot="國父紀念館" participants="2 人" expiry="已到期（2026-11-17 12:10）" expired /> },
            { cap: "圖片已清除", sub: "超過 run 資料夾上限", node: <SightingCard target="巨大 白色蘑菇" spot="象山步道入口" participants="無人" expiry="已到期（2026-11-10 09:00）" expired cleared /> },
          ]}
        />
      </Section>

      <Section title="地圖圖層" desc="底圖是 OpenStreetMap；以下是 App 自己畫在上面的東西。">
        <Variants
          items={[
            { cap: "Waypoint 標記", sub: "主題色水滴＋編號", bare: true, node: <MapSnippet><MapPin x={110} y={95} n={3} /></MapSnippet> },
            { cap: "2R 結果：是", bare: true, node: <MapSnippet><SweepSquare x={110} y={85} half={60} result="yes" /><MapPin x={110} y={85} n={1} /></MapSnippet> },
            { cap: "2R 結果：不是", bare: true, node: <MapSnippet><SweepSquare x={110} y={85} half={60} result="no" /><MapPin x={110} y={85} n={2} /></MapSnippet> },
            { cap: "2R 結果：無法判斷", bare: true, node: <MapSnippet><SweepSquare x={110} y={85} half={60} result="unknown" /><MapPin x={110} y={85} n={3} /></MapSnippet> },
            { cap: "2R 預覽", sub: "還沒有結果、拉半徑時", bare: true, node: <MapSnippet><SweepSquare x={110} y={85} half={60} /><MapPin x={110} y={85} n={4} /></MapSnippet> },
          ]}
        />
        <Variants
          items={[
            { cap: "Sighting", bare: true, node: <MapSnippet w={260}><SightingPin x={40} y={85} label="巨大 輝煌蘑菇" /></MapSnippet> },
            { cap: "Sighting：已過期", sub: "勾「顯示全部」才出現", bare: true, node: <MapSnippet w={260}><SightingPin x={40} y={85} label="巨大 黃色蘑菇" expired /></MapSnippet> },
            { cap: "縮放", node: <div className="map-ctl zoom static" style={{ display: "inline-flex" }}><span>+</span><span>−</span></div> },
            {
              cap: "座標搜尋",
              node: (
                <div className="map-ctl search static">
                  <span className="ph">輸入座標，例如 -15.5885, -67.2519</span>
                  <span className="go">{icons.search}</span>
                </div>
              ),
            },
            { cap: "顯示全部 Sighting", sub: "地圖右上角", node: <div className="map-ctl map-toggle static"><Checkbox label="顯示全部 Sighting（含已過期）" /></div> },
          ]}
        />
        <Variants
          items={[
            { cap: "可編輯的 2R 框", sub: "無人巨菇新增模式；四角是把手", bare: true, node: <MapSnippet><EditBox x={110} y={85} half={56} /><MapPin x={110} y={85} n={2} /></MapSnippet> },
            { cap: "還沒存的新點", sub: "美片菇新增；虛線水滴，可拖", bare: true, node: <MapSnippet><PendingPin x={110} y={100} /></MapSnippet> },
            {
              cap: "美片菇結果",
              sub: "水滴右上角的答案圓章",
              bare: true,
              node: (
                <MapSnippet>
                  <CheckPin x={50} y={110} n={1} v="yes" />
                  <CheckPin x={110} y={110} n={2} v="no" />
                  <CheckPin x={170} y={110} n={3} v="unknown" />
                </MapSnippet>
              ),
            },
            { cap: "歷史走過的點", sub: "深色空心圓＋標籤", bare: true, node: <MapSnippet><HistoryDot x={50} y={85} label="象山親山步道" /></MapSnippet> },
          ]}
        />
        <Variants
          items={[
            { cap: "Region：編輯中", sub: "主色外框＋8 個把手；藍點是每格中心", bare: true, node: <MapSnippet w={300} h={220}><RegionGrid x={30} y={40} cols={5} rows={3} cell={46} editing /></MapSnippet> },
            { cap: "Region：太大", sub: "外框與把手變紅", bare: true, node: <MapSnippet w={300} h={220}><RegionGrid x={30} y={40} cols={5} rows={3} cell={46} editing bad /></MapSnippet> },
            {
              cap: "Region：結果",
              sub: "每格填答案色；點過的格子加深色框",
              bare: true,
              node: (
                <MapSnippet w={300} h={220}>
                  <RegionGrid x={30} y={40} cols={5} rows={3} cell={46} results={["no", "yes", "no", "unknown", "no", "no", "no", "yes", "no", "no", "unknown", "no", "no", "yes", "no"]} selected={7} />
                </MapSnippet>
              ),
            },
            {
              cap: "操作提示",
              sub: "地圖上方中央，深色膠囊",
              node: (
                <div className="map-hint static">
                  {icons.plus}點地圖加入「台北信義區」；拖框可移動，拖四角可改半徑
                </div>
              ),
            },
          ]}
        />
      </Section>

      <Section title="格子浮動卡" desc="點探索區域的格子後，在格子旁邊浮出；綠格可以加入無人巨菇清單。">
        <Variants
          col="294px"
          items={[
            { cap: "是", sub: "可以加入清單", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" /> },
            { cap: "不是", sub: "只看原因", node: <CellPopover static n={3} v="no" reason="有人在打：第 2 格，3 人。" /> },
            { cap: "選清單", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="pick" /> },
            { cap: "已加入", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="added" /> },
          ]}
        />
      </Section>

      <Section title="面板的其他元件" desc="各分頁共用的小元件。">
        <Variants
          col="312px"
          items={[
            {
              cap: "欄位",
              sub: "標籤＋補充說明／必填／錯誤",
              node: (
                <div className="stack">
                  <Field label="半徑" hint="公尺；留空＝用預設半徑">
                    <Input placeholder="例如 300" />
                  </Field>
                  <Field label="Spot Name" req err="美片菇需要 Spot Name">
                    <Input placeholder="遊戲裡這個地點的名稱" state="invalid" />
                  </Field>
                </div>
              ),
            },
            {
              cap: "收合列",
              sub: "收合／展開",
              node: (
                <div className="stack">
                  <Disclosure label="Waypoint" count="5 個" />
                  <Disclosure label="從文字匯入到「台北信義區」" open>
                    <p className="muted">每行 lat,lng [r=半徑公尺] [標籤]，或 Google Maps 連結。</p>
                  </Disclosure>
                </div>
              ),
            },
            {
              cap: "分段切換與確認",
              sub: "確認不危險時用主色",
              node: (
                <div className="stack">
                  <Seg items={["編輯 Region", "上次結果"]} active="編輯 Region" />
                  <div className="warn ask">
                    這會跑 48 個點，預估 2 小時 24 分鐘。確定要開始？
                    <span className="line">
                      <Button size="small" kind="primary">確定開始</Button>
                      <Button size="small">取消</Button>
                    </span>
                  </div>
                </div>
              ),
            },
            {
              cap: "Waypoint 表單",
              sub: "嵌在清單的那一列下面",
              node: <WaypointForm feature="無人巨菇" title="編輯 Waypoint" label="信義廣場" />,
            },
          ]}
        />
        <Variants
          col="312px"
          items={[
            {
              cap: "答案統計",
              sub: "也是地圖顏色的圖例",
              node: (
                <div className="stack">
                  <Tally counts={{ yes: 5, no: 14, unknown: 5 }} />
                  <Tally counts={{ yes: 1, no: 1, unknown: 0 }} labels={CHECK_LABELS} />
                </div>
              ),
            },
            {
              cap: "Target",
              sub: "可刪的膠囊＋之前搜過的建議",
              node: (
                <div className="stack">
                  <div className="chips">
                    <Chip>巨大 輝煌蘑菇</Chip>
                    <Chip>巨大 紅色蘑菇</Chip>
                  </div>
                  <Input value="輝煌" state="focus" />
                  <Suggest typed="輝煌" items={["巨大 輝煌蘑菇", "一般 輝煌蘑菇"]} hover={0} />
                </div>
              ),
            },
            { cap: "Region 統計", node: <RegionStats /> },
            { cap: "Region 統計：太大", node: <RegionStats bad /> },
          ]}
        />
        <Variants
          col="312px"
          items={[
            { cap: "Batch 狀態", sub: "歷史卡片右上角", node: <div className="line">{(["done", "running", "queued", "cancelled", "failed"] as const).map((k) => <StatusBadge key={k} kind={k}>{STATUS_LABEL[k]}</StatusBadge>)}</div> },
            { cap: "歷史卡片", node: <HistoryCard id={42} feature="無人巨菇" status="cancelled" list="台北信義區" time="11/17 14:30 → 14:52" summary="3 個 Waypoint：是 2、不是 1、無法判斷 0" /> },
            { cap: "失敗的 Waypoint", sub: "指定菇菇；附 abort 截圖", node: <FailureCard index={3} name="四四南村" error="遊戲沒有在 60 秒內進到地圖畫面" /> },
          ]}
        />
      </Section>

      <Section title="Batch 抽屜" desc="浮在地圖底部；有在跑的 Batch 就顯示它，否則顯示目前分頁 Batch 的結束狀態。執行紀錄只在這裡顯示。">
        <Variants
          col="600px"
          items={[
            { cap: "執行中", sub: "後面還有一個排隊", node: <BatchDrawer log={LOG} /> },
            { cap: "按下強制停止", sub: "警告與確認都在抽屜內", node: <BatchDrawer state="forcing" queue={false} /> },
          ]}
        />
        <Variants
          col="600px"
          items={[
            { cap: "完成", node: <BatchDrawer state="done" log={LOG.slice(0, 2)} queue={false} /> },
            { cap: "失敗", node: <BatchDrawer state="failed" log={LOG.slice(0, 1)} queue={false} /> },
          ]}
        />
      </Section>
    </Page>
  );
}
