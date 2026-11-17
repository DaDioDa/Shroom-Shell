import { doc } from "./theme.js";

/** 設計稿頁面（紙張）的版面。 */
const docCss = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: ${doc.bg}; color: ${doc.ink}; font-family: ${doc.font}; font-size: 14px; line-height: 1.6; }
.doc { max-width: 1680px; margin: 0 auto; padding: 40px 40px 80px; }
.doc-head h1 { margin: 0; font-size: 28px; }
.doc-head .sub { margin: 4px 0 0; color: ${doc.muted}; font-size: 15px; }
.doc-head ul { margin: 12px 0 0; padding-left: 20px; color: ${doc.muted}; }
.doc-section { border-top: 1px solid ${doc.rule}; margin-top: 40px; padding-top: 28px; }
.doc-section > h2 { margin: 0; font-size: 20px; }
.doc-section > .desc { margin: 2px 0 20px; color: ${doc.muted}; }
.note { color: ${doc.muted}; font-size: 13px; }
.note strong { color: ${doc.ink}; }
.note ul { margin: 6px 0 0; padding-left: 18px; }

/* 比較表：第一欄是列名，其餘每欄一個方向；同一列的格子共用列高。 */
.compare { display: grid; gap: 16px 24px; align-items: start; }
.compare .rowhead { font-weight: 700; font-size: 13px; padding-top: 6px; }
.compare .rowhead .note { font-weight: 400; display: block; }
.compare .colhead h3 { margin: 0; font-size: 16px; }
.compare .colhead p { margin: 2px 0 0; }
.sheet { box-shadow: 0 0 0 1px rgba(31,35,40,.12), 0 2px 8px rgba(31,35,40,.08); border-radius: 6px; overflow: hidden; }

/* 狀態並排：每個變體一欄，說明在上、mock-up 在下；同一列的說明與 mock-up 各自對齊。 */
.variants { display: grid; gap: 8px 20px; align-items: start; margin-bottom: 24px; }
.variant { display: grid; grid-row: span 2; grid-template-rows: subgrid; }
.variant > .cap { font-size: 12px; color: ${doc.muted}; align-self: end; }
.variant > .sheet { align-self: start; }
.variant > .cap strong { color: ${doc.ink}; display: block; font-size: 13px; }
.tokens { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.token { display: grid; grid-template-columns: 44px 1fr; gap: 10px; align-items: center; background: #fff; border-radius: 8px; padding: 8px; box-shadow: 0 0 0 1px rgba(31,35,40,.1); }
.token .chip { width: 44px; height: 44px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.1); }
.token code { font-size: 11px; color: ${doc.muted}; }
.token .use { font-size: 11px; color: ${doc.muted}; line-height: 1.4; }
.type-row { display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid ${doc.rule}; }

/* 整體畫面：mock-up 左、頁邊註解右。 */
.screen-row { display: grid; grid-template-columns: 1280px 1fr; gap: 28px; align-items: start; }
.screen-frame { box-shadow: 0 0 0 1px rgba(31,35,40,.15), 0 8px 28px rgba(31,35,40,.14); border-radius: 8px; overflow: hidden; width: 1280px; }
`;

/** App 的 UI 元件。所有視覺都讀 themeVars() 給的 CSS 變數；形狀差異用 .ui 上的 data-* 切換。 */
const uiCss = `
.ui { font-family: var(--font-body); color: var(--ink); font-size: 14px; line-height: 1.5; background: var(--panel-bg); }
.ui p { margin: 0; }
.ui .muted { color: var(--muted); font-size: 12px; }
.ui .err { color: var(--danger); font-size: 12px; }
.ui .stack { display: flex; flex-direction: column; gap: 8px; }
.ui .line { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ui .grow { flex: 1; min-width: 0; }
.ui.pad, .ui .pad { padding: 14px; }
.ui .num { font-family: var(--font-brand); font-variant-numeric: tabular-nums; }

/* 按鈕 */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: var(--r-button); border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: 600 13px/1 var(--font-body); white-space: nowrap; }
.btn svg { width: 15px; height: 15px; flex: none; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--on-primary); box-shadow: var(--btn-edge); }
.btn.primary.hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.btn.hover { background: var(--primary-tint); }
.btn.on { background: var(--primary-tint); border-color: var(--primary); color: var(--primary-ink); }
.btn.danger { color: var(--danger); border-color: var(--danger); }
.btn.danger.solid { background: var(--danger); color: #fff; }
.btn.disabled { background: var(--disabled-bg); border-color: var(--disabled-bg); color: var(--disabled-ink); box-shadow: none; }
.btn.block { width: 100%; height: 40px; font-size: 15px; }
.btn.icon { width: 28px; height: 28px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); }
.btn.icon.disabled { color: var(--border-strong); background: transparent; }
.btn.icon.danger { color: var(--danger); }
.btn.small { height: 26px; padding: 0 10px; font-size: 12px; }

/* 分頁 */
.tabs { display: flex; }
.tab { flex: 1; text-align: center; white-space: nowrap; font-weight: 600; font-size: 13px; }
.ui[data-tabs="segmented"] .tabs { gap: 2px; padding: 4px; margin: 0 14px; background: var(--primary-tint); border-radius: 999px; }
.ui[data-tabs="segmented"] .tab { flex: 1 1 auto; padding: 6px 8px; border-radius: 999px; color: var(--primary-ink); }
.ui[data-tabs="segmented"] .tab.active { background: var(--primary); color: var(--on-primary); box-shadow: var(--btn-edge); }
.ui[data-tabs="segmented"] .tab.hover { background: #fff; }
.ui[data-tabs="underline"] .tabs { border-bottom: 1px solid var(--border); padding: 0 6px; }
.ui[data-tabs="underline"] .tab { padding: 10px 0 9px; color: var(--muted); font-weight: 500; border-bottom: 3px solid transparent; margin-bottom: -1px; }
.ui[data-tabs="underline"] .tab.active { color: var(--ink); font-weight: 700; border-bottom-color: var(--primary); }
.ui[data-tabs="underline"] .tab.hover { color: var(--ink); border-bottom-color: var(--border-strong); }

/* 區塊標題 */
.sec-title { margin: 0; font: 700 15px/1.3 var(--font-heading); }
.ui[data-heading="leaf"] .sec-title { display: flex; align-items: center; gap: 6px; color: var(--primary-ink); }
.ui[data-heading="leaf"] .sec-title svg { width: 18px; height: 18px; }
.ui[data-heading="leaf"] .sec-en { display: none; }
.ui[data-heading="centered-bilingual"] .sec-head { text-align: center; }
.ui[data-heading="centered-bilingual"] .sec-title { font-size: 17px; font-weight: 500; letter-spacing: .04em; }
.ui[data-heading="centered-bilingual"] .sec-en { display: block; font: 600 10px/1 var(--font-body); letter-spacing: .18em; color: var(--muted); margin-top: 6px; }
.ui[data-heading="centered-bilingual"] .sec-head::after { content: ""; display: block; width: 24px; height: 2px; background: var(--primary); margin: 8px auto 0; }
.ui[data-heading="centered-bilingual"] .sec-title svg { display: none; }
.ui[data-heading="label-bilingual"] .sec-head { display: flex; flex-direction: column-reverse; gap: 2px; }
.ui[data-heading="label-bilingual"] .sec-en { display: block; font: 800 10px/1 var(--font-brand); letter-spacing: .16em; color: var(--primary-ink); }
.ui[data-heading="label-bilingual"] .sec-title svg { display: none; }

/* 面板區塊 */
.sec { padding: 16px 14px; display: flex; flex-direction: column; gap: 10px; }
.sec + .sec { border-top: 1px solid var(--border); }
.ui[data-card="rounded"][data-tabs="segmented"] .sec + .sec { border-top: 0; padding-top: 4px; }
.ui[data-tabs="segmented"] .sec.boxed { background: var(--surface); border-radius: var(--r-card); margin: 0 10px 10px; box-shadow: 0 1px 0 var(--border); }

/* 表單 */
.input, .select { height: 32px; border: 1px solid var(--border-strong); border-radius: var(--r-control); background: var(--surface); padding: 0 10px; display: flex; align-items: center; font-size: 13px; color: var(--ink); min-width: 0; }
.input.placeholder { color: var(--disabled-ink); }
.input.focus { border-color: var(--focus); box-shadow: 0 0 0 3px var(--focus-ring); }
.input.invalid { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-tint); }
.select { justify-content: space-between; gap: 8px; }
.select svg { width: 14px; height: 14px; color: var(--muted); flex: none; }
.textarea { border: 1px solid var(--border-strong); border-radius: var(--r-control); background: var(--surface); padding: 8px 10px; font: 12px/1.6 ui-monospace, Consolas, monospace; color: var(--disabled-ink); min-height: 72px; white-space: pre-wrap; }
.field-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.check .box { width: 16px; height: 16px; border: 1.5px solid var(--border-strong); border-radius: 4px; background: var(--surface); display: grid; place-items: center; flex: none; }
.check .box.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.check .box svg { width: 12px; height: 12px; }

/* 滑桿 */
.slider { display: flex; flex-direction: column; gap: 4px; }
.slider .top { display: flex; justify-content: space-between; align-items: baseline; }
.slider .bottom { display: flex; align-items: center; gap: 10px; }
.track { position: relative; flex: 1; height: 6px; border-radius: 3px; background: var(--border); }
.track .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: var(--primary); }
.track .thumb { position: absolute; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--surface); border: 3px solid var(--primary); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.slider.disabled .fill { background: var(--border-strong); }
.slider.disabled .thumb { border-color: var(--border-strong); }
.numbox { width: 64px; height: 28px; border: 1px solid var(--border-strong); border-radius: var(--r-control); background: var(--surface); display: flex; align-items: center; justify-content: flex-end; padding: 0 8px; font-size: 13px; }
.slider.disabled .numbox { background: var(--disabled-bg); color: var(--disabled-ink); }

/* 標記：答案徽章、狀態徽章 */
.badge { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: var(--r-button); font-size: 12px; font-weight: 700; white-space: nowrap; }
.badge svg { width: 12px; height: 12px; }
.badge.yes { background: var(--yes-tint); color: var(--yes-ink); }
.badge.no { background: var(--no-tint); color: var(--no-ink); }
.badge.unknown { background: var(--unknown-tint); color: var(--unknown-ink); }
.badge.running { background: var(--primary); color: var(--on-primary); }
.badge.queued { background: var(--disabled-bg); color: var(--ink); }

/* 卡片 */
.card { background: var(--surface); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.ui[data-card="rounded"] .card { border: 1px solid var(--border); border-radius: var(--r-card); }
.ui[data-card="ruled"] .card { border-bottom: 1px solid var(--border); padding: 12px 2px; }
.card .head { display: flex; align-items: center; gap: 8px; }
.card .title { font-weight: 700; flex: 1; min-width: 0; }
.card .idx { font-family: var(--font-brand); color: var(--muted); font-weight: 700; font-size: 12px; }
.card.expired { opacity: .6; }
.card a, .ui a { color: var(--primary-ink); font-weight: 600; text-decoration: none; }
.ui[data-card="ruled"] .link-arrow { display: inline-flex; align-items: center; gap: 4px; }
.shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.shot { aspect-ratio: 4 / 5; border-radius: calc(var(--r-card) / 2); overflow: hidden; border: 1px solid var(--border); }
.shot svg { display: block; width: 100%; height: 100%; }
.shot-empty { aspect-ratio: 4 / 5; border: 1px dashed var(--border-strong); border-radius: calc(var(--r-card) / 2); display: grid; place-items: center; color: var(--muted); font-size: 11px; text-align: center; }

/* Waypoint 列 */
.wplist { display: flex; flex-direction: column; }
.wp { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.wp:last-child { border-bottom: 0; }
.wp .n { width: 22px; height: 22px; border-radius: 50%; background: var(--primary-tint); color: var(--primary-ink); font: 800 11px/22px var(--font-brand); text-align: center; flex: none; }
.ui[data-card="ruled"] .wp .n { border-radius: 2px; background: var(--ink); color: #fff; }
.wp .name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wp .meta { font-size: 11px; color: var(--muted); }
.wp .acts { display: flex; }
.wp.editing { background: var(--primary-tint); margin: 0 -8px; padding: 6px 8px; border-radius: 8px; border-bottom-color: transparent; }

/* 執行紀錄 */
.log { background: var(--log-bg); color: var(--log-ink); font: 11px/1.55 ui-monospace, Consolas, monospace; padding: 8px 10px; border-radius: calc(var(--r-card) / 2); white-space: pre; overflow: hidden; }

/* 進度條 */
.progress { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
.progress .fill { height: 100%; background: var(--primary); border-radius: 4px; }
.ui[data-card="ruled"] .progress, .ui[data-card="ruled"] .progress .fill { border-radius: 0; height: 4px; }

/* 底部抽屜 */
.drawer { background: var(--surface); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.ui[data-drawer="floating"] .drawer, .drawer[data-drawer="floating"] { border-radius: var(--r-drawer); box-shadow: 0 6px 24px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04); }
.ui[data-drawer="bar"] .drawer, .drawer[data-drawer="bar"] { border-top: 3px solid var(--primary); box-shadow: 0 -2px 10px rgba(0,0,0,.08); }
.drawer a.grow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.drawer .queue { display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.warn { background: var(--danger-tint); border: 1px solid var(--danger); color: var(--ink); padding: 8px 10px; border-radius: var(--r-control); font-size: 12px; display: flex; flex-direction: column; gap: 6px; }
/* 一般的「確定要做嗎？」：不危險，所以用主色而不是紅色。 */
.warn.ask { background: var(--primary-tint); border-color: var(--primary); }

/* App 整體 */
.app { display: flex; width: 1280px; height: 800px; overflow: hidden; }
.app .map-area { position: relative; flex: 1; overflow: hidden; }
.app .map-area > svg.map { position: absolute; inset: 0; width: 100%; height: 100%; }
.panel { width: 340px; flex: none; display: flex; flex-direction: column; border-left: 1px solid var(--border); background: var(--panel-bg); overflow: hidden; }
.brand { display: flex; align-items: center; gap: 8px; padding: 14px 14px 12px; }
.brand svg { width: 28px; height: 28px; }
.brand .name { font: 800 16px/1 var(--font-brand); letter-spacing: .01em; }
.brand .name em { font-style: normal; color: var(--primary-ink); }
.ui[data-tabs="underline"] .brand { border-bottom: 1px solid var(--border); }
.ui[data-heading="centered-bilingual"] .brand { padding: 0; border-bottom: 0; }
.brand .mark { display: flex; align-items: center; gap: 8px; }
.ui[data-heading="centered-bilingual"] .brand .mark { flex: 1; background: var(--accent); color: #fff; padding: 12px 14px; --primary: #fff; --primary-edge: #fff; }
.ui[data-heading="centered-bilingual"] .brand .name em { color: #fff; font-weight: 600; }
.panel .body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.ui[data-tabs="segmented"] .panel .body { padding-top: 10px; }

/* 地圖上的浮動控制 */
.map-ctl { position: absolute; background: var(--surface); box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.zoom { top: 14px; left: 14px; display: flex; flex-direction: column; border-radius: var(--r-control); overflow: hidden; }
.zoom span { width: 34px; height: 34px; display: grid; place-items: center; font: 600 18px/1 var(--font-body); color: var(--ink); }
.zoom span + span { border-top: 1px solid var(--border); }
.search { top: 14px; left: 50%; transform: translateX(-50%); width: 420px; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 14px; border-radius: var(--r-button); }
.ui[data-heading="centered-bilingual"] .search { border-radius: 2px; }
.search .ph { flex: 1; color: var(--disabled-ink); font-size: 13px; }
.search svg { width: 16px; height: 16px; color: var(--muted); }
.search .go { width: 30px; height: 30px; border-radius: var(--r-button); background: var(--primary); display: grid; place-items: center; }
.search .go svg { color: #fff; }
.map-toggle { top: 14px; right: 14px; padding: 8px 12px; border-radius: var(--r-control); }
.map-ctl.static { position: static; transform: none; }
/* 地圖上方的操作提示（新增模式等），深色膠囊，不擋標記。 */
.map-hint { position: absolute; top: 66px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 7px 14px; border-radius: var(--r-button); font-size: 12px; font-weight: 600; white-space: nowrap; display: flex; gap: 6px; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.map-hint svg { width: 14px; height: 14px; }
.map-hint.static { position: static; transform: none; display: inline-flex; }
/* 點地圖上的東西後浮出來的卡片；左側小三角指向被點的格子。 */
.popover { position: absolute; width: 270px; background: var(--surface); border-radius: var(--r-card); box-shadow: 0 6px 24px rgba(0,0,0,.2), 0 0 0 1px rgba(0,0,0,.05); padding: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.popover::before { content: ""; position: absolute; left: -7px; top: 22px; width: 14px; height: 14px; background: var(--surface); transform: rotate(45deg); box-shadow: -1px 1px 0 rgba(0,0,0,.06); }
.popover.static { position: relative; }
.popover .head { display: flex; align-items: center; gap: 8px; }
.popover .title { font-weight: 700; flex: 1; min-width: 0; }
.popover .x { width: 22px; height: 22px; color: var(--muted); display: grid; place-items: center; }
.popover .x svg { width: 16px; height: 16px; }

/* 欄位 */
.field { display: flex; flex-direction: column; gap: 4px; }
.field .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.field .req { color: var(--danger); font-weight: 400; }
.textarea.filled { color: var(--ink); }
.numbox.text { width: auto; font-family: var(--font-body); font-size: 12px; }
.errbox { background: var(--danger-tint); color: var(--danger); border-radius: var(--r-control); padding: 8px 10px; font-size: 12px; }
.errbox p + p { margin-top: 2px; }
.ui .ok { color: var(--yes-ink); font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
.ui .ok svg { width: 14px; height: 14px; }

/* 收合列 */
.disc { border-top: 1px solid var(--border); padding-top: 8px; }
.disc-head { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; }
.disc-head .count { color: var(--muted); font-weight: 400; }
.disc-head svg { width: 16px; height: 16px; color: var(--muted); }
.disc.open .disc-head svg { transform: rotate(180deg); }
.disc-body { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }

/* Waypoint 表單 */
.wpform { background: var(--surface); border: 1.5px solid var(--primary); border-radius: var(--r-control); padding: 10px; display: flex; flex-direction: column; gap: 8px; margin: 4px 0 8px; }
.wpform-title { font-weight: 700; font-size: 13px; color: var(--primary-ink); }
.wp .meta.err { color: var(--danger); font-weight: 600; }

/* 小型分段切換 */
.seg { display: flex; background: var(--disabled-bg); border-radius: var(--r-button); padding: 3px; gap: 2px; }
.seg span { flex: 1; text-align: center; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: var(--r-button); color: var(--muted); }
.seg span.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.14); }

/* 探索區域的格子統計 */
.stats { background: var(--primary-tint); border-radius: var(--r-control); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.stats .big { font: 800 20px/1.25 var(--font-brand); color: var(--primary-ink); }
.stats.bad { background: var(--danger-tint); }
.stats.bad .big { color: var(--danger); }

/* 答案統計 */
.tally { display: flex; gap: 6px; flex-wrap: wrap; }
.tally .num { margin-left: 2px; }

/* Target 標籤與建議 */
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 2px; height: 26px; padding: 0 3px 0 10px; border-radius: var(--r-button); background: var(--primary-tint); color: var(--primary-ink); font-size: 12px; font-weight: 700; }
.chip .x { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; }
.chip .x svg { width: 12px; height: 12px; }
.suggest { margin-top: -4px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-control); box-shadow: 0 4px 12px rgba(0,0,0,.12); padding: 4px; display: flex; flex-direction: column; font-size: 13px; }
.suggest span { padding: 5px 8px; border-radius: 6px; }
.suggest span.hover { background: var(--primary-tint); }
.suggest mark { background: none; color: var(--primary-ink); font-weight: 800; }

/* 歷史 */
.badge.done { background: var(--yes-tint); color: var(--yes-ink); }
.badge.failed { background: var(--no-tint); color: var(--no-ink); }
.badge.cancelled { background: var(--unknown-tint); color: var(--unknown-ink); }
.link-more { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
.link-more svg { width: 14px; height: 14px; }
.back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; }
.back svg { width: 14px; height: 14px; transform: rotate(180deg); }
.ui .h-title { font: 800 17px/1.3 var(--font-heading); }

/* 面板捲得動：最下面淡出，提示還有內容。 */
.panel .body { position: relative; }
.panel .body.more::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 36px; background: linear-gradient(transparent, var(--panel-bg)); }
.attrib { position: absolute; right: 0; bottom: 0; background: rgba(255,255,255,.8); font-size: 10px; padding: 1px 6px; color: #555; }
.map-drawer { position: absolute; left: 14px; right: 14px; bottom: 22px; }
.ui[data-drawer="bar"] .map-drawer { left: 0; right: 0; bottom: 0; }
`;

export const css = docCss + uiCss;
