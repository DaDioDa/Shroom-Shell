/**
 * 把 design/system/pages/*.tsx 渲染成靜態 HTML，輸出到 design/pages/。
 * 輸出不得含 JavaScript；找到就讓建置失敗。
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { css } from "./system/styles.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "system", "pages");
const outDir = join(here, "pages");
mkdirSync(outDir, { recursive: true });

const FONTS = "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Nunito:wght@600;700;800&display=swap";
const FORBIDDEN = [/<script\b/i, /\son[a-z]+\s*=/i, /javascript:/i];

const files = readdirSync(srcDir).filter((f) => f.endsWith(".tsx")).sort();
for (const f of files) {
  const mod = (await import(pathToFileURL(join(srcDir, f)).href)) as { title: string; Body: ComponentType };
  const body = renderToStaticMarkup(<mod.Body />);
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>${mod.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="${FONTS}" />
<style>${css}</style>
</head>
<body>${body}</body>
</html>
`;
  const bad = FORBIDDEN.find((re) => re.test(html));
  if (bad) throw new Error(`${f}: 輸出含有 JavaScript（${bad}），設計稿必須是純靜態 HTML`);
  const out = join(outDir, f.replace(/\.tsx$/, ".html"));
  writeFileSync(out, html);
  console.log(`built ${out}`);
}
