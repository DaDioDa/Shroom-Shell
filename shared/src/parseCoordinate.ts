import { parseMapsLink, type MapsLinkResult } from "./parseMapsLink.js";

const NUM = "(-?[0-9]+(?:[.][0-9]+)?)";
// 「lat, lng」或「lat lng」，可帶括號、全形逗號。
const PAIR = new RegExp("^[(（]?\\s*" + NUM + "\\s*(?:[,，]\\s*|\\s+)" + NUM + "\\s*[)）]?$");

/** 地圖搜尋列用：解析「緯度, 經度」或 Google Maps 連結（純函式，不連網）。 */
export function parseCoordinate(input: string): MapsLinkResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "請輸入座標，例如 25.0339, 121.5645" };
  if (/^https?:/i.test(text) || /goo[.]gl/i.test(text)) return parseMapsLink(text);
  const m = PAIR.exec(text);
  if (!m) return { ok: false, reason: "看不懂這個座標，格式是「緯度, 經度」" };
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, reason: "經緯度超出範圍" };
  return { ok: true, lat, lng };
}
