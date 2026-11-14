# 07: Discovery

**What to build:** 使用者在地圖上框出一個矩形 Region（最大 10 km × 10 km）並取名，再設定半徑（預設 500 m）與間距（預設 1 km）：

- **鋪點**：App 依間距在 Region 內鋪出網格 Waypoint，用蛇形順序走，讓每次 Teleport 的距離盡量短。
- **開跑前**：顯示點數與預估時間，每點以 3 分鐘估；之後有實測資料時，改用過去 `quiet` 的平均耗時。超過 30 點要再確認一次。
- **執行**：開始後就是一個 Quiet Giant Search 的 Batch，結果一樣以綠、紅、灰格子呈現。
- **收集結果**：答案是 true 的 Waypoint 連同當時的半徑，自動加進名為「Discovery：<Region 名稱>」的 Waypoint List（沒有就建立），之後可以直接拿來驗證。

**Blocked by:** 06（Quiet Giant Search 驗證）

**Status:** ready-for-agent

- [ ] 地圖上可以畫矩形 Region；超過 10 km × 10 km 時不能開始，並說明原因。
- [ ] 網格點的位置與蛇形順序有自動化測試，例如 3 km × 2 km、間距 1 km 時的點數與順序。
- [ ] 開跑前顯示點數與預估時間；超過 30 點要再確認一次。
- [ ] 答案是 true 的 Waypoint 出現在「Discovery：<Region 名稱>」清單裡，並帶著半徑。
- [ ] 用假 bot 跑一次小 Region 的 Discovery，地圖上的格子顏色正確。
