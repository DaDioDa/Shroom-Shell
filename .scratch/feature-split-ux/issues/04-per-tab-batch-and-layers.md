# 04：分頁各自的 Batch 與地圖圖層

**What to build:** 每個功能分頁只顯示自己功能最近一次或正在跑的 Batch，包括進度、log 和結果；重新整理後會接回去。地圖只畫目前分頁的圖層與該功能的 Sighting。歷史頁可以依功能篩選，點一個 Batch 時把它的結果畫在地圖上。底部抽屜維持全域。對應 spec user story 10–15、49、50。

**Blocked by:** 01、03

**Status:** ready-for-agent

- [ ] 歷史列表可以依功能篩選
- [ ] Sighting 列表可以依功能篩選；Discovery 與無人巨菇的 Sighting 分開
- [ ] 前端每個功能各自跟隨一個 Batch；在某個分頁開跑，不會改變其他分頁顯示的 Batch
- [ ] 載入頁面時，各分頁顯示該功能最近一次的 Batch；如果它還在跑，就繼續即時更新
- [ ] 地圖依分頁畫：
  - 無人巨菇：清單加上 Sweep 方格
  - 美片菇：清單加上檢查標記
  - 指定菇菇：清單加上該功能的 Sighting
  - 探索區域：Region 與結果格子
  - 歷史：點選的那個 Batch 的結果
- [ ] 保留「含已過期 Sighting」的勾選，作用在目前分頁的 Sighting
- [ ] 底部抽屜仍然顯示目前在跑的 Batch 與整個佇列
- [ ] 後端測試涵蓋歷史與 Sighting 依功能篩選
