# 03：每次執行記下當時的點（prefactor）

**What to build:** Batch 依序走的單位從「Waypoint」改成「點」，內容是經緯度、標籤、可選的半徑、可選的 Spot Name、可選的 waypointId。每次執行都把當時的點記下來，所以就算清單或 Waypoint 之後被刪掉，歷史仍保有當時的位置。畫面行為不變；這張是 07 Discovery 改用 Grid Cell 的前置。對應 spec user story 52。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] runBatch 與 BatchFeature 吃「點」；三個功能把清單的 Waypoint 轉成點，佇列、取消、出錯、解析的行為都不變
- [ ] 每筆執行紀錄存下當時的 lat、lng、label、radius；waypointId 可以是空的
- [ ] 歷史詳情回傳每筆執行當時的點
- [ ] 前端畫結果（Sweep 方格、美片菇檢查標記）改用執行紀錄裡的點，不再回查目前清單
- [ ] 資料庫建表直接用新結構，不寫舊資料遷移（交付前會清空 data/）
- [ ] 既有後端測試全部通過；新增測試：刪掉清單後，歷史詳情仍有每筆的位置
