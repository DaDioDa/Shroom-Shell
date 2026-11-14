# 05: Postcard Check

**What to build:** Waypoint 可以填 Spot Name，代表一顆 Postcard Mushroom。新增或匯入時，網頁提醒「GPS 要夠準，`check` 只看冷啟動後的起點畫面」。

使用者在 Postcard Check 分頁選一份 Waypoint List 開始 Batch，每個 Waypoint 先 Teleport，再跑 `check --spot-name "<Spot Name>"`（帶 `--runs-dir`）。結果依 exit code 分三種：

- **`0` 找到**：顯示種類、Participant Count（`0` 顯示「無人」，`null` 顯示「人數不明」）、到期時間或「尚未開始倒數」、起點畫面截圖、Postcard。
- **`1` 沒找到**：顯示「起點畫面上沒有這個 Spot Name」；`unread > 0` 時加註「可能有 N 顆沒讀到」。
- **`2` 中止或沒讀完**：標成「沒讀完」，顯示 `reason`，並照樣顯示已讀到的欄位，例如種類與人數。

`check` 的完整輸出格式以 pikmin_bloom_bot 的 `docs/cli.md` 為準。

**Blocked by:** 03（Target Search 第一條完整流程）

**Status:** ready-for-agent

- [ ] Waypoint 可以填 Spot Name；匯入格式支援 Spot Name 欄，寫法要寫在 UI 上。
- [ ] Waypoint 缺 Spot Name 時不能開始 Postcard Check，並指出是哪幾個。
- [ ] 三種結果都有對應的卡片樣式，地圖標記也能分辨。
- [ ] 用真 bot 和實機對至少一顆 Postcard Mushroom 跑通。
- [ ] 有自動化測試，用假 bot 涵蓋 exit 0、1（含 `unread`）、2（含部分欄位）的解析與顯示資料。
