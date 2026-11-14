# 08: Sighting 到期規則與歷史頁

**What to build:**

- **地圖上的 Sighting**：預設只顯示還沒過期的 Sighting，到期時間 = `observed_at + remaining_seconds`；還沒開始倒數的顯示「N 分鐘前看到」。可以切換「顯示全部」。
- **歷史頁**：列出所有 Batch（功能、Waypoint List、開始與結束時間、結果摘要），點進去看每個 Waypoint 的結果。可以手動刪除整個 Batch，連同它的 run 資料夾。

**Blocked by:** 03（Target Search 第一條完整流程）

**Status:** ready-for-agent

- [ ] 過期的 Sighting 預設不出現在地圖上；切換「顯示全部」後會出現，並標為已過期。
- [ ] 還沒開始倒數的 Sighting 顯示「N 分鐘前看到」，時間會隨時間更新。
- [ ] 歷史頁列出所有功能的 Batch，可以點進去看每個 Waypoint 的結果。
- [ ] 刪除 Batch 時一併刪掉資料庫紀錄與 run 資料夾，並先要求確認。
- [ ] 到期判斷有自動化測試。
