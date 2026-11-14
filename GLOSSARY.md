# pikmin_bloom_shell

在本機網頁上，把手機的 GPS 移到一串座標，逐點呼叫 pikmin_bloom_bot 並把結果視覺化。Target、Sighting、Spot Name、Sweep Area、Quiet Area、Participant Count、Postcard、Unclaimed Mushroom 等詞沿用 pikmin_bloom_bot 的定義，這裡不重複。

## Language

### 座標與移動

**Waypoint**:
一個存起來的經緯度，帶標籤，可選擇附帶自己的半徑；是 Batch 依序造訪的一個點。
_Avoid_: Spot（保留給 bot 的 Spot Name）、座標、point、地點

**Waypoint List**:
有名字、有順序的一組 Waypoint，是 Batch 的輸入。
_Avoid_: Spot List、route、路線

**Teleport**:
把手機的模擬 GPS 設到某個 Waypoint。
_Avoid_: spoof、瞬移、飛

**Region**:
使用者在地圖上框出的矩形範圍，用來產生 Discovery 的 Waypoint。

### 執行

**Batch**:
依序走過一份 Waypoint List 一次，對每個 Waypoint 先 Teleport 再執行一次 bot 指令。跑完一輪就結束，不自動重複。
_Avoid_: loop、job、任務

**Discovery**:
在 Region 內依固定間距鋪出 Waypoint，再對這些 Waypoint 跑 Quiet Giant Search 的 Batch。

### 功能

**Postcard Mushroom**:
使用者以 GPS 加 Spot Name 存下來、想反覆查看的那一顆蘑菇。種類會隨重生改變，所以不是身分的一部分。
_Avoid_: 美片菇（口語可用，文件與程式碼不用）

**Postcard Check**:
查出每顆 Postcard Mushroom 現在的種類和 Participant Count。

**Quiet Giant Search**:
找出指定半徑內有巨大蘑菇、而且沒有任何蘑菇有人在打的 Waypoint。對已知 Waypoint 執行是驗證，對 Region 執行就是 Discovery。
_Avoid_: 無人巨菇搜尋

**Target Search**:
在每個 Waypoint 附近找使用者指定的 Target，回報有沒有人在打（有人時附人數）以及 Postcard。
_Avoid_: 指定菇菇搜尋
