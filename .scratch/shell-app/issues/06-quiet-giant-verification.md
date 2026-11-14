# 06: Quiet Giant Search 驗證

**What to build:** Waypoint 可以帶自己的半徑（公尺）。使用者在 Quiet Giant Search 分頁選一份 Waypoint List、設定預設半徑後開始 Batch，每個 Waypoint 先 Teleport，再跑 `quiet --radius <R>`（帶 `--runs-dir`）。R 用 Waypoint 自己的半徑，沒有就用預設值。

App 讀 exit code 與 stdout 最後一行，結果在地圖上以每個 Waypoint 為中心、邊長 2R 的正方形表示：

- **綠**：是（`verdict: true`）。附上 `giants` 的 Sighting。
- **紅**：不是。附上 `reason`；有 `claimed` 時附上觸發的格子與人數。
- **灰**：無法判斷。附上原因。

`unread > 0` 時加註。

**Blocked by:** 03（Target Search 第一條完整流程）

**Status:** ready-for-agent

- [ ] 匯入格式和地圖編輯都能設定 Waypoint 的半徑。
- [ ] 地圖以正方形畫出每個 Waypoint 的 Sweep Area，顏色依結果而定。
- [ ] 結果卡片顯示 `reason`、`giants`（同 Target Search 的 Sighting 卡片）、`claimed`、`unread`。
- [ ] 用真 bot 和實機至少跑通一個點。
- [ ] 有自動化測試，用假 bot 涵蓋 exit 0、1、2 與 stdout 最後一行的解析（前面還有 Sighting 陣列時也要能正確解析）。
