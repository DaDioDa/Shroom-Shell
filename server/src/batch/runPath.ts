import { basename, join, resolve, sep } from "node:path";

/** run 資料夾名稱只認單一路徑段，而且解析後必須真的在 runsDir 底下；否則回 null。 */
export function safeRunPath(runsDir: string, name: string | null): string | null {
  if (!name || name === "." || name === ".." || basename(name) !== name || name.includes("/") || name.includes("\\")) return null;
  const root = resolve(runsDir);
  const full = resolve(join(root, name));
  return full.startsWith(root + sep) ? full : null;
}
