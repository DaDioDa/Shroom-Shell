/** 「巨菇」快捷按鈕填入的 Target：任何種類的巨大蘑菇。 */
export const GIANT_TARGET = "巨大 *";

/** 把輸入的 Target 加進清單：去頭尾空白，空白或重複的不加。 */
export function addTarget(targets: string[], raw: string): string[] {
  const name = raw.trim();
  if (!name || targets.includes(name)) return targets;
  return [...targets, name];
}
