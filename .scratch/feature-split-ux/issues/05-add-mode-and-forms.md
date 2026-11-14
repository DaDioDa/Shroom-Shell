# 05：新增模式與表單

**What to build:** 點地圖新增 Waypoint 改成明確的「＋ 在地圖上新增」模式。編輯 Waypoint 改成畫面內的表單，刪除改成二次確認，錯誤直接顯示在表單旁。整個 App 不再出現 prompt、confirm、alert。對應 spec user story 16–22。

**Blocked by:** 02、04

**Status:** ready-for-agent

- [ ] 功能分頁有「＋ 在地圖上新增」切換鈕：開著時點地圖會把 Waypoint 加進目前分頁選定的清單，關著時點地圖不做任何事
- [ ] 沒選清單時新增模式不能開，並提示先選或先建立清單；探索區域和歷史分頁點地圖不會新增
- [ ] 點地圖標記或清單列會展開編輯表單，欄位依功能決定（標籤、半徑或 Spot Name），一次儲存
- [ ] 刪除清單或 Waypoint：第一次按顯示「確定刪除？」，再按一次才刪；點別處或過幾秒就取消
- [ ] 欄位錯誤（例如半徑不是正數、後端回的原因）顯示在表單旁
- [ ] 改清單名稱和 Discovery 超過 30 點的確認，也不再用瀏覽器對話框
- [ ] web 原始碼裡沒有 `window.prompt`、`window.confirm`、`window.alert`
