import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ImportResult, Waypoint, WaypointList } from "@shell/shared";
import { buildApp } from "./app.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-test-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function createList(app: ReturnType<typeof buildApp>, name: string): Promise<WaypointList> {
  const res = await app.inject({ method: "POST", url: "/api/lists", payload: { name } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe("Waypoint List API", () => {
  it("建立、改名、刪除清單", async () => {
    const app = buildApp({ dataDir: dir });
    const a = await createList(app, "A");
    await createList(app, "B");
    expect((await app.inject("/api/lists")).json().map((l: WaypointList) => l.name)).toEqual(["A", "B"]);

    const renamed = await app.inject({ method: "PATCH", url: `/api/lists/${a.id}`, payload: { name: "A2" } });
    expect(renamed.json().name).toBe("A2");

    expect((await app.inject({ method: "DELETE", url: `/api/lists/${a.id}` })).statusCode).toBe(204);
    expect((await app.inject("/api/lists")).json().map((l: WaypointList) => l.name)).toEqual(["B"]);
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${a.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it("空名字回 400", async () => {
    const app = buildApp({ dataDir: dir });
    const res = await app.inject({ method: "POST", url: "/api/lists", payload: { name: "  " } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("匯入：好行存起來、壞行回報、保持順序", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    const res = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/import`,
      payload: { text: "25.1,121.5 甲\nbad line\n25.2,121.6" },
    });
    const body = res.json() as ImportResult;
    expect(body.imported.map((w) => [w.lat, w.lng, w.label])).toEqual([
      [25.1, 121.5, "甲"],
      [25.2, 121.6, ""],
    ]);
    expect(body.errors).toEqual([{ line: 2, text: "bad line", reason: expect.any(String) }]);

    // 再匯入一次會接在後面
    await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,2 乙" } });
    const wps = (await app.inject(`/api/lists/${list.id}/waypoints`)).json() as Waypoint[];
    expect(wps.map((w) => w.label)).toEqual(["甲", "", "乙"]);
    expect((await app.inject("/api/lists")).json()[0].waypointCount).toBe(3);
    await app.close();
  });

  it("刪除清單時一併刪掉 Waypoint", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,2" } });
    await app.inject({ method: "DELETE", url: `/api/lists/${list.id}` });
    expect((await app.inject(`/api/lists/${list.id}/waypoints`)).statusCode).toBe(404);
    await app.close();
  });

  it("重開 App（同一個資料目錄）後資料還在", async () => {
    const first = buildApp({ dataDir: dir });
    const list = await createList(first, "持久");
    await first.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "9.5,100.25 標" } });
    await first.close();

    const second = buildApp({ dataDir: dir });
    const lists = (await second.inject("/api/lists")).json() as WaypointList[];
    expect(lists).toEqual([{ id: list.id, name: "持久", waypointCount: 1 }]);
    const wps = (await second.inject(`/api/lists/${list.id}/waypoints`)).json() as Waypoint[];
    expect(wps[0]).toMatchObject({ lat: 9.5, lng: 100.25, label: "標" });
    await second.close();
  });
});
