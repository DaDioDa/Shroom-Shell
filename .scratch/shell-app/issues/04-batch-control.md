# 04: Batch 控制與防護

**What to build:** 讓 Batch 可以安全地排隊、取消，並撐過出錯：

- **佇列**：多個 Batch 依 FIFO 排隊，手機同時只跑一個。網頁的底部抽屜顯示目前的 Batch 和佇列。
- **取消**：預設「跑完目前這個 Waypoint 就停」，讓 bot 自己收尾。另有「強制停止」，立刻 kill bot 的程序，UI 要明講可能留下遊戲開著、螢幕沒鎖。也可以把還在排隊的 Batch 移出佇列。
- **單點出錯**：某個 Waypoint 的 bot exit 2 就標成失敗，附上 `abort.txt` 的原因和 `abort.png`，然後繼續下一個 Waypoint。
- **adb 斷線**：找不到裝置時整個 Batch 停下，並標明原因。
- **結束時**：不論正常結束、取消、強制停止或失敗，最後都恢復真實 GPS。
- **開跑前檢查**：如果有其他模擬定位 App 正在運作（例如 `com.xmap.bluemap`），Batch 不開始，並在網頁提示使用者先關掉。

**Blocked by:** 03（Target Search 第一條完整流程）

**Status:** ready-for-agent

- [ ] 同時送出兩個 Batch，第二個會等第一個跑完才開始，網頁顯示它在排隊。
- [ ] 「跑完目前這點就停」會等 bot 正常結束，不再跑下一個 Waypoint。
- [ ] 「強制停止」會立刻結束 bot 的程序，UI 先警告再執行。
- [ ] 單一 Waypoint exit 2 時標成失敗，顯示原因與截圖，Batch 繼續。
- [ ] adb 斷線時 Batch 停下並顯示原因。
- [ ] 以上每種結束方式都會恢復真實 GPS（自動化測試用假的 Teleport 驗證有呼叫）。
- [ ] 偵測到其他模擬定位 App 時拒絕開始，並顯示是哪個 App。
- [ ] 有自動化測試，用假 bot 涵蓋：佇列順序、兩種取消、單點失敗後繼續、斷線停止。
