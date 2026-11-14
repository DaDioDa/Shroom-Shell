# 06：Slider 與半徑預覽

**What to build:** 半徑和 `--skip-crowded` 改用 slider 加數字框。在無人巨菇和指定菇菇分頁拉半徑時，地圖即時在選定清單的每個 Waypoint 周圍畫出 2R 正方形。slider 的值和各分頁選的清單存在瀏覽器，重新整理後還在。對應 spec user story 4（保存部分）、23、26–28、53–54（Region 以外的部分）。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] shared 集中定義 slider 規格（min、max、step、預設值），並提供夾值函式：
  - 半徑：100～2000、步距 50、預設 500
  - 間距：200～3000、步距 100、預設 1000
  - `--skip-crowded`：0～10，預設 0
- [ ] 共用的 Slider 元件：slider 加數字框；數字框打超出範圍的值，按 Enter 或離開時夾回範圍
- [ ] 無人巨菇、指定菇菇的半徑，以及指定菇菇的 `--skip-crowded` 改用 Slider；`--skip-crowded` 在 0 時顯示「不略過」
- [ ] 拉半徑時，地圖即時在選定清單的每個 Waypoint 周圍畫 2R 正方形；Waypoint 自帶半徑時用它自己的
- [ ] localStorage 記住各 slider 的值與各分頁選的清單 id；讀寫都包 try/catch，失敗就用預設值；記住的清單已被刪除時，當作沒選
- [ ] shared 測試涵蓋夾值與預設值
