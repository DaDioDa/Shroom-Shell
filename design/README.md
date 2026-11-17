# 設計稿

靜態的 UI 設計頁，給人看、不是 App 本身，也不和 `web/` 共用程式碼。

- `system/theme.ts`：顏色、字體、圓角、形狀，全部只在這裡定義。
- `system/components/`：共用元件（UI 元件、地圖示意、整體畫面）。
- `system/pages/<頁面>.tsx`：每頁匯出 `title` 與 `Body`。
- `pages/<頁面>.html`：建置輸出，不進 git，不要手改。

建置：`npm run design`。輸出含任何 JavaScript（`<script>`、`on*=`、`javascript:`）會讓建置失敗。
