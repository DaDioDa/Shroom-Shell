import type { CancelMode, HistoryDetail, HistoryRow, ImportResult, QueueSnapshot, QuietSearchParams, Settings, TargetSearchParams, Waypoint, WaypointList } from "@shell/shared";

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  lists: () => call<WaypointList[]>("GET", "/api/lists"),
  createList: (name: string) => call<WaypointList>("POST", "/api/lists", { name }),
  renameList: (id: number, name: string) => call<WaypointList>("PATCH", `/api/lists/${id}`, { name }),
  deleteList: (id: number) => call<void>("DELETE", `/api/lists/${id}`),
  waypoints: (id: number) => call<Waypoint[]>("GET", `/api/lists/${id}/waypoints`),
  queue: () => call<QueueSnapshot>("GET", "/api/queue"),
  cancelBatch: (id: number, mode: CancelMode) => call<{ ok: true }>("POST", `/api/batches/${id}/cancel`, { mode }),
  targets: () => call<string[]>("GET", "/api/targets"),
  startTargetSearch: (p: TargetSearchParams) => call<{ batchId: number }>("POST", "/api/batches/target-search", p),
  startQuietSearch: (p: QuietSearchParams) => call<{ batchId: number }>("POST", "/api/batches/quiet-search", p),
  settings: () => call<Settings>("GET", "/api/settings"),
  saveSettings: (s: Settings) => call<Settings>("PUT", "/api/settings", s),
  history: () => call<HistoryRow[]>("GET", "/api/history"),
  historyDetail: (id: number) => call<HistoryDetail>("GET", `/api/history/${id}`),
  deleteBatch: (id: number) => call<void>("DELETE", `/api/batches/${id}`),
  addWaypoint: (listId: number, lat: number, lng: number) =>
    call<Waypoint>("POST", `/api/lists/${listId}/waypoints`, { lat, lng }),
  updateWaypoint: (id: number, patch: { label?: string; radius?: number | null; spotName?: string | null }) =>
    call<Waypoint>("PATCH", `/api/waypoints/${id}`, patch),
  deleteWaypoint: (id: number) => call<void>("DELETE", `/api/waypoints/${id}`),
  reorder: (listId: number, ids: number[]) => call<Waypoint[]>("PUT", `/api/lists/${listId}/order`, { ids }),
  importText: (id: number, text: string) => call<ImportResult>("POST", `/api/lists/${id}/import`, { text }),
};
