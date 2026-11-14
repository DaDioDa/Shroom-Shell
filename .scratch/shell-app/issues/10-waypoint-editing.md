# 10: Waypoint List 進階編輯

**What to build:**

- **Google Maps 連結**：貼上 Google Maps 連結（含 `?q=lat,lng`、`@lat,lng,zoom` 等常見格式）時，自動解析出經緯度並建立 Waypoint；短網址解析不了就明講。
- **地圖編輯**：在地圖上點一下就能在目前的 Waypoint List 新增 Waypoint，點已有的標記可以改標籤、半徑、Spot Name，或刪除。也可以調整 Waypoint 的順序。

**Blocked by:** 02（App 骨架與 Waypoint List）

**Status:** ready-for-agent

- [ ] 常見的 Google Maps 連結格式能解析出經緯度，有自動化測試；解析不了的連結會列出來。
- [ ] 點地圖就能新增 Waypoint，並馬上存進 SQLite。
- [ ] 點標記可以編輯標籤、半徑、Spot Name，或刪除 Waypoint。
- [ ] 可以調整 Waypoint 順序，Batch 會照新順序走。
