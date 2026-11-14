# 03: Target Search 第一條完整流程（含假 bot）

**What to build:** 使用者在 Target Search 分頁做以下設定後按開始：

- 選一份 Waypoint List
- 輸入一或多個 Target（多值輸入框，輸入時從過去用過的名稱自動提示，另有「巨菇」快捷按鈕會填入 `巨大 *`）
- 設定預設半徑與 `--skip-crowded`（預設 0）

後端對每個 Waypoint 依序執行：Teleport → 等待（預設 5 秒，可設定）→ 跑 `hunt`（帶 `--runs-dir` 指到本專案的資料夾）→ 解析 stdout 的 Sighting → 存進 SQLite。網頁上的效果：

- bot 的 stderr 經 SSE 逐行即時顯示，並顯示進度（第幾個 Waypoint，共幾個）
- 每筆 Sighting 成為一張結果卡片，內容有 Target、Spot Name、無人或 N 人、到期時間或「尚未開始倒數」、地圖連結、截圖與 Postcard
- Sighting 也標在地圖上

後端用同一個介面切換真 bot 或假 bot。假 bot 依 `cli.md` 的格式回放 stdout、stderr 與 exit code，自動化測試一律用它，也讓沒接手機時能開發。

這是第一個 Batch，只要做到正常跑完一輪，佇列、取消、出錯處理留給 04。

**Blocked by:** 02（App 骨架與 Waypoint List）

**Status:** ready-for-agent

- [ ] 用假 bot 在網頁上跑完一個 Target Search Batch：看得到即時 stderr、進度，最後有結果卡片和地圖標記。
- [ ] 用真 bot 和實機對一個兩點的 Waypoint List 跑完一次，每點都先 Teleport。
- [ ] Waypoint 有自己的半徑時用它，沒有就用 Batch 的預設半徑。
- [ ] 卡片上的截圖與 Postcard 由後端從本專案的 run 資料夾提供，網頁能直接顯示。
- [ ] Target 名稱寫錯時（bot exit 2、argparse 錯誤），網頁會顯示錯誤訊息。
- [ ] Batch 跑完後恢復真實 GPS。
- [ ] 有自動化測試，用假 bot 涵蓋：解析 Sighting、`[]`、冷啟動中止時 stdout 為空。
