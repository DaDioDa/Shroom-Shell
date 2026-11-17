import type { ReactNode } from "react";
import type { Verdict } from "../theme.js";
import { AppFrame, LOG, WAYPOINTS } from "../components/AppScreen.js";
import { Page, Screen, Section, Variants } from "../components/Doc.js";
import { CheckPin, EditBox, HistoryDot, MapPin, MapSnippet, PendingPin, RegionGrid, SightingPin, SweepSquare } from "../components/MapMock.js";
import { icons } from "../components/icons.js";
import { CHECK_LABELS, CellPopover, Chip, Field, FailureCard, HistoryCard, ListSection, RegionStats, Seg, Suggest, Tally, WaypointForm, type Wp } from "../components/Panels.js";
import { BatchDrawer, Button, CheckResultCard, Checkbox, Input, QuietResultCard, SectionHead, Select, SightingCard, Slider } from "../components/Ui.js";

export const title = "02 各分頁畫面";

/* ---------- 共用資料 ---------- */

const PTS = [
  { x: 250, y: 330 },
  { x: 440, y: 250 },
  { x: 590, y: 420 },
  { x: 730, y: 290 },
  { x: 380, y: 520 },
];
/** WAYPOINTS 的半徑換成地圖上的半邊長（預設 500 m）。 */
const HALF = [72, 72, 43, 72, 115];

const POSTCARD_ROWS: Wp[] = [
  { name: "台北 101", meta: "@生賀神社" },
  { name: "國父紀念館", meta: "@國父紀念館正門" },
  { name: "松山文創園區", meta: "@松菸製菸工廠" },
  { name: "四四南村", meta: "@信義公民會館" },
  { name: "象山親山步道", meta: "@象山步道登山口" },
];

/** 探索區域 6 × 4 格的答案。 */
const GRID: Verdict[] = ["no", "no", "yes", "no", "unknown", "no", "no", "unknown", "no", "yes", "no", "no", "yes", "no", "no", "no", "yes", "no", "unknown", "no", "no", "yes", "no", "unknown"];
const REGION = { x: 230, y: 150, cols: 6, rows: 4 };

/* ---------- 面板的功能區塊 ---------- */

function QuietSettings({ running }: { running?: boolean }) {
  return (
    <div className="sec boxed">
      <SectionHead title="無人巨菇" en="QUIET GIANT SEARCH" />
      <Slider label="預設半徑" note="沒設半徑的 Waypoint 用這個" value={500} min={100} max={2000} unit="m" disabled={running} />
      <Button kind="primary" size="block" icon="play" state={running ? "disabled" : undefined}>
        開始
      </Button>
    </div>
  );
}

function Results({ children }: { children: ReactNode }) {
  return (
    <div className="sec boxed">
      <SectionHead title="結果" en="RESULTS" />
      {children}
    </div>
  );
}

function DiscoveryEdit({ state }: { state?: "confirm" | "bad" | "locked" }) {
  const locked = state === "locked";
  return (
    <div className="sec boxed">
      <SectionHead title="探索區域" en="DISCOVERY" />
      <p className="muted">放一個 Region（最大 10 km × 10 km），每格跑一次無人巨菇。</p>
      <div className="line">
        <Button icon="map" state={locked ? "disabled" : undefined}>
          移到地圖中央
        </Button>
      </div>
      <Slider label="半徑" value={500} min={100} max={2000} unit="m" disabled={locked} />
      <Checkbox checked label="間距跟半徑連動（間距 ＝ 2 × 半徑，剛好無縫）" />
      <Slider label="間距" value={1000} min={200} max={3000} disabled valueText="連動中 1000 m" />
      <Field label="Region 名稱">
        <Input placeholder="留空會自動命名（探索 日期 時間）" />
      </Field>
      <RegionStats bad={state === "bad"} />
      {state === "confirm" ? (
        <div className="warn ask">
          這會跑 48 個點，預估 2 小時 24 分鐘。確定要開始？
          <span className="line">
            <Button size="small" kind="primary">確定開始</Button>
            <Button size="small">取消</Button>
          </span>
        </div>
      ) : (
        <Button kind="primary" size="block" icon="play" state={state ? "disabled" : undefined}>
          開始
        </Button>
      )}
      {locked && <p className="muted">執行中，Region 已鎖住；要改請先停止 Batch。</p>}
    </div>
  );
}

function TargetSettings({ chips = ["巨大 輝煌蘑菇", "巨大 紅色蘑菇"], typing, running }: { chips?: string[]; typing?: boolean; running?: boolean }) {
  const empty = chips.length === 0 && !typing;
  return (
    <div className="sec boxed">
      <SectionHead title="指定菇菇" en="TARGET SEARCH" />
      <Field label="Target" hint="可以放好幾個">
        {chips.length > 0 && (
          <div className="chips">
            {chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        )}
        <div className="line">
          <Input value={typing ? "輝煌" : undefined} placeholder="輸入名稱後按 Enter" state={typing ? "focus" : undefined} grow />
          <Button icon="plus">巨菇</Button>
        </div>
      </Field>
      {typing && <Suggest typed="輝煌" items={["巨大 輝煌蘑菇", "一般 輝煌蘑菇"]} hover={0} />}
      <Slider label="預設半徑" value={500} min={100} max={2000} unit="m" disabled={running} />
      <Slider label="--skip-crowded" value={0} min={0} max={10} valueText="不略過" disabled={running} />
      <Button kind="primary" size="block" icon="play" state={empty || running ? "disabled" : undefined}>
        開始
      </Button>
      {empty && <p className="muted">至少要有一個 Target 才能開始。</p>}
    </div>
  );
}

function HistoryList({ deleting }: { deleting?: boolean }) {
  return (
    <div className="sec boxed">
      <SectionHead title="歷史" en="HISTORY" />
      <div className="line">
        <span className="field-label">功能</span>
        <Select value="全部" grow />
      </div>
      <HistoryCard id={44} feature="指定菇菇" status="done" list="台北信義區" time="11/17 15:20 → 15:41" summary="5 個 Waypoint，找到 3 筆 Sighting" deleting={deleting} />
      <HistoryCard id={43} feature="美片菇" status="running" list="每日巡邏" time="11/17 15:05 → —" summary="3 / 5 個 Waypoint" />
      <HistoryCard id={42} feature="無人巨菇" status="cancelled" list="台北信義區" time="11/17 14:30 → 14:52" summary="3 個 Waypoint：是 2、不是 1、無法判斷 0" />
      <HistoryCard id={41} feature="探索區域" status="done" list="探索 2026-11-17 13:05" time="11/17 13:05 → 14:17" summary="24 個格子：是 5、不是 14、無法判斷 5" cleared />
    </div>
  );
}

/* ---------- 頁面 ---------- */

export function Body() {
  return (
    <Page
      title={title}
      subtitle="五個分頁的整體畫面，元件全部取自 00 設計系統。每個分頁先畫最常見的畫面，再把面板裡的其他狀態並排在下面。"
      notes={[
        "面板比 800 px 長時可以捲動；畫面底部的淡出表示下面還有內容。",
        "清單區塊在無人巨菇、美片菇、指定菇菇三個分頁長得一樣，狀態只在第一節畫一次。",
        "地圖右上角的「顯示全部 Sighting」只在美片菇分頁拿掉（美片菇不畫 Sighting）；其他四個分頁都有。",
        "地圖上的操作說明（新增模式、拖 Region）改成地圖上方的深色提示，不寫在面板裡。",
        "Waypoint 水滴只寫編號，名稱滑過才顯示（對照面板清單的編號）；原本是常駐標籤。",
        "歷史分頁沒有自己的 Batch：沒有 Batch 在跑或排隊時，不顯示底部抽屜。",
      ]}
    >
      {/* ---------------- 無人巨菇 ---------------- */}
      <Section title="無人巨菇：新增與編輯 Waypoint" desc="按下「在地圖上新增」後，點地圖加點；每個 Waypoint 的 2R 框可以拖移、拖四角改半徑（指定菇菇相同）。第 2 個正在編輯。">
        <Screen
          notes={[
            "新增模式時，「在地圖上新增」按鈕維持開啟的樣子；地圖上方出現操作提示。",
            "每個框依 Waypoint 自己的半徑畫（第 3 個 300 m、第 5 個 800 m），四角的白色方塊是把手。",
            "編輯表單直接展開在那一列下面，不跳到面板其他地方；同時只能編輯一列。",
            "半徑欄位留空＝用下面「無人巨菇」區塊的預設半徑。",
          ]}
        >
          <AppFrame
            tab="無人巨菇"
            map={PTS.map((p, i) => (
              <g key={i}>
                <EditBox x={p.x} y={p.y} half={HALF[i]} />
                <MapPin x={p.x} y={p.y} n={i + 1} />
              </g>
            ))}
            overlay={
              <div className="map-hint">
                {icons.plus}點地圖加入「台北信義區」；拖框可移動，拖四角可改半徑
              </div>
            }
          >
            <ListSection feature="無人巨菇" rows={WAYPOINTS} adding editIndex={1} form={<WaypointForm feature="無人巨菇" title="編輯 Waypoint" label="信義廣場" />} />
            <QuietSettings />
          </AppFrame>
        </Screen>
      </Section>

      <Section title="無人巨菇：執行中" desc="Batch 跑到第 3 個 Waypoint；1、2 已有結果，3～5 是 2R 預覽框。">
        <Screen
          notes={[
            "開始後清單自動收成一列「Waypoint　5 個」，結果卡片不用捲很遠就看得到；點那一列可以再展開。",
            "執行中半徑滑桿與開始鍵鎖住；進度、停止、執行紀錄都在地圖底部的抽屜。",
            "結果區塊最上面的三個徽章同時是統計與地圖顏色的圖例。",
          ]}
        >
          <AppFrame
            tab="無人巨菇"
            waypoints={PTS.map((p, i) => ({ n: i + 1, ...p, half: HALF[i], result: (["yes", "no"] as const)[i] }))}
            sighting={{ x: 222, y: 360, label: "巨大 輝煌蘑菇" }}
            drawer={<BatchDrawer log={LOG} queue={false} total={5} />}
          >
            <ListSection feature="無人巨菇" rows={WAYPOINTS} collapsed />
            <QuietSettings running />
            <Results>
              <Tally counts={{ yes: 1, no: 1, unknown: 0 }} />
              <QuietResultCard index={1} name="象山親山步道" v="yes" radius={500} reason="範圍內有 1 顆巨大蘑菇，沒有人在打。">
                <SightingCard target="巨大 輝煌蘑菇" spot="象山步道入口" participants="無人" expiry="尚未開始倒數" seen="3 分鐘前看到" />
              </QuietResultCard>
              <QuietResultCard index={2} name="信義廣場" v="no" radius={500} reason="有人在打：第 2 格，3 人。" />
            </Results>
          </AppFrame>
        </Screen>
      </Section>

      <Section title="清單區塊的其他狀態" desc="無人巨菇、美片菇、指定菇菇共用；以下用無人巨菇示範，寬度與面板相同。">
        <Variants
          col="340px"
          items={[
            { cap: "還沒選清單", sub: "只能建立或選清單", bare: true, node: <Panel><ListSection feature="無人巨菇" list={null} /></Panel> },
            { cap: "改名中", sub: "下拉選單換成輸入框", bare: true, node: <Panel><ListSection feature="無人巨菇" rows={WAYPOINTS.slice(0, 3)} mode="renaming" /></Panel> },
            { cap: "按了刪除", sub: "再按一次才刪；點別處或幾秒後取消", bare: true, node: <Panel><ListSection feature="無人巨菇" rows={WAYPOINTS.slice(0, 3)} mode="deleting" /></Panel> },
          ]}
        />
        <Variants
          col="340px"
          items={[
            { cap: "展開「從文字匯入」", bare: true, node: <Panel><ListSection feature="無人巨菇" rows={WAYPOINTS.slice(0, 2)} importBox="open" /></Panel> },
            { cap: "匯入後有錯誤", sub: "成功的行已加入；失敗的行留在文字框", bare: true, node: <Panel><ListSection feature="無人巨菇" rows={WAYPOINTS.slice(0, 2)} importBox="errors" /></Panel> },
            {
              cap: "儲存失敗",
              sub: "半徑不是數字",
              bare: true,
              node: (
                <Panel>
                  <ListSection feature="無人巨菇" rows={WAYPOINTS.slice(0, 2)} editIndex={0} form={<WaypointForm feature="無人巨菇" title="編輯 Waypoint" label="象山親山步道" radius="abc" err={{ radius: "半徑要是 1 以上的數字" }} />} />
                </Panel>
              ),
            },
          ]}
        />
      </Section>

      {/* ---------------- 探索區域 ---------------- */}
      <Section title="探索區域：調整 Region" desc="放一個 Region，拖 8 個把手調大小、拖框內平移；格子是每一點要跑的 2R 範圍。">
        <Screen
          notes={[
            "有上一次結果時，最上面多一個「編輯 Region／上次結果」切換，取代原本的說明文字和按鈕。",
            "格子數、Region 大小、預估時間集中在一塊淡綠色的統計框，最大的字是點數。",
            "間距連動時，間距滑桿鎖住並寫「連動中 1000 m」。",
            "格子預覽之外，地圖還畫出 bot 走的順序（橘色線）與「起點」標籤，以及 Region 上方的寬高標籤；沿用原本的功能，顏色換成主題色。",
          ]}
        >
          <AppFrame
            tab="探索區域"
            map={<RegionGrid {...REGION} editing />}
            overlay={<div className="map-hint">{icons.map}拖 8 個把手調大小，拖框內平移；會自動對齊整數格</div>}
          >
            <div className="sec boxed" style={{ paddingBottom: 12 }}>
              <Seg items={["編輯 Region", "上次結果"]} active="編輯 Region" />
            </div>
            <DiscoveryEdit />
          </AppFrame>
        </Screen>
      </Section>

      <Section title="探索區域：看結果" desc="Batch 跑完，格子依答案上色；點第 10 格，旁邊浮出這一格的原因。">
        <Screen
          notes={[
            "格子的原因改成在地圖上、緊鄰被點的格子浮出，不必在面板和地圖之間來回看。",
            "綠格的浮動卡上可以直接「加入無人巨菇清單」；其他狀態畫在下面。",
            "面板只留這次 Region 的摘要與統計；要重來就切回「編輯 Region」。",
          ]}
        >
          <AppFrame
            tab="探索區域"
            map={<RegionGrid {...REGION} results={GRID} selected={9} />}
            overlay={<CellPopover n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" at={{ left: 500, top: 216 }} />}
            drawer={<BatchDrawer state="done" title="#41 探索區域｜探索 2026-11-17 13:05" result="完成：共 24 個格子，綠色 5 個" log={LOG.slice(0, 2)} queue={false} />}
          >
            <div className="sec boxed" style={{ paddingBottom: 12 }}>
              <Seg items={["編輯 Region", "上次結果"]} active="上次結果" />
            </div>
            <div className="sec boxed">
              <SectionHead title="探索 2026-11-17 13:05" en="DISCOVERY RESULT" />
              <p className="muted">6 × 4 格＝24 點｜半徑 500 m｜6.0 km × 4.0 km</p>
              <Tally counts={{ yes: 5, no: 14, unknown: 5 }} />
              <p className="muted">點地圖上的格子看原因；綠格可以加入無人巨菇清單。</p>
            </div>
          </AppFrame>
        </Screen>
      </Section>

      <Section title="探索區域的其他狀態" desc="面板的設定區塊，以及格子浮動卡。">
        <Variants
          col="340px"
          items={[
            { cap: "超過 30 點", sub: "按開始後先確認", bare: true, node: <Panel><DiscoveryEdit state="confirm" /></Panel> },
            { cap: "Region 太大", sub: "統計框變紅、開始停用", bare: true, node: <Panel><DiscoveryEdit state="bad" /></Panel> },
            { cap: "執行中", sub: "全部鎖住", bare: true, node: <Panel><DiscoveryEdit state="locked" /></Panel> },
            {
              cap: "Region 太大（地圖）",
              sub: "外框與把手變紅",
              bare: true,
              node: (
                <MapSnippet w={300} h={220}>
                  <RegionGrid x={14} y={30} cols={6} rows={3} cell={46} editing bad />
                </MapSnippet>
              ),
            },
          ]}
        />
        <Variants
          col="294px"
          items={[
            { cap: "不是", sub: "只看原因", node: <CellPopover static n={3} v="no" reason="有人在打：第 2 格，3 人。" /> },
            { cap: "無法判斷", node: <CellPopover static n={5} v="unknown" reason="畫面沒讀完，無法判斷。" /> },
            { cap: "按了加入", sub: "選要加到哪份清單", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="pick" /> },
            { cap: "選了新建清單", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="new" /> },
          ]}
        />
        <Variants
          col="294px"
          items={[
            { cap: "已加入", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="added" /> },
            { cap: "已在清單裡", node: <CellPopover static n={10} v="yes" reason="範圍內有 1 顆巨大蘑菇，沒有人在打。" state="dup" /> },
          ]}
        />
      </Section>

      {/* ---------------- 美片菇 ---------------- */}
      <Section title="美片菇：執行中" desc="每日巡邏清單跑到第 3 個 Waypoint；1 找到、2 沒找到。">
        <Screen
          notes={[
            "美片菇不用半徑，地圖只畫水滴；結果用水滴右上角的圓章表示（✓ 找到、✕ 沒找到、? 沒讀完）。",
            "清單每一列的小字是 @Spot Name。",
            "GPS 提醒留在開始鍵上方；Spot Name 的匯入格式只寫在「從文字匯入」裡，不重複。",
          ]}
        >
          <AppFrame
            tab="美片菇"
            sightingToggle={false}
            map={PTS.map((p, i) => (i < 2 ? <CheckPin key={i} {...p} n={i + 1} v={(["yes", "no"] as const)[i]} /> : <MapPin key={i} {...p} n={i + 1} />))}
            drawer={<BatchDrawer title="#43 美片菇｜每日巡邏" at={3} total={5} label="松山文創園區" log={["[check] teleport 25.0443,121.5604", "[check] cold start... ok (10.4s)", "[check] reading start screen"]} queue={false} />}
          >
            <ListSection feature="美片菇" list="每日巡邏" rows={POSTCARD_ROWS} collapsed />
            <div className="sec boxed">
              <SectionHead title="美片菇" en="POSTCARD CHECK" />
              <p className="muted">GPS 要夠準：只看冷啟動後的起點畫面，那顆蘑菇不在畫面上就找不到。</p>
              <Button kind="primary" size="block" icon="play" state="disabled">
                開始
              </Button>
            </div>
            <Results>
              <Tally counts={{ yes: 1, no: 1, unknown: 0 }} labels={CHECK_LABELS} />
              <CheckResultCard index={1} name="台北 101" kind="found">
                <p>巨大 紅色蘑菇｜3 人｜到期 2026-11-17 18:42</p>
              </CheckResultCard>
              <CheckResultCard index={2} name="國父紀念館" kind="missing">
                <p>起點畫面上沒有這個 Spot Name</p>
                <p className="muted">可能有 1 顆沒讀到</p>
              </CheckResultCard>
            </Results>
          </AppFrame>
        </Screen>
      </Section>

      <Section title="美片菇的其他狀態" desc="缺 Spot Name 時不能開始；新增 Waypoint 時 Spot Name 必填。">
        <Variants
          col="340px"
          items={[
            {
              cap: "缺 Spot Name",
              sub: "缺的列標紅，開始停用",
              bare: true,
              node: (
                <Panel>
                  <ListSection
                    feature="美片菇"
                    list="每日巡邏"
                    rows={[POSTCARD_ROWS[0], { name: "國父紀念館", meta: "缺 Spot Name", bad: true }, POSTCARD_ROWS[2], { name: "四四南村", meta: "缺 Spot Name", bad: true }]}
                  />
                  <div className="sec boxed">
                    <SectionHead title="美片菇" en="POSTCARD CHECK" />
                    <p className="err">缺 Spot Name：國父紀念館、四四南村。點那一列的編輯補上。</p>
                    <Button kind="primary" size="block" icon="play" state="disabled">
                      開始
                    </Button>
                  </div>
                </Panel>
              ),
            },
            {
              cap: "新增 Waypoint",
              sub: "表單接在清單最後；沒填 Spot Name 就按儲存",
              bare: true,
              node: (
                <Panel>
                  <ListSection
                    feature="美片菇"
                    list="每日巡邏"
                    rows={POSTCARD_ROWS.slice(0, 2)}
                    adding
                    editIndex={-1}
                    form={<WaypointForm feature="美片菇" title="新增 Waypoint（25.040812, 121.567543）" err={{ spot: "美片菇需要 Spot Name" }} />}
                  />
                </Panel>
              ),
            },
            {
              cap: "新增 Waypoint（地圖）",
              sub: "還沒儲存的點是虛線水滴，可以拖；舊的點在新增模式也能拖",
              bare: true,
              node: (
                <MapSnippet w={300} h={220}>
                  <MapPin x={90} y={110} n={1} />
                  <MapPin x={230} y={70} n={2} />
                  <PendingPin x={170} y={170} />
                </MapSnippet>
              ),
            },
          ]}
        />
      </Section>

      {/* ---------------- 指定菇菇 ---------------- */}
      <Section title="指定菇菇：完成" desc="找兩種 Target；5 個 Waypoint 跑完，找到 3 筆 Sighting，第 3 個失敗。">
        <Screen
          notes={[
            "Target 是可以刪的膠囊，下面是輸入框；「＋巨菇」一鍵加入巨大蘑菇。",
            "「在地圖上新增」模式和無人巨菇相同：2R 框可以拖移、拖四角改半徑（畫法見「無人巨菇：新增與編輯 Waypoint」）。",
            "--skip-crowded 為 0 時數字框寫「不略過」。",
            "失敗的 Waypoint 用一張紅色徽章的卡片，附 abort 截圖，排在 Sighting 前面。",
          ]}
        >
          <AppFrame
            tab="指定菇菇"
            waypoints={PTS.map((p, i) => ({ n: i + 1, ...p, half: HALF[i] }))}
            map={
              <>
                <SightingPin x={300} y={380} label="巨大 輝煌蘑菇" />
                <SightingPin x={470} y={300} label="巨大 紅色蘑菇" />
                <SightingPin x={700} y={340} label="巨大 輝煌蘑菇" />
              </>
            }
            drawer={<BatchDrawer state="done" title="#44 指定菇菇｜台北信義區" result="完成：共 5 個 Waypoint，找到 3 筆" log={["[target] teleport 25.0418,121.5653", "[target] found 巨大 輝煌蘑菇 ×1"]} queue={false} />}
          >
            <ListSection feature="指定菇菇" rows={WAYPOINTS} collapsed />
            <TargetSettings />
            <Results>
              <FailureCard index={3} name="四四南村" error="遊戲沒有在 60 秒內進到地圖畫面" />
              <SightingCard target="巨大 輝煌蘑菇" spot="象山步道入口" participants="無人" expiry="尚未開始倒數" seen="3 分鐘前看到" />
            </Results>
          </AppFrame>
        </Screen>
      </Section>

      <Section title="指定菇菇的其他狀態" desc="Target 輸入。">
        <Variants
          col="340px"
          items={[
            { cap: "還沒有 Target", sub: "開始停用", bare: true, node: <Panel><TargetSettings chips={[]} /></Panel> },
            { cap: "打字中", sub: "下面列出之前搜過的 Target", bare: true, node: <Panel><TargetSettings chips={["巨大 紅色蘑菇"]} typing /></Panel> },
            { cap: "執行中", sub: "滑桿與開始鎖住", bare: true, node: <Panel><TargetSettings running /></Panel> },
          ]}
        />
      </Section>

      {/* ---------------- 歷史 ---------------- */}
      <Section title="歷史：列表" desc="所有功能的 Batch，新的在上面。">
        <Screen
          notes={[
            "每張卡片右上角是狀態徽章（完成／執行中／已取消／失敗／排隊中），有文字不只靠顏色。",
            "刪除改成卡片右下角的垃圾桶圖示，按了變成「確定刪除？」；執行中或排隊中的 Batch 圖示停用。",
            "run 資料夾上限很少改，收到最下面「儲存空間」區塊（下面另畫）。",
            "沒點進任何 Batch 時，地圖不畫東西。",
          ]}
        >
          <AppFrame tab="歷史">
            <HistoryList />
          </AppFrame>
        </Screen>
      </Section>

      <Section title="歷史：某個 Batch 的結果" desc="點進 #42（無人巨菇，跑到一半取消）。">
        <Screen
          notes={[
            "地圖畫這個 Batch 當時走過的點（深色空心圓），和清單的水滴標記分得開；結果方格與 Sighting 照常畫。",
            "標題下一行寫清單、狀態、起訖時間；統計用和其他分頁相同的徽章。",
            "清單後來被刪掉時，清單名稱後面加「（清單已刪除）」。",
          ]}
        >
          <AppFrame
            tab="歷史"
            map={
              <>
                <SweepSquare x={250} y={330} result="yes" />
                <SweepSquare x={440} y={250} result="no" />
                <SweepSquare x={590} y={420} result="yes" half={43} />
                <HistoryDot x={250} y={330} label="象山親山步道" />
                <HistoryDot x={440} y={250} label="信義廣場" />
                <HistoryDot x={590} y={420} label="四四南村" />
                <SightingPin x={222} y={380} label="巨大 輝煌蘑菇" />
              </>
            }
          >
            <div className="sec boxed">
              <a className="back">{icons.arrow}回列表</a>
              <div className="line">
                <span className="h-title grow">Batch #42｜無人巨菇</span>
                <span className="badge cancelled">已取消</span>
              </div>
              <p className="muted">台北信義區｜11/17 14:30 → 14:52</p>
              <p>3 個 Waypoint（共 5 個，跑到第 3 個時取消）</p>
              <Tally counts={{ yes: 2, no: 1, unknown: 0 }} />
            </div>
            <Results>
              <QuietResultCard index={1} name="象山親山步道" v="yes" radius={500} reason="範圍內有 1 顆巨大蘑菇，沒有人在打。">
                <SightingCard target="巨大 輝煌蘑菇" spot="象山步道入口" participants="無人" expiry="已到期（2026-11-17 15:40）" expired />
              </QuietResultCard>
              <QuietResultCard index={2} name="信義廣場" v="no" radius={500} reason="有人在打：第 2 格，3 人。" />
            </Results>
          </AppFrame>
        </Screen>
      </Section>

      <Section title="歷史的其他狀態" desc="刪除確認、還沒有紀錄、儲存空間設定。">
        <Variants
          col="340px"
          items={[
            { cap: "按了刪除", sub: "#44 的垃圾桶變成「確定刪除？」", bare: true, node: <Panel><HistoryList deleting /></Panel> },
            {
              cap: "還沒有任何 Batch",
              bare: true,
              node: (
                <Panel>
                  <div className="sec boxed">
                    <SectionHead title="歷史" en="HISTORY" />
                    <p className="muted">還沒有任何 Batch。到無人巨菇、探索區域、美片菇或指定菇菇按「開始」後，紀錄會出現在這裡。</p>
                  </div>
                </Panel>
              ),
            },
            {
              cap: "儲存空間",
              sub: "列表最下面；輸入錯誤時",
              bare: true,
              node: (
                <Panel>
                  <div className="sec boxed">
                    <SectionHead title="儲存空間" en="STORAGE" />
                    <Field label="run 資料夾上限" err="上限要是大於 0 的數字（MB）">
                      <div className="line">
                        <Input value="0" state="invalid" grow />
                        <span className="muted">MB</span>
                        <Button>儲存</Button>
                      </div>
                    </Field>
                    <p className="muted">超過上限時，從最舊的 Batch 開始清掉截圖；文字結果保留，執行中與排隊中的不動。</p>
                  </div>
                </Panel>
              ),
            },
          ]}
        />
      </Section>
    </Page>
  );
}

/** 單獨畫面板裡的一段：面板底色＋上方留白，和整體畫面裡一樣寬。 */
function Panel({ children }: { children: ReactNode }) {
  return <div style={{ paddingTop: 10, background: "var(--panel-bg)" }}>{children}</div>;
}
