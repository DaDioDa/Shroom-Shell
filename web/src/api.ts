import type { ImportResult, TargetSearchParams, Waypoint, WaypointList } from "@shell/shared";

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
  targets: () => call<string[]>("GET", "/api/targets"),
  startTargetSearch: (p: TargetSearchParams) => call<{ batchId: number }>("POST", "/api/batches/target-search", p),
  importText: (id: number, text: string) => call<ImportResult>("POST", `/api/lists/${id}/import`, { text }),
};
