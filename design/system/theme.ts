/**
 * 設計稿唯一的主題值來源：顏色、字體、圓角、形狀。
 * 01-visual-directions 並排比較三個方向；選定後，選中的方向就是 App 的主題。
 */

export type ButtonEdge = "none" | "pressed";
export type TabStyle = "segmented" | "underline";
export type HeadingStyle = "leaf" | "centered-bilingual" | "label-bilingual";
export type CardStyle = "rounded" | "ruled";
export type DrawerStyle = "floating" | "bar";

export interface Theme {
  id: "a" | "b" | "c";
  name: string;
  /** 一行說明，畫在頁邊。 */
  tagline: string;
  color: {
    /** 面板底色。 */
    panelBg: string;
    surface: string;
    ink: string;
    muted: string;
    border: string;
    borderStrong: string;
    primary: string;
    primaryHover: string;
    onPrimary: string;
    /** 按鈕底部的「壓下去」邊；ButtonEdge 為 none 時不用。 */
    primaryEdge: string;
    primaryTint: string;
    /** 寫在白底或 primaryTint 上的主色文字（AA 4.5:1 以上）。 */
    primaryInk: string;
    /** 只用於裝飾（花心、Logo），不承載資訊。 */
    accent: string;
    marker: string;
    /** 輸入框聚焦的邊框與光暈；不可和 danger 同色，免得像錯誤。 */
    focus: string;
    focusRing: string;
    danger: string;
    dangerTint: string;
    disabledBg: string;
    disabledInk: string;
    logBg: string;
    logInk: string;
  };
  font: { body: string; heading: string; brand: string };
  radius: { control: string; button: string; card: string; drawer: string };
  shape: { buttonEdge: ButtonEdge; tabs: TabStyle; heading: HeadingStyle; card: CardStyle; drawer: DrawerStyle };
}

/** 三個方向共用：Sweep Area 的答案顏色（地圖與卡片），以及 2R 預覽框。 */
export const verdict = {
  yes: { fill: "#2F9E44", tint: "#EBFBEE", ink: "#237A35", label: "是", icon: "check" },
  no: { fill: "#E03131", tint: "#FFF0F0", ink: "#C92A2A", label: "不是", icon: "cross" },
  unknown: { fill: "#868E96", tint: "#F1F3F5", ink: "#495057", label: "無法判斷", icon: "question" },
} as const;
export type Verdict = keyof typeof verdict;
export const preview = { stroke: "#1971C2" };

/** OpenStreetMap 標準圖磚的顏色；地圖底圖不隨主題變。 */
export const osm = { land: "#F2EFE9", park: "#CDEBB0", water: "#AAD3DF", road: "#FFFFFF", roadEdge: "#D6D3CC", major: "#FCD6A4", majorEdge: "#E3B97F", building: "#E0DAD0" };

const NOTO = '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';
const ROUNDED = `"Nunito", ${NOTO}`;

export const themes: Theme[] = [
  {
    id: "a",
    name: "A　花園（Pikmin Bloom 為主）",
    tagline: "薄荷綠＋奶油色、膠囊按鈕帶壓下去的邊、膠囊分頁。最活潑，資訊密度最低。",
    color: {
      panelBg: "#FBF7EC",
      surface: "#FFFFFF",
      ink: "#23302A",
      muted: "#5C6B63",
      border: "#E6E0CC",
      borderStrong: "#CFC7AE",
      primary: "#12874F",
      primaryHover: "#0F7A47",
      onPrimary: "#FFFFFF",
      primaryEdge: "#0B6339",
      primaryTint: "#E3F5EA",
      primaryInk: "#0F7A47",
      accent: "#FFC93C",
      marker: "#12874F",
      focus: "#12874F",
      focusRing: "#E3F5EA",
      danger: "#C92A2A",
      dangerTint: "#FFF0F0",
      disabledBg: "#ECE7D8",
      disabledInk: "#8A8F86",
      logBg: "#24332B",
      logInk: "#DDE8E1",
    },
    font: { body: ROUNDED, heading: ROUNDED, brand: ROUNDED },
    radius: { control: "12px", button: "999px", card: "16px", drawer: "18px" },
    shape: { buttonEdge: "pressed", tabs: "segmented", heading: "leaf", card: "rounded", drawer: "floating" },
  },
  {
    id: "b",
    name: "B　任天堂（白底紅色）",
    tagline: "白底、紅色主色、直角按鈕、置中雙語標題、細線分隔。最俐落，但紅色和「不是」撞色。",
    color: {
      panelBg: "#FFFFFF",
      surface: "#FFFFFF",
      ink: "#333333",
      muted: "#6B6B6B",
      border: "#E5E5E5",
      borderStrong: "#C8C8C8",
      primary: "#E60012",
      primaryHover: "#C4000F",
      onPrimary: "#FFFFFF",
      primaryEdge: "#E60012",
      primaryTint: "#FDECEE",
      primaryInk: "#C4000F",
      accent: "#E60012",
      marker: "#333333",
      focus: "#333333",
      focusRing: "#E5E5E5",
      danger: "#C4000F",
      dangerTint: "#FDECEE",
      disabledBg: "#EEEEEE",
      disabledInk: "#8C8C8C",
      logBg: "#2B2B2B",
      logInk: "#E0E0E0",
    },
    font: { body: NOTO, heading: NOTO, brand: NOTO },
    radius: { control: "2px", button: "2px", card: "0", drawer: "0" },
    shape: { buttonEdge: "none", tabs: "underline", heading: "centered-bilingual", card: "ruled", drawer: "bar" },
  },
  {
    id: "c",
    name: "C　混搭（綠色＋任天堂的版面）",
    tagline: "Pikmin 的綠與圓角，配任天堂的雙語小標、底線分頁與細線。紅色只留給危險操作與「不是」。",
    color: {
      panelBg: "#FFFFFF",
      surface: "#FFFFFF",
      ink: "#23302A",
      muted: "#5C6B63",
      border: "#E3EAE5",
      borderStrong: "#C5D1C9",
      primary: "#12874F",
      primaryHover: "#0F7A47",
      onPrimary: "#FFFFFF",
      primaryEdge: "#0B6339",
      primaryTint: "#E9F6EE",
      primaryInk: "#0F7A47",
      accent: "#FFC93C",
      marker: "#12874F",
      focus: "#12874F",
      focusRing: "#E3F5EA",
      danger: "#C92A2A",
      dangerTint: "#FFF0F0",
      disabledBg: "#EEF1EF",
      disabledInk: "#87908A",
      logBg: "#24332B",
      logInk: "#DDE8E1",
    },
    font: { body: NOTO, heading: ROUNDED, brand: ROUNDED },
    radius: { control: "8px", button: "999px", card: "10px", drawer: "14px" },
    shape: { buttonEdge: "pressed", tabs: "underline", heading: "label-bilingual", card: "rounded", drawer: "floating" },
  },
];

/** App 的主題：2026-11-17 從 01-visual-directions 選定 A。 */
export const appTheme: Theme = themes[0];

/** 主題轉成掛在 mock-up 根元素上的 CSS 變數。 */
export function themeVars(t: Theme): Record<string, string> {
  const c = t.color;
  return {
    "--panel-bg": c.panelBg,
    "--surface": c.surface,
    "--ink": c.ink,
    "--muted": c.muted,
    "--border": c.border,
    "--border-strong": c.borderStrong,
    "--primary": c.primary,
    "--primary-hover": c.primaryHover,
    "--on-primary": c.onPrimary,
    "--primary-edge": c.primaryEdge,
    "--primary-tint": c.primaryTint,
    "--primary-ink": c.primaryInk,
    "--accent": c.accent,
    // 聚焦框：主色是紅色時改用深色，免得和錯誤框混淆。
    "--focus": c.focus,
    "--focus-ring": c.focusRing,
    "--marker": c.marker,
    "--danger": c.danger,
    "--danger-tint": c.dangerTint,
    "--disabled-bg": c.disabledBg,
    "--disabled-ink": c.disabledInk,
    "--log-bg": c.logBg,
    "--log-ink": c.logInk,
    "--font-body": t.font.body,
    "--font-heading": t.font.heading,
    "--font-brand": t.font.brand,
    "--r-control": t.radius.control,
    "--r-button": t.radius.button,
    "--r-card": t.radius.card,
    "--r-drawer": t.radius.drawer,
    "--btn-edge": t.shape.buttonEdge === "pressed" ? `0 3px 0 ${c.primaryEdge}` : "none",
    "--yes": verdict.yes.fill,
    "--yes-tint": verdict.yes.tint,
    "--yes-ink": verdict.yes.ink,
    "--no": verdict.no.fill,
    "--no-tint": verdict.no.tint,
    "--no-ink": verdict.no.ink,
    "--unknown": verdict.unknown.fill,
    "--unknown-tint": verdict.unknown.tint,
    "--unknown-ink": verdict.unknown.ink,
  };
}

/** 設計稿頁面本身（紙張）的顏色，不屬於 App。 */
export const doc = { bg: "#F1F2F4", ink: "#1F2328", muted: "#57606A", rule: "#D0D7DE", font: NOTO };
