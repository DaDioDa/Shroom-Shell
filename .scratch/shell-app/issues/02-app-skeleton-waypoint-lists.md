# 02: App 骨架與 Waypoint List

**What to build:** 執行一個指令，前後端就一起啟動。打開本機網頁會看到一張地圖。使用者可以建立有名字的 Waypoint List，貼上多行 `lat,lng 標籤` 匯入 Waypoint，在地圖上看到這些 Waypoint，重開 App 後資料還在。這張 ticket 也要把 spec「技術」一節的 workspace 結構（server、web、shared）、SQLite、只綁 `127.0.0.1` 一次立好，後面的 ticket 都建在這上面。

術語依 `GLOSSARY.md`，細節見 `.scratch/shell-app/spec.md`。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 一個 npm 指令就能同時啟動前後端；後端只綁 `127.0.0.1`。
- [ ] 可以建立、改名、刪除 Waypoint List。
- [ ] 可以貼上多行 `lat,lng [標籤]` 匯入 Waypoint，壞掉的行要列出來，不能默默略過。
- [ ] 選一份 Waypoint List 時，地圖上會標出它的 Waypoint，標記會顯示標籤。
- [ ] 資料存在 SQLite，重開 App 後還在。
- [ ] 匯入時的文字解析有自動化測試。
- [ ] 既有的 Teleport 工具仍可用。
