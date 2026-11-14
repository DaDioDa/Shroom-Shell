# 07：Discovery 改用 Grid Cell

**What to build:** Discovery 不再建立任何 Waypoint List。Region 鋪出的 Grid Cell 只跟著那次 Batch 存，結果以紅、綠、灰格畫在探索區域分頁。要把綠格收進清單，由使用者點綠格後自己決定。歷史裡的 Discovery 也能這樣加入。這張先沿用現有的拖曳畫框，Region 編輯器在 08。對應 spec user story 41–48、51。

**Blocked by:** 01、03、04

**Status:** ready-for-agent

- [ ] 開始 Discovery 不會建立任何清單，包括「Discovery 鋪點」與「Discovery：名稱」；只回傳 batchId
- [ ] Batch 依序走 Grid Cell（標籤「格 N」，沒有 waypointId），執行紀錄存下每格位置；params 存 Region、半徑、間距、名稱
- [ ] Region 名稱選填；留空時自動命名為「探索 YYYY-MM-DD HH:mm」
- [ ] 答案是 true 的格子不再自動加進任何清單
- [ ] 探索區域分頁預設顯示最近一次或正在跑的 Discovery：Region 外框加上紅、綠、灰格；點格子顯示答案與原因
- [ ] 點綠格有「加入無人巨菇清單…」：可以選一份既有的無人巨菇清單，或輸入名稱新建一份。加入的 Waypoint 是格子中心、半徑是那次 Discovery 的半徑，標籤是「探索：名稱 格 N」
- [ ] 同一份清單裡經緯度與半徑都相同時，顯示「已在清單裡」，不重複新增
- [ ] 歷史頁點 Discovery Batch 時，畫出 Region 與格子，綠格同樣可以加入
- [ ] 後端測試涵蓋：
  - Discovery 後清單數不變
  - 執行紀錄有每格位置
  - 名稱留空時自動命名
  - 重複加入不會新增
