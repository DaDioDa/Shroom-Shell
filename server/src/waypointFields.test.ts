import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FakeBotRunner, FakeDevice } from "./bot/fakeBot.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-wpfields-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const app = buildApp({ dataDir: dir, bot: new FakeBotRunner(() => ({ exitCode: 0, stdout: "[]\n", stderr: [] })), device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  return app;
}
type App = ReturnType<typeof setup>;
const mkList = async (app: App, feature: string) =>
  (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L", feature } })).json().id as number;
const addWp = (app: App, id: number, payload: object) =>
  app.inject({ method: "POST", url: `/api/lists/${id}/waypoints`, payload: { lat: 1, lng: 2, ...payload } });
const patchWp = (app: App, id: number, payload: object) => app.inject({ method: "PATCH", url: `/api/waypoints/${id}`, payload });
const imp = (app: App, id: number, text: string) =>
  app.inject({ method: "POST", url: `/api/lists/${id}/import`, payload: { text } });

describe("新增 Waypoint 依清單功能檢查", () => {
  it("美片菇：缺 Spot Name 或帶半徑回 400 附原因；合規則 201", async () => {
    const app = setup();
    const id = await mkList(app, "postcard-check");
    const a = await addWp(app, id, { label: "x" });
    expect(a.statusCode).toBe(400);
    expect(a.json().error).toBe("美片菇需要 @Spot Name");
    const b = await addWp(app, id, { spotName: "神社", radius: 300 });
    expect(b.statusCode).toBe(400);
    expect(b.json().error).toBe("美片菇不使用半徑");
    const c = await addWp(app, id, { spotName: "神社" });
    expect(c.statusCode).toBe(201);
    expect(c.json()).toMatchObject({ spotName: "神社", radius: null });
  });

  it.each(["quiet-search", "target-search"])("%s：帶 Spot Name 回 400；半徑選填，合規則 201", async (f) => {
    const app = setup();
    const id = await mkList(app, f);
    const a = await addWp(app, id, { spotName: "神社" });
    expect(a.statusCode).toBe(400);
    expect(a.json().error).toContain("不使用 Spot Name");
    expect((await addWp(app, id, {})).statusCode).toBe(201);
    const r = await addWp(app, id, { radius: 300 });
    expect(r.statusCode).toBe(201);
    expect(r.json().radius).toBe(300);
  });
});

describe("修改 Waypoint 檢查修改後的完整欄位", () => {
  it("美片菇：不能清掉 Spot Name，不能加半徑；改標籤與 Spot Name 可以", async () => {
    const app = setup();
    const id = await mkList(app, "postcard-check");
    const wp = (await addWp(app, id, { spotName: "神社" })).json();
    expect((await patchWp(app, wp.id, { spotName: null })).statusCode).toBe(400);
    const r = await patchWp(app, wp.id, { radius: 300 });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("美片菇不使用半徑");
    const ok = await patchWp(app, wp.id, { label: "新", spotName: "別間" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ label: "新", spotName: "別間", radius: null });
  });

  it("無人巨菇：不能加 Spot Name；半徑可改可清", async () => {
    const app = setup();
    const id = await mkList(app, "quiet-search");
    const wp = (await addWp(app, id, {})).json();
    expect((await patchWp(app, wp.id, { spotName: "神社" })).statusCode).toBe(400);
    expect((await patchWp(app, wp.id, { radius: 400 })).json().radius).toBe(400);
    expect((await patchWp(app, wp.id, { radius: null })).json().radius).toBeNull();
  });
});

describe("PATCH 移動 Waypoint", () => {
  it("lat、lng 一起給就移到新座標，其他欄位不變", async () => {
    const app = setup();
    const id = await mkList(app, "quiet-search");
    const wp = (await addWp(app, id, { label: "甲", radius: 300 })).json();
    const r = await patchWp(app, wp.id, { lat: -15.5885, lng: -67.2519 });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ lat: -15.5885, lng: -67.2519, label: "甲", radius: 300 });
    expect((await app.inject(`/api/lists/${id}/waypoints`)).json()[0]).toMatchObject({ lat: -15.5885, lng: -67.2519 });
  });
  it("座標不合法或只給一個就回 400，原座標不變", async () => {
    const app = setup();
    const id = await mkList(app, "quiet-search");
    const wp = (await addWp(app, id, {})).json();
    expect((await patchWp(app, wp.id, { lat: 95, lng: 2 })).statusCode).toBe(400);
    expect((await patchWp(app, wp.id, { lat: 3 })).statusCode).toBe(400);
    expect((await patchWp(app, wp.id, { lng: "x", lat: 3 })).statusCode).toBe(400);
    expect((await app.inject(`/api/lists/${id}/waypoints`)).json()[0]).toMatchObject({ lat: 1, lng: 2 });
  });
});

describe("匯入依清單功能檢查", () => {
  it("美片菇：不合規則的行進 errors 附原因，合規則的行匯入", async () => {
    const app = setup();
    const id = await mkList(app, "postcard-check");
    const res = await imp(app, id, "1,2 甲 @神社\n3,4 乙\n5,6 r=300 丙 @店\nhttps://maps.google.com/?q=1,2");
    const body = res.json();
    expect(body.imported.map((w: { spotName: string }) => w.spotName)).toEqual(["神社"]);
    expect(body.errors.map((e: { line: number; reason: string }) => [e.line, e.reason]).slice(0, 2)).toEqual([
      [2, "美片菇需要 @Spot Name"],
      [3, "美片菇不使用半徑"],
    ]);
    expect((await app.inject(`/api/lists/${id}/waypoints`)).json()).toHaveLength(1);
  });

  it("無人巨菇：Spot Name 行被擋，半徑行匯入", async () => {
    const app = setup();
    const id = await mkList(app, "quiet-search");
    const body = (await imp(app, id, "1,2 r=300 甲\n3,4 乙 @神社")).json();
    expect(body.imported).toHaveLength(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].reason).toBe("無人巨菇不使用 Spot Name");
  });
});
