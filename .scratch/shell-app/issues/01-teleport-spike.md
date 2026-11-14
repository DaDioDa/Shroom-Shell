# 01 — 用 adb 對實機做 Teleport 並讓使用者驗證

Status: resolved
Type: task

## 背景

術語依 `GLOSSARY.md`。網頁 App 的每個 Batch 都要先 Teleport 再呼叫 pikmin_bloom_bot。動工做網頁之前，先確認實機上 Teleport 可行，而且遊戲會接受模擬位置。

已知環境：

- 手機：ASUS ROG Phone 2（`ASUS_I01WD`），Android 10，序號 `K8AIGF00B108BV4`
- adb：`C:\Users\darkl\AppData\Local\Android\Sdk\platform-tools\adb.exe`，不在 PATH
- 使用者確認：遊戲沒有冷卻或速度鎖，接受 mock provider 的位置

## 做法

1. 從 GitHub release 下載 Appium Settings（`io.appium.settings`）的 APK，用 adb 安裝。
2. 用 `appops set io.appium.settings android:mock_location allow` 授權。必要時在開發人員選項把它設成模擬位置應用程式，並把需要手動操作的步驟寫清楚給使用者。
3. 在本 repo 寫一支 TypeScript 小工具：
   - `teleport <lat> <lng>`：設定模擬位置
   - `teleport --stop`：停止模擬，恢復真實 GPS

   adb 路徑從設定讀取，預設用上面那個路徑。

## 驗收

- [ ] 使用者執行 `teleport` 到兩個相距很遠的座標，每次開遊戲時人物都出現在該座標。
- [ ] 讓遊戲在 Teleport 之後才冷啟動，等 5 秒就能拿到新位置。如果 5 秒不夠，記下實際需要幾秒。
- [ ] 在另一支地圖 App 上也能看到位置被改掉，用來確認系統層級真的生效。
- [ ] `teleport --stop` 之後，位置回到真實 GPS。
- [ ] 把實際步驟、遇到的坑、需要多少等待秒數記在本檔的 `## Comments`。

## Comments

### 2026-11-14 agent：系統層級已驗證，等使用者在遊戲內驗證

**安裝**

- Appium Settings v8.2.1（`settings_apk-debug.apk`，SHA256 `E4024B3E…375F`）用 `adb install -r -g` 安裝，`-g` 一次給齊位置權限。
- 執行 `appops set io.appium.settings android:mock_location allow`。不需要到開發人員選項手動設定。

**遇到的坑**

1. **剛安裝完 `start-foreground-service` 回 `Error: Not found`**：先 `am start -n io.appium.settings/.Settings` 開一次主畫面就好了。`Teleporter` 已經自動處理。注意不要用 `am start -W`：螢幕鎖著時會一直卡住。
2. **另一個模擬定位 App `com.xmap.bluemap` 在跑**：它的位置蓋掉了 Appium 的。使用者手動關掉後才正常。`teleport` 現在會先列出其他正在運作的模擬定位 App 並警告。
3. **bluemap 停掉時會移除系統的 test provider**：還活著的 Appium LocationService 會一直報 `Provider "gps" unknown`。重啟 LocationService 就恢復。`Teleporter` 的做法是：第一次下指令 4 秒內沒到位，就重啟服務再試一次。

**實測**（`dumpsys location` 的 gps / fused / network 三個 provider 都看得到）

- Teleport 到台北 101 和高雄都成功，從下指令到手機回報新位置約 **200 ms**。
- 服務還在跑時，直接送新座標就會更新，不需要重啟。
- `teleport --stop` 之後 mock provider 消失，位置回到真實 GPS（wifi 定位）。

**工具**

- 模組：`server/src/device/adb.ts`、`server/src/device/teleporter.ts`
- 指令：`npm run teleport -- <lat> <lng>`、`-- --stop`、`-- --status`

**還沒驗**：遊戲內人物位置、等待秒數，以及其他地圖 App 是否也跟著改，都需要使用者看畫面確認。

### 2026-11-14 使用者驗證結果

- 遊戲接受模擬位置，人物出現在 Teleport 的座標。✅
- Google Maps 也跟著改。✅
- bot 的腳本一律冷啟動，所以不評估「遊戲執行中即時 Teleport」或改用 `sweep`。
- 等待秒數：使用者沒有實測。位置約 200 ms 就到位，而 bot 冷啟動本身就要先關遊戲、開遊戲、等載入，所以遊戲啟動時位置早已更新。結論是維持預設 5 秒當保險，可在設定調整。
