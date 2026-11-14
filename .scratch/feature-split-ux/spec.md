# Spec：功能分流與互動改善

**Status:** ready-for-agent

術語依 `GLOSSARY.md`（本次已更新 Waypoint、Waypoint List、Grid Cell、Batch、Discovery）。本 spec 修改 `.scratch/shell-app/spec.md` 的「Discovery」「Waypoint List 管理」「地圖與畫面」三段；兩者衝突時以本 spec 為準。

## Problem Statement

驗收時發現，Discovery 的點跑進了其他功能：

- 每跑一次 Discovery，就多一份「Discovery 鋪點」Waypoint List，裡面是全部格子。開跑後這份清單還會被設成目前選取的清單。
- 結果是無人巨菇、美片菇、指定菇菇都拿這份格子清單當輸入，地圖在每個分頁都畫出所有格子。
- 在其他分頁點地圖，會把點加進格子清單。
- 答案是「是」的格子會自動進「Discovery：名稱」清單。

根本原因是使用者實際上三個功能各搜各的清單，但 App 把 Waypoint List、選取中的清單和跟隨中的 Batch 都做成全域共用。

另外有幾個操作不順手：

- 數字只能打字。
- Region 畫完不能調整，只能重畫。
- 編輯 Waypoint 要連跳三個 `prompt`。
- 在地圖上隨手一點就會新增 Waypoint。

## Solution

**功能分流**

- 每份 Waypoint List 建立時就屬於一個功能：美片菇、無人巨菇或指定菇菇，只在那個功能的分頁出現、只能跑那個功能。
- 拿掉「座標清單」分頁，清單管理搬進各功能分頁。
- 每個分頁只顯示自己功能的 Batch、結果和地圖圖層。

**Discovery 不再產生 Waypoint**

- Discovery 鋪的是 Grid Cell。格子只跟著那次 Batch 存，不建任何清單。
- 跑完把紅、綠、灰格畫在地圖上。
- 要不要把綠格收進無人巨菇清單，由使用者點綠格後自己決定。

**互動改善**

- 半徑、間距、`--skip-crowded` 改用 slider，旁邊附數字框。
- Region 用 8 個把手（四角加四邊）調大小、對齊整數格，拖本體移動，並即時預覽格子、涵蓋範圍與蛇形路線。
- 點地圖新增改成明確的「新增模式」。
- `prompt`、`confirm`、`alert` 換成畫面內的表單與二次確認。

## User Stories

### 清單屬於功能

1. 身為使用者，我想要建立清單時就決定它屬於美片菇、無人巨菇或指定菇菇，這樣不同用途的座標不會混在一起。
2. 身為使用者，我想要每個功能分頁只列出屬於該功能的清單，這樣選清單時不會看到無關的清單。
3. 身為使用者，我想要在功能分頁裡直接建立、改名、刪除、匯入清單，這樣不必切到另一個分頁管理。
4. 身為使用者，我想要每個功能分頁各自記住選了哪份清單，這樣切換分頁時不會互相影響。
5. 身為使用者，我想要匯入美片菇清單時每行都必須有 `@Spot Name`，缺的那行留在文字框並標出原因，這樣不會存進一份跑不了的清單。
6. 身為使用者，我想要美片菇清單的 Waypoint 不能帶半徑，這樣不會誤以為 `check` 會用到半徑。
7. 身為使用者，我想要無人巨菇和指定菇菇清單的 Waypoint 可以選擇帶半徑，但不能帶 Spot Name，這樣欄位意義清楚。
8. 身為使用者，我想要編輯 Waypoint 時只看到該功能用得到的欄位，這樣不會填錯。
9. 身為使用者，我想要後端拒絕用不屬於該功能的清單開始 Batch，這樣就算畫面出錯也不會用錯清單跑 bot。

### 各分頁各自顯示

10. 身為使用者，我想要每個功能分頁只顯示該功能最近一次或正在跑的 Batch（進度、log、結果），這樣在美片菇分頁不會看到 Discovery 的 log。
11. 身為使用者，我想要底部抽屜仍然顯示目前在跑的 Batch 和整個佇列，這樣不管在哪個分頁都知道手機在忙什麼。
12. 身為使用者，我想要地圖只畫目前分頁選定的清單和該功能的結果，這樣地圖不會被別的功能的標記塞滿。
13. 身為使用者，我想要指定菇菇分頁的地圖只顯示指定菇菇找到的 Sighting，無人巨菇和探索區域分頁只顯示各自 Batch 找到的巨菇 Sighting，這樣看到的 Sighting 跟目前的工作有關。
14. 身為使用者，我想要保留「含已過期 Sighting」的勾選，這樣需要時還是能看到過期的紀錄。
15. 身為使用者，我想要重新整理頁面後，每個分頁還是顯示該功能最近一次的 Batch；如果它還在跑就繼續即時更新，這樣不會因為重新整理就看不到進度。

### 新增模式與編輯

16. 身為使用者，我想要功能分頁有「＋ 在地圖上新增」切換鈕，只有開著時點地圖才會新增 Waypoint，這樣不會因為隨手一點就多了一個點。
17. 身為使用者，我想要新增的 Waypoint 一定加進目前分頁選定的清單，這樣不會加錯地方。
18. 身為使用者，我想要沒有選清單時新增模式不能開，並提示我先選或先建立清單，這樣不會不知道點加到哪裡。
19. 身為使用者，我想要在探索區域和歷史分頁點地圖不會新增任何 Waypoint，這樣框 Region 或查看歷史時不會誤加。
20. 身為使用者，我想要點地圖標記或清單列時，展開一個編輯表單（標籤、半徑 slider、Spot Name），這樣一次就能改完，不必連跳三個對話框。
21. 身為使用者，我想要刪除清單或 Waypoint 時，按鈕先變成「確定刪除？」，再按一次才刪，這樣不會誤刪，也不會跳出瀏覽器對話框。
22. 身為使用者，我想要輸入錯誤（例如半徑不是正數）直接顯示在表單旁邊，這樣知道哪裡要改。

### Slider

23. 身為使用者，我想要用 slider 調整半徑（100～2000 m，步距 50，預設 500），旁邊的數字框也能直接打字，這樣快速調整與精確輸入都可以。
24. 身為使用者，我想要用 slider 調整 Discovery 的間距（200～3000 m，步距 100，預設 1000），這樣不必打字。
25. 身為使用者，我想要有一個「跟半徑連動」的勾選，預設勾起來，勾著時間距固定是 2 × 半徑，這樣格子剛好無縫拼起來。
26. 身為使用者，我想要用 slider 調整 `--skip-crowded`（0～10），在 0 時顯示「不略過」，這樣一看就懂 0 的意思。
27. 身為使用者，我想要在無人巨菇和指定菇菇分頁拉半徑 slider 時，地圖即時在選定清單的每個 Waypoint 周圍畫出 2R 正方形（自帶半徑的 Waypoint 用它自己的半徑），這樣開跑前就知道會掃哪些範圍。
28. 身為使用者，我想要數字框打進超出範圍的值時被夾回範圍內，這樣不會送出不合理的參數。

### Region 編輯

29. 身為使用者，我想要按「放一個 Region」時，在目前地圖中央放一個約 2 km × 2 km（對齊到整數格）的框，這樣不必先學怎麼拖曳畫框。
30. 身為使用者，我想要 Region 有 8 個把手（四個角加四條邊的中點），拖角時對角不動、拖邊時對邊不動，這樣能分別調寬、調高或一起調。
31. 身為使用者，我想要拖 Region 本體來整個移動，大小不變，這樣換地方時不必重畫。
32. 身為使用者，我想要 Region 上即時顯示寬高，例如「3.0 km × 2.0 km」，這樣邊拖邊知道大小。
33. 身為使用者，我想要 Region 的寬高自動對齊到間距的整數倍，每個 Grid Cell 剛好一個間距大小，這樣格子整齊、不會被壓縮。
34. 身為使用者，我想要改間距時，現有的 Region 以中心為準重新對齊整數格，這樣框和格子一直一致。
35. 身為使用者，我想要寬或高超過 10 km 時框變紅、面板顯示「最大 10 km × 10 km，請縮小」、不能開始，但仍然可以繼續拖，這樣拉過頭時看得出原因，不會覺得把手卡住。
36. 身為使用者，我想要拖 Region 或調半徑、間距時，地圖即時畫出每個 Grid Cell 和它涵蓋的 2R 正方形（淡色），這樣能看出有沒有空隙或重疊太多。
37. 身為使用者，我想要地圖畫出蛇形的走訪路線和「起點」標記，這樣知道 Batch 會依什麼順序走。
38. 身為使用者，我想要面板醒目地顯示「欄 × 列 格 = N 點」、預估時間，以及覆蓋提示（「無縫，重疊約 X%」或「有空隙」），這樣決定要不要縮小範圍或調半徑。
39. 身為使用者，我想要超過 30 點時，在面板裡顯示確認按鈕（不跳瀏覽器對話框），這樣不會不小心開跑一個很長的 Batch。
40. 身為使用者，我想要 Discovery 排隊或執行中時 Region 鎖住不能編輯（把手隱藏），這樣畫面上的框和正在跑的範圍一致。
41. 身為使用者，我想要 Region 名稱是選填，留空時自動命名為「探索 YYYY-MM-DD HH:mm」，這樣隨手試跑不必想名字。

### Discovery 結果

42. 身為使用者，我想要 Discovery 不建立任何 Waypoint List，這樣「清單」只放我自己存的點。
43. 身為使用者，我想要 Discovery 的結果以紅、綠、灰格畫在地圖上（是、不是、無法判斷），這樣一眼看出哪裡符合。
44. 身為使用者，我想要點格子時顯示它的答案與原因（例如「有人在打」、找到幾顆巨菇），這樣知道為什麼是這個顏色。
45. 身為使用者，我想要點綠格時有「加入無人巨菇清單…」，可以選一份既有的無人巨菇清單或新建一份，這樣由我決定哪些範圍值得收藏。
46. 身為使用者，我想要加入時用格子中心點加上那次 Discovery 的半徑，新增一個 Waypoint，標籤預設是「探索：Region 名稱 格 N」，這樣之後在無人巨菇分頁驗證時沿用同樣的範圍。
47. 身為使用者，我想要同一個格子重複加入同一份清單時，顯示「已在清單裡」而不新增，這樣清單不會重複。
48. 身為使用者，我想要探索區域分頁預設顯示最近一次或正在跑的 Discovery，這樣跑完回來就看得到結果。

### 歷史

49. 身為使用者，我想要歷史頁可以依功能篩選，這樣快速找到某個功能的過去 Batch。
50. 身為使用者，我想要在歷史頁點一個 Batch 時，地圖畫出它當時走過的點和結果（Discovery 則畫出 Region 與紅、綠、灰格），這樣能回顧過去的結果。
51. 身為使用者，我想要歷史 Discovery 的綠格也能「加入無人巨菇清單…」，這樣以前的探索結果還能拿來用。
52. 身為使用者，我想要就算原本的清單或 Waypoint 已經被刪掉，歷史 Batch 仍然能畫出當時走過的位置，這樣歷史不會因為整理清單而壞掉。

### 記住設定

53. 身為使用者，我想要瀏覽器記住上次的 Region、各 slider 的值、連動勾選和各分頁選的清單，這樣重新整理後不必重設。
54. 身為使用者，我想要這些記憶就算被清掉，頁面照樣能用（回到預設值），這樣不會因為瀏覽器設定而壞掉。

## Implementation Decisions

### 資料模型

- **`waypoint_lists` 加 `feature` 欄位（必填）**：值是 `postcard-check`、`quiet-search`、`target-search` 其中一個，建立後不能改。
- **每次執行記下當時的點**：`waypoint_runs` 改成每筆都存 lat、lng、label、radius。
  - `waypoint_id` 改成可為空，Grid Cell 沒有 Waypoint，就是空的。
  - 歷史與地圖畫結果時用這份記錄，不再回查 waypoints 表（user story 52）。
- **Discovery Batch 的 params 存 Region、半徑、間距、Region 名稱**，不再有 `listId`。`batches.list_id` 與 `list_name` 在 Discovery 為空。
- **Sighting 已經掛在 Batch 上**，依 Batch 的 feature 就能分功能，不必改表。
- **不寫舊資料遷移**：交付前清空 integration worktree 的 `data/app.db` 與 `data/runs/`。裡面只有驗收時跑的 3 個測試 Batch，沒有清單。建表時 `feature` 直接是 NOT NULL。

### Batch 的輸入

- **Batch 走的單位改成「點」，不再只能是 Waypoint**：點的內容是經緯度、標籤、可選的半徑、可選的 Spot Name、可選的 waypointId。
  - 一般功能把清單的 Waypoint 轉成點。
  - Discovery 把 `planDiscovery` 鋪出的 Grid Cell 轉成點，標籤是「格 N」，沒有 waypointId。
- **BatchFeature 介面（plan、interpret、okExitCodes、report）與 runBatch、佇列的行為不變**，只是輸入型別換成點。
- **Discovery 只是另一個 quiet BatchFeature**：拿掉「答案是 true 就收進清單」（collectDiscovered），Discovery 與 Quiet Giant Search 共用解析。

### API 合約

| 端點 | 變更 |
|---|---|
| `POST /api/lists` | body 必須帶 `feature`，缺少或不合法回 400 |
| `GET /api/lists?feature=X` | 只回該功能的清單；不帶 feature 回 400 |
| 新增、修改、匯入 Waypoint | 依所屬清單的 feature 檢查欄位，不合規則回 400 並說明原因；匯入時不合規則的行像現在一樣留在錯誤清單 |
| `POST /api/batches/{postcard-check,quiet-search,target-search}` | 清單的 feature 不符時回 400 |
| `POST /api/batches/discovery` | `name` 變成選填，空的就由後端自動命名；不建立任何清單；回應只有 `{ batchId }` |
| `GET /api/history?feature=X` | 可依功能篩選 |
| `GET /api/history/:id` | 每筆執行附上當時的點；Discovery 另外附上 Region、半徑、間距 |
| `GET /api/sightings?feature=X` | 只回該功能 Batch 的 Sighting；Discovery 與 Quiet Giant Search 各自分開 |
| 每個功能最近一次的 Batch | 前端要能取得，用來在載入時跟隨（user story 15）。可以直接用 `GET /api/history?feature=X` 的第一筆 |

匯入與欄位檢查的規則：

| 功能 | Spot Name | 半徑 |
|---|---|---|
| 美片菇 | 必填 | 不允許 |
| 無人巨菇、指定菇菇 | 不允許 | 選填 |

### shared 新增純函式（前後端共用，可單元測試）

- **Waypoint 欄位規則**：依 feature 檢查一筆 Waypoint，回傳錯誤原因或 OK。`parseWaypoints` 匯入時也套用同一份規則。
- **Region 幾何**：
  - 依中心與邊長產生預設 Region。
  - 對齊整數格：邊長（公尺）→ `max(1, round(邊長 / 間距)) × 間距`。拖角、拖邊、放置、改間距後都套用；改間距時以中心為準重新對齊。
  - 拖某個角：對角固定，兩個方向都對齊整數格。拖某條邊：對邊固定，只改那個方向。都不允許翻面。
  - **不夾 10 km 上限**：上限交給 `planDiscovery` 判斷（框變紅、不能開始）。prototype 試過硬夾住和軟上限兩種，使用者選了軟上限。
  - 整體平移：寬高不變。
  - 現有的 `regionSizeKm` 繼續用來顯示寬高。
- **格子預覽**：由 Region、間距、半徑算出 Grid Cell 與每格的 2R 正方形，沿用 `planDiscovery` 與 `sweepArea`。因為寬高已對齊整數格，`gridPoints` 鋪出的每格剛好一個間距。
- **格子統計**：欄數、列數、點數、實際格子尺寸，以及覆蓋提示。覆蓋提示的規則：
  - 格子邊長大於 2R：「有空隙」
  - 否則：「無縫，重疊約 (2R − 格邊長) / 2R」

  蛇形路線直接用 `gridPoints` 的順序。
- **Slider 規格**：各欄位的 min、max、step、預設值集中定義，加上「把值夾進範圍」的函式。
  - 連動時間距等於 2 × 半徑。半徑最大 2000 時是 4000 m，超過手動 slider 的上限 3000 m。連動時允許這個值，不夾回去。
- **自動命名**：依時間產生「探索 YYYY-MM-DD HH:mm」。

### 前端

- **分頁**：無人巨菇、探索區域、美片菇、指定菇菇、歷史。
- **App 的狀態依功能分開**：每個功能各自有選定的清單和跟隨的 Batch，每個功能一個 BatchView。`reduceBatchView` 不變。
- **清單管理是共用元件**，放進三個功能分頁，參數是 feature。內容包括：
  - 下拉選清單
  - 建立、改名
  - 刪除，用二次確認
  - 匯入，提示文字依 feature 改變
  - Waypoint 列表，可以展開編輯表單
- **地圖改成接收「目前分頁要畫的圖層」**，不再自己決定要畫什麼：

  | 分頁 | 地圖圖層 |
  |---|---|
  | 無人巨菇 | 選定的清單，加上半徑預覽或結果的 Sweep 方格 |
  | 探索區域 | Region 與把手、Grid Cell 預覽或結果格子 |
  | 美片菇 | 選定的清單，加上檢查結果標記 |
  | 指定菇菇 | 選定的清單，加上該功能的 Sighting |
  | 歷史 | 點選的那個 Batch 的結果 |

- **Region 編輯器用 Leaflet 自己做，不加新套件**：
  - 8 個 draggable 的把手 marker（四角加四邊中點）和一個可拖的矩形本體。
  - 拖動時呼叫 shared 的幾何函式取得新的 Region。
  - 把手在拖曳中不重建，只更新位置，否則會打斷拖曳。
  - 矩形上方顯示寬高標籤，超過上限時框和標籤變紅。
  - 預覽格子很多（10 km 配 200 m 約 2500 格），所以用 canvas renderer 畫。
  - 地圖上畫蛇形路線（橘線）和「起點」標記。
  - Discovery 排隊或執行中時把手隱藏、不能拖。
  - 拿掉「拖曳畫矩形」模式。
- **綠格 popup 的「加入無人巨菇清單…」**：
  - 呼叫既有的新增 Waypoint API，帶半徑與預設標籤。
  - 新建清單的話，先用 `feature=quiet-search` 建立。
  - 重複判定：同一份清單裡經緯度與半徑都相同就算重複。可以由後端回 409，或由前端先檢查，二選一，實作時決定。
- **localStorage**：存 Region、各 slider 的值、連動勾選、各分頁選的清單 id。所有讀寫都包 try/catch，失敗就用預設值。
- **拿掉所有 `window.prompt`、`window.confirm`、`window.alert`。**

## Testing Decisions

**好的測試**只透過公開介面驗證外部行為：HTTP 回應、資料庫裡可觀察的結果、純函式的輸入與輸出。不測元件內部狀態或私有函式。測試契約不變：

- **相關測試**：`npx vitest run <files>`
- **回歸測試**：`npm test`
- **完整驗證**：`npm test` + `npm run typecheck` + `npm run build`
- 一律用假 bot。

測試只用三個 seam，都是既有的：

1. **後端 HTTP**：Fastify `inject` 搭配 FakeBotRunner 與記憶體資料庫。涵蓋：
   - 清單 feature 必填與過濾
   - 依 feature 檢查 Waypoint 欄位（新增、修改、匯入）
   - Batch 拒絕用錯功能的清單
   - Discovery 不建任何清單，`waypoint_runs` 記下 Grid Cell 的位置
   - 刪除清單後歷史仍有位置
   - 歷史與 Sighting 依 feature 篩選
   - Discovery 名稱留空時自動命名

   可參考 `server/src/app.test.ts`、`server/src/batch/discovery.test.ts`、`listDeletion.test.ts`、`quietSearch.test.ts`、`history.test.ts`。
2. **shared 純函式**：涵蓋：
   - 依 feature 的 Waypoint 規則，以及 `parseWaypoints` 依 feature 匯入
   - Region 拖角與拖邊：對邊或對角固定、對齊整數格、不翻面、改間距重新對齊
   - Region 平移
   - 預設 Region
   - 格子預覽、格子統計與覆蓋提示
   - slider 夾值與連動間距
   - 自動命名

   可參考 `shared/src/discovery.test.ts`、`parseWaypoints.test.ts`、`sweepArea.test.ts`。
3. **前端畫面**：照現有契約不寫自動化測試，交給人類驗收。要驗的有：
   - Region 拖角與平移的手感
   - slider
   - 新增模式
   - popup 表單
   - 二次確認
   - 各分頁的地圖圖層
   - 綠格加入清單
   - 重新整理後的狀態

## Out of Scope

- 視覺風格，包括配色、字型、版面美化。之後另開一輪。
- 無人巨菇的 `--target`（`quiet` 支援，這次維持預設的 `"巨大 *"`）。
- 把清單複製或搬到其他功能。
- 舊資料遷移：改成清空測試資料。
- 矩形以外的 Region 形狀、多個 Region 同時跑。
- 手機或觸控操作。
- 上一輪 review 的 advisory：參數開頭是 `-`、Host header／DNS rebinding、server crash 後 GPS 沒恢復、BatchHub 記憶體成長、`TELEPORT_WAIT_MS` 是 NaN、QueueJob 命名。

## Further Notes

- **Region 編輯器 prototype（已完成）**：
  - 比較了三種做法：A 四角把手（硬上限）、B 面板 slider 調寬高、C 格子對齊（8 把手、軟上限、蛇形路線）。
  - 2026-11-15 使用者選 C，上面的「Region 編輯」已照 C 改寫。
  - 原始碼留在 throwaway 分支 `proto/region-editor`（`web/src/prototype/RegionEditorPrototype.tsx`），可當拖曳把手、canvas 預覽的參考，但要重寫，不要直接搬進 integration。
- **連動間距的上限**：grill 時定的間距範圍是 200～3000 m。連動時 2 × 半徑最大到 4000 m，所以只有連動時允許超過 3000。
- **整合方式**：本 spec 沿用 spec-foreman run `spec-foreman-reodht8g`，在 `integration` 分支上接續。上一版 `ee1e575` 的人類驗收視為退回。
- **切票**：已切成 8 張，放在 `.scratch/feature-split-ux/issues/01–08`，2026-11-15 使用者確認。
  - 依賴關係：
    - 01、03 沒有前置
    - 02 ← 01
    - 04 ← 01、03
    - 05 ← 02、04
    - 06 ← 04
    - 07 ← 01、03、04
    - 08 ← 06、07
  - 清空 `data/` 測試資料不開票，由 Main 在交付前執行。
