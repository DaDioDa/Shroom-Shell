# pikmin_bloom_shell

在本機網頁上，把手機的 GPS 移到一串座標，逐點呼叫 pikmin_bloom_bot 並把結果視覺化。Target、Sighting、Spot Name、Sweep Area、Quiet Area、Participant Count、Postcard、Unclaimed Mushroom 等詞沿用 pikmin_bloom_bot 的定義，這裡不重複。

## Language

### 座標與移動

**Waypoint**:
使用者存在某份 Waypoint List 裡的經緯度，帶標籤。Postcard Check 的 Waypoint 一定有 Spot Name、沒有半徑；Quiet Giant Search 與 Target Search 的 Waypoint 可選擇附帶自己的半徑。
_Avoid_: Spot（保留給 bot 的 Spot Name）、座標、point、地點

**Waypoint List**:
有名字、有順序的一組 Waypoint，建立時就屬於 Postcard Check、Quiet Giant Search、Target Search 其中一個功能，只能拿來跑那個功能的 Batch。
_Avoid_: Spot List、route、路線

**Teleport**:
把手機的模擬 GPS 設到某個 Waypoint；也可以在 Sighting 卡片上手動 Teleport 到那顆蘑菇（UI 叫「移到這裡」，Batch 執行中不能用）。
_Avoid_: spoof、瞬移、飛

**Region**:
使用者在地圖上框出的矩形範圍，Discovery 在裡面鋪 Grid Cell。

**Grid Cell**:
Discovery 在 Region 內依固定間距鋪出的一個點，只屬於那一次 Discovery。它不是 Waypoint，不會進任何 Waypoint List。
_Avoid_: 把它叫成 Waypoint；UI 上叫「格子」

### 執行

**Batch**:
依序走過一串點一次，對每個點先 Teleport 再執行一次 bot 指令；點來自一份 Waypoint List，或來自 Discovery 的 Grid Cell。跑完一輪就結束，不自動重複。
_Avoid_: loop、job、任務

**Discovery**:
對 Region 內的每個 Grid Cell 跑 Quiet Giant Search 的 Batch，把答案是「是」的範圍顯示出來。要不要把某個範圍收成 Waypoint，由使用者自己決定。

### 功能

**Postcard Mushroom**:
使用者以 GPS 加 Spot Name 存下來、想反覆查看的那一顆蘑菇。種類會隨重生改變，所以不是身分的一部分。
_Avoid_: 美片菇（口語可用，文件與程式碼不用）

**Postcard Check**:
查出每顆 Postcard Mushroom 現在的種類和 Participant Count。UI 上的名稱是「美片菇」。

**Quiet Giant Search**:
找出指定半徑內有巨大蘑菇、而且沒有任何蘑菇有人在打的 Waypoint。對已知 Waypoint 執行是驗證，對 Region 執行就是 Discovery。UI 上的名稱是「無人巨菇」，Discovery 則叫「探索區域」。
_Avoid_: 無人巨菇搜尋（文件與程式碼用英文術語）

**Target Search**:
在每個 Waypoint 附近找使用者指定的 Target，回報有沒有人在打（有人時附人數）以及 Postcard。UI 上的名稱是「指定菇菇」。
_Avoid_: 指定菇菇搜尋（文件與程式碼用英文術語）
