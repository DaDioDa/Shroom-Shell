const p2 = (n: number) => String(n).padStart(2, "0");

/** Region 名稱留空時的自動命名：「探索 YYYY-MM-DD HH:mm」（本地時間）。 */
export function autoRegionName(now: Date): string {
  return `探索 ${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

/** Grid Cell 當 Batch 的點時的標籤；index 從 0 起算，顯示從 1 起算。 */
export const gridCellLabel = (index: number): string => `格 ${index + 1}`;

/** 綠格加入無人巨菇清單時預設的 Waypoint 標籤。 */
export const gridCellWaypointLabel = (regionName: string, index: number): string => `探索：${regionName} ${gridCellLabel(index)}`;

/** 同一份清單裡經緯度與半徑都相同就算重複。 */
export function isDuplicateWaypoint(
  list: { lat: number; lng: number; radius: number | null }[],
  candidate: { lat: number; lng: number; radius: number | null },
): boolean {
  return list.some((w) => w.lat === candidate.lat && w.lng === candidate.lng && w.radius === candidate.radius);
}
