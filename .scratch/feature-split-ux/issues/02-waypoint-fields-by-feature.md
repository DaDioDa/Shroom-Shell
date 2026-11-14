# 02：Waypoint 欄位依功能檢查

**What to build:** Waypoint 能填哪些欄位依所屬清單的功能決定。美片菇必須有 Spot Name、不能有半徑；無人巨菇和指定菇菇不能有 Spot Name、半徑選填。匯入、新增、修改走同一份規則，畫面只顯示該功能用得到的欄位。對應 spec user story 5–8。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] shared 有一個依功能檢查 Waypoint 欄位的純函式，回傳 OK 或中文原因
- [ ] 匯入套用同一份規則；不合規則的行留在錯誤清單，並附中文原因（例如「美片菇需要 @Spot Name」「無人巨菇不使用 Spot Name」）
- [ ] 新增、修改 Waypoint 的 API 依清單功能檢查，不合規則回 400 並附原因
- [ ] 匯入的說明文字和 placeholder 依功能顯示對應格式
- [ ] 編輯 Waypoint 時只問該功能用得到的欄位；這張沿用現有的 prompt，表單化在 05
- [ ] shared 測試涵蓋三個功能的規則與匯入；後端測試涵蓋新增、修改、匯入被拒的情況
