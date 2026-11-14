export type MapsLinkResult = { ok: true; lat: number; lng: number } | { ok: false; reason: string };

const NUM = "(-?[0-9]+(?:[.][0-9]+)?)";
// 依優先序：!3d..!4d..（地點本身）> ?q= > @（視窗中心）
const PATTERNS = [
  new RegExp("!3d" + NUM + "!4d" + NUM),
  new RegExp("[?&]q=" + NUM + "," + NUM),
  new RegExp("@" + NUM + "," + NUM),
];
const SHORT = /^(https?:[/][/])?(maps[.]app[.]goo[.]gl|goo[.]gl[/]maps)[/]/i;

/** 從 Google Maps 連結解析經緯度（純函式，不連網）。短網址無法解析。 */
export function parseMapsLink(input: string): MapsLinkResult {
  const url = input.trim();
  if (SHORT.test(url)) return { ok: false, reason: "短網址無法解析，請貼完整的 Google Maps 連結" };
  for (const p of PATTERNS) {
    const m = p.exec(url);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, reason: "經緯度超出範圍" };
    return { ok: true, lat, lng };
  }
  return { ok: false, reason: "找不到經緯度" };
}
