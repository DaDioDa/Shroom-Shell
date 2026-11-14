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
  const res = await app.inject({ method: "POST", url: "/api/lists", payload: { name, feature: "quiet-search" } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe("Waypoint List API", () => {
  it("建立、改名、刪除清單", async () => {
    const app = buildApp({ dataDir: dir });
    const a = await createList(app, "A");
    await createList(app, "B");
    expect((await app.inject("/api/lists?feature=quiet-search")).json().map((l: WaypointList) => l.name)).toEqual(["A", "B"]);

    const renamed = await app.inject({ method: "PATCH", url: `/api/lists/${a.id}`, payload: { name: "A2" } });
    expect(renamed.json().name).toBe("A2");

    expect((await app.inject({ method: "DELETE", url: `/api/lists/${a.id}` })).statusCode).toBe(204);
    expect((await app.inject("/api/lists?feature=quiet-search")).json().map((l: WaypointList) => l.name)).toEqual(["B"]);
    expect((await app.inject({ method: "DELETE", url: `/api/lists/${a.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it("空名字回 400", async () => {
    const app = buildApp({ dataDir: dir });
    const res = await app.inject({ method: "POST", url: "/api/lists", payload: { name: "  ", feature: "quiet-search" } });
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
    expect((await app.inject("/api/lists?feature=quiet-search")).json()[0].waypointCount).toBe(3);
    await app.close();
  });

  it("匯入：r=公尺 存成 Waypoint 的半徑，重開後還在；Maps 連結匯入的半徑為 null；r=0 該行列為錯誤", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    const res = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/import`,
      payload: { text: "1,2 r=300 甲\n3,4 乙\nhttps://www.google.com/maps?q=5,6\n7,8 r=0 壞" },
    });
    const body = res.json() as ImportResult;
    expect(body.imported.map((w) => [w.label, w.radius])).toEqual([["甲", 300], ["乙", null], ["", null]]);
    expect(body.errors.map((e) => e.line)).toEqual([4]);
    await app.close();

    const again = buildApp({ dataDir: dir });
    const wps = (await again.inject(`/api/lists/${list.id}/waypoints`)).json() as Waypoint[];
    expect(wps.map((w) => w.radius)).toEqual([300, null, null]);
    await again.close();
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
    const lists = (await second.inject("/api/lists?feature=quiet-search")).json() as WaypointList[];
    expect(lists).toEqual([{ id: list.id, name: "持久", feature: "quiet-search", waypointCount: 1 }]);
    const wps = (await second.inject(`/api/lists/${list.id}/waypoints`)).json() as Waypoint[];
    expect(wps[0]).toMatchObject({ lat: 9.5, lng: 100.25, label: "標" });
    await second.close();
  });

  it("新增 Waypoint：存進 DB、接在最後、spotName 預設 null", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,2 甲" } });
    const res = await app.inject({ method: "POST", url: `/api/lists/${list.id}/waypoints`, payload: { lat: 3, lng: 4 } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ lat: 3, lng: 4, label: "", radius: null, spotName: null, position: 1 });
    expect((await app.inject("/api/lists?feature=quiet-search")).json()[0].waypointCount).toBe(2);
    expect((await app.inject({ method: "POST", url: `/api/lists/${list.id}/waypoints`, payload: { lat: 99, lng: 4 } })).statusCode).toBe(400);
    await app.close();
  });

  it("編輯標籤、半徑，並可刪除（Spot Name 規則見 waypointFields.test.ts）", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    const wp = (await app.inject({ method: "POST", url: `/api/lists/${list.id}/waypoints`, payload: { lat: 3, lng: 4 } })).json() as Waypoint;
    const res = await app.inject({
      method: "PATCH",
      url: `/api/waypoints/${wp.id}`,
      payload: { label: "新", radius: 25 },
    });
    expect(res.json()).toMatchObject({ id: wp.id, label: "新", radius: 25, spotName: null, lat: 3 });
    const cleared = await app.inject({ method: "PATCH", url: `/api/waypoints/${wp.id}`, payload: { radius: null } });
    expect(cleared.json()).toMatchObject({ label: "新", radius: null, spotName: null });
    expect((await app.inject({ method: "PATCH", url: "/api/waypoints/9999", payload: { label: "x" } })).statusCode).toBe(404);

    expect((await app.inject({ method: "DELETE", url: `/api/waypoints/${wp.id}` })).statusCode).toBe(204);
    expect((await app.inject(`/api/lists/${list.id}/waypoints`)).json()).toEqual([]);
    expect((await app.inject({ method: "DELETE", url: `/api/waypoints/${wp.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it("調整順序後，列表（Batch 的來源）依新順序回傳並在重開後保持", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    const imp = await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: ["1,1 a", "2,2 b", "3,3 c"].join("\n") } });
    const [a, b, c] = (imp.json() as ImportResult).imported;
    const res = await app.inject({ method: "PUT", url: `/api/lists/${list.id}/order`, payload: { ids: [c.id, a.id, b.id] } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Waypoint[]).map((w) => w.label)).toEqual(["c", "a", "b"]);
    await app.close();

    const again = buildApp({ dataDir: dir });
    const wps = (await again.inject(`/api/lists/${list.id}/waypoints`)).json() as Waypoint[];
    expect(wps.map((w) => [w.label, w.position])).toEqual([["c", 0], ["a", 1], ["b", 2]]);
    // ids 必須剛好是該清單的全部 Waypoint
    expect((await again.inject({ method: "PUT", url: `/api/lists/${list.id}/order`, payload: { ids: [a.id] } })).statusCode).toBe(400);
    await again.close();
  });

  it("匯入：Google Maps 連結解析成 Waypoint，短網址列為錯誤", async () => {
    const app = buildApp({ dataDir: dir });
    const list = await createList(app, "L");
    const res = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/import`,
      payload: { text: ["https://www.google.com/maps?q=25.1,121.5", "https://maps.app.goo.gl/abc"].join("\n") },
    });
    const body = res.json() as ImportResult;
    expect(body.imported.map((w) => [w.lat, w.lng])).toEqual([[25.1, 121.5]]);
    expect(body.errors).toEqual([{ line: 2, text: "https://maps.app.goo.gl/abc", reason: expect.stringContaining("短網址") }]);
    await app.close();
  });
});
