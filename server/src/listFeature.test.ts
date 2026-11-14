import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FakeBotRunner, FakeDevice } from "./bot/fakeBot.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-listfeature-"));
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
const post = (app: App, payload: object) => app.inject({ method: "POST", url: "/api/lists", payload });

describe("Waypoint List 屬於功能", () => {
  it("建立時 feature 必填：缺少或不合法回 400", async () => {
    const app = setup();
    expect((await post(app, { name: "A" })).statusCode).toBe(400);
    expect((await post(app, { name: "A", feature: "discovery" })).statusCode).toBe(400);
    expect((await post(app, { name: "A", feature: "waypoint-list" })).statusCode).toBe(400);
    expect((await app.inject("/api/lists?feature=quiet-search")).json()).toEqual([]);
  });

  it.each(["postcard-check", "quiet-search", "target-search"])("可用 %s 建立，回應帶 feature", async (feature) => {
    const app = setup();
    const res = await post(app, { name: "A", feature });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "A", feature });
  });

  it("GET /api/lists 依 feature 過濾；不帶或不合法的 feature 回 400", async () => {
    const app = setup();
    await post(app, { name: "巨菇1", feature: "quiet-search" });
    await post(app, { name: "美片1", feature: "postcard-check" });
    await post(app, { name: "巨菇2", feature: "quiet-search" });
    const names = async (f: string) => (await app.inject(`/api/lists?feature=${f}`)).json().map((l: { name: string }) => l.name);
    expect(await names("quiet-search")).toEqual(["巨菇1", "巨菇2"]);
    expect(await names("postcard-check")).toEqual(["美片1"]);
    expect(await names("target-search")).toEqual([]);
    expect((await app.inject("/api/lists")).statusCode).toBe(400);
    expect((await app.inject("/api/lists?feature=bogus")).statusCode).toBe(400);
  });

  it("建立後不能改 feature（PATCH 只改名字）", async () => {
    const app = setup();
    const list = (await post(app, { name: "A", feature: "quiet-search" })).json();
    const res = await app.inject({ method: "PATCH", url: `/api/lists/${list.id}`, payload: { name: "B", feature: "target-search" } });
    expect(res.json()).toMatchObject({ name: "B", feature: "quiet-search" });
  });

  describe("用不屬於該功能的清單開 Batch 回 400", () => {
    const starts: Record<string, object> = {
      "postcard-check": {},
      "quiet-search": { radius: 500 },
      "target-search": { targets: ["x"], radius: 500, skipCrowded: 0 },
    };
    for (const feature of Object.keys(starts)) {
      it(`${feature} 的端點拒絕其他功能的清單，接受自己的`, async () => {
        const app = setup();
        const id = async (f: string) => {
          const l = (await post(app, { name: f, feature: f })).json();
          await app.inject({ method: "POST", url: `/api/lists/${l.id}/import`, payload: { text: f === "postcard-check" ? "1,1 甲 @Spot" : "1,1 甲" } });
          return l.id as number;
        };
        const own = await id(feature);
        for (const other of Object.keys(starts).filter((f) => f !== feature)) {
          const res = await app.inject({ method: "POST", url: `/api/batches/${feature}`, payload: { ...starts[feature], listId: await id(other) } });
          expect(res.statusCode).toBe(400);
        }
        const ok = await app.inject({ method: "POST", url: `/api/batches/${feature}`, payload: { ...starts[feature], listId: own } });
        expect(ok.statusCode).toBe(201);
      });
    }
  });
});
