# Spec：pikmin_bloom_shell 本機網頁 App

術語依 `GLOSSARY.md`。bot 的用法以 `F:\pikmin_bloom_bot\docs\cli.md` 為準，本 spec 只寫本 App 怎麼用它。

## 目的

把「手機 Teleport 到一串座標 → 每點跑一次 pikmin_bloom_bot → 看結果」做成可以在地圖上操作、即時看到輸出的本機網頁。主要有三個功能：Postcard Check、Quiet Giant Search（含 Discovery）、Target Search。

## 環境

- 手機：ASUS ROG Phone 2（`ASUS_I01WD`，Android 10）實機，以 USB 連線 adb。
- adb 預設路徑：`C:\Users\darkl\AppData\Local\Android\Sdk\platform-tools\adb.exe`，可在設定改。
- bot：工作目錄 `F:\pikmin_bloom_bot`，執行 `.venv\Scripts\python.exe -m mushroom_sweep <指令>`。repo 路徑可在設定改。
- 只綁 `127.0.0.1`，不做登入。

## Teleport

- 用 Appium Settings（`io.appium.settings`）當模擬位置 App，以 `appops ... android:mock_location allow` 授權，透過 adb 下指令設定位置。ticket 01 已驗證遊戲接受模擬位置，實作在 `server/src/device/teleporter.ts`。
- 每次 Teleport 後等待一段時間再呼叫 bot。預設 5 秒，可在設定改。實測約 200 ms 就到位，加上 bot 本身會冷啟動遊戲，5 秒只是保險。
- 每個 Batch 開始前，檢查有沒有其他模擬定位 App 正在運作，例如 `com.xmap.bluemap`。有的話不開始 Batch，並在網頁提示使用者先關掉。
- Batch 結束後一律停止模擬、恢復真實 GPS，包括正常結束、取消、失敗、強制停止。
- 遊戲沒有冷卻或速度鎖，不必模擬移動路徑。

## Batch

- 輸入：一份 Waypoint List、一個功能，以及該功能的參數。
- 依序對每個 Waypoint 執行 Teleport → 等待 → 跑 bot 指令 → 解析結果 → 存檔，然後換下一個。只跑一輪。
- **單一佇列**：手機同時只跑一個 Batch，其他 Batch 依 FIFO 排隊。
- **取消**：
  - 預設「跑完目前這個 Waypoint 就停」，讓 bot 自己收尾。
  - 另有「強制停止」，立刻 kill bot 的程序。這可能留下遊戲開著、螢幕沒鎖，UI 要明講。
- **出錯**：
  - 某個 Waypoint 的 bot exit 2：標成失敗，顯示 `abort.txt` 的原因與 `abort.png`，繼續下一個 Waypoint。
  - adb 找不到裝置：整個 Batch 停下。
- **即時輸出**：bot 的 stderr 逐行經 SSE 推到網頁。進度顯示目前是第幾個 Waypoint、共幾個。
- 每次呼叫 bot 都加 `--runs-dir`，指到本專案的資料夾，讓網頁能直接提供截圖。

## 功能

### Postcard Check

- Waypoint 存 GPS＋Spot Name，不帶半徑。
- 每個 Waypoint 執行 `check --spot-name "<Spot Name>"`。
- 結果依 exit code：
  - `0` 找到：顯示種類（`name`）、Participant Count（`0` 顯示「無人」，`null` 顯示「人數不明」）、剩餘時間或到期時間、`frame`、`postcard`。
  - `1` 沒找到：顯示「起點畫面上沒有這個 Spot Name」。`unread > 0` 時加註「可能有 N 顆沒讀到」。
  - `2` 中止或沒讀完：標成「沒讀完」，顯示 `reason`，並照樣顯示已讀到的 `name`、`participant_count` 等欄位。
- `check` 只看冷啟動後的起點畫面，所以 Waypoint 的 GPS 要夠準。UI 在新增 Postcard Mushroom 的地方提醒這一點。

### Quiet Giant Search

**驗證**

- 對已知的 Waypoint List 逐點執行 `quiet --radius <該 Waypoint 的半徑>`。
- Waypoint 沒有半徑時，用 Batch 的預設半徑。

**Discovery**

- 使用者在地圖上框一個矩形 Region，最大 10 km × 10 km。
- 依間距（預設 1 km）在 Region 內鋪網格 Waypoint，用蛇形順序走。每點跑 `quiet --radius 500`。半徑與間距都可以改。
- 開跑前顯示點數與預估時間（每點以 3 分鐘估）。超過 30 點要再確認一次。
- 答案是 true 的 Waypoint，連同當時的半徑，自動加進名為「Discovery：<Region 名稱>」的 Waypoint List，之後可以直接拿來驗證。

**結果**

- 讀 exit code 與 stdout 最後一行：
  - `0` / `verdict: true`：是。地圖格子標綠，附上 `giants` 的 Sighting。
  - `1` / `verdict: false`：不是。地圖格子標紅，附上 `reason`。如果有 `claimed`，附上觸發的格子與人數。
  - `2` / `verdict: null`：無法判斷。地圖格子標灰，附上原因。
- `unread > 0` 時加註。

### Target Search

- 每個 Waypoint 執行 `hunt --radius <R> --target <T> ... --skip-crowded <N>`。
- **Target 輸入**：多值輸入框，輸入時從過去用過的名稱自動提示。另有「巨菇」快捷按鈕，填入 `巨大 *`。名稱寫錯時由 bot 報錯（exit 2），網頁顯示錯誤訊息。
- **`--skip-crowded`**：預設 `0`（不略過）。
- **半徑**：用 Waypoint 自己的半徑，沒有就用 Batch 的預設值。
- **結果**：每筆 Sighting 一張卡片，內容有 Target、Spot Name、無人或 N 人、到期時間或「尚未開始倒數」、地圖連結、`sighting-NN.png`、Postcard。Postcard 只顯示，不拿來排序。
- 用 `hunt`，每點都冷啟動。bot 的腳本一律冷啟動，所以不考慮改用 `sweep`。

## Waypoint List 管理

- 可以有多份有名字的 Waypoint List，每個 Batch 選一份。
- **匯入**：
  - 貼純文字，每行 `lat,lng [標籤]`。Postcard Check 用的清單另外要有 Spot Name 欄。
  - 貼 Google Maps 連結時，自動解析出經緯度。
- **地圖編輯**：點地圖新增 Waypoint，點標記可以編輯或刪除。
- 每個 Waypoint 可選擇帶半徑。

## 地圖與畫面

- **左邊是地圖**（Leaflet + OpenStreetMap）：顯示 Waypoint、Sighting 和 Discovery 的格子。
- **右邊三個分頁**：Postcard Check、Quiet Giant Search、Target Search。
- **底部抽屜**：顯示目前的 Batch（進度、即時 stderr、取消、強制停止）和佇列。
- **Sighting 顯示規則**：預設只顯示還沒過期的 Sighting。到期時間用 `observed_at + remaining_seconds` 計算；還沒開始倒數的顯示「N 分鐘前看到」。
- **歷史頁**：列出所有 Batch 與結果，可以手動刪除整個 Batch，連同它的 run 資料夾。
- 視覺細節之後再調，先求功能完整。

## 儲存

- **SQLite**：存 Waypoint List、Waypoint、Batch、每個 Waypoint 的執行結果（exit code、解析後的 JSON、run 資料夾路徑），以及 Sighting。
- **run 資料夾**：放在本專案的資料目錄下。總量超過 1 GB 時，從最舊的 Batch 開始刪 run 資料夾，但保留 SQLite 裡的文字結果，UI 顯示「圖片已清除」。

## bot 的推播

照 bot 設定檔的設定推播，網頁不另外通知，也不關掉 bot 的推播。

## 技術

- **專案結構**：npm workspaces，分 `server/`（Node + TypeScript + Fastify）、`web/`（React + Vite + TypeScript）和 `shared/`（共用型別，含 bot 輸出的 JSON 型別）。
- **啟動**：`npm run dev` 同時啟動前後端。
- **測試**：
  - 假 bot 依 `cli.md` 的格式回放 stdout、stderr、exit code。後端用同一個介面切換真的或假的 bot，自動化測試（vitest）一律用假 bot，涵蓋 Batch、取消、出錯、解析。
  - 手動測試直接用實機。

## 不做

- 自動重複執行 Batch，或排程執行。
- 修改 pikmin_bloom_bot。需要新功能時，告訴使用者缺什麼，由使用者實作。
- 對外開放、登入、多使用者。

## 待確認

- 一次 `quiet --radius 500` 實際要跑幾分鐘。先以 3 分鐘估，之後用 Batch 的實測平均取代。
