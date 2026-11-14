import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BatchEvent } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, TINY_PNG, type FakeReply } from "../bot/fakeBot.js";
import { RealBotRunner } from "../bot/runner.js";
import { DeviceLostError } from "../device/device.js";

let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-ctl-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const NL = String.fromCharCode(10);
const ok = (): FakeReply => ({ exitCode: 0, stdout: "[]\n" });
const until = async (cond: () => boolean, what: string) => {
  for (let i = 0; i < 400; i++) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("等不到：" + what);
};
/** 讓 bot 卡住，直到測試放行。 */
function gate() {
  let open!: () => void;
  const wait = new Promise<void>((r) => (open = r));
  return { wait, open };
}

async function setup(text: string, script: (i: number) => FakeReply | Promise<FakeReply>) {
  const timeline: string[] = [];
  const device = new FakeDevice();
  const bot = new FakeBotRunner(async (_req, i) => {
    timeline.push(`bot#${i + 1}`);
    return script(i);
  });
  const t = device.teleport.bind(device);
  device.teleport = async (to) => (timeline.push(`teleport ${to.lat},${to.lng}`), t(to));
  const s = device.stop.bind(device);
  device.stop = async () => (timeline.push("stop"), s());
  const app = buildApp({ dataDir: dir, bot, device, waitMs: 0 });
  apps.push(app);
  const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L" } })).json();
  await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text } });
  return { app, bot, device, timeline, listId: list.id as number };
}
type T = Awaited<ReturnType<typeof setup>>;

const start = async (t: T) => {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/batches/target-search",
    payload: { listId: t.listId, targets: ["巨大 *"], radius: 500, skipCrowded: 0 },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { batchId: number }).batchId;
};
const cancel = (t: T, id: number, mode?: string) =>
  t.app.inject({ method: "POST", url: `/api/batches/${id}/cancel`, payload: mode ? { mode } : {} });
/** 讀 SSE 到 finished。 */
const events = async (t: T, id: number) =>
  (await t.app.inject(`/api/batches/${id}/events`)).body
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as BatchEvent);
const last = (e: BatchEvent[]) => e.at(-1) as Extract<BatchEvent, { type: "finished" }>;

describe("佇列", () => {
  it("同時送出兩個 Batch：第二個排隊，等第一個跑完才開始；先進先出", async () => {
    const g = gate();
    const t = await setup("1,1 甲\n2,2 乙", (i) => (i === 0 ? g.wait.then(ok) : ok()));
    const a = await start(t);
    const b = await start(t);
    await until(() => t.bot.calls.length === 1, "第一個 Batch 的 bot 開始");

    expect((await t.app.inject(`/api/batches/${b}`)).json().status).toBe("queued");
    const q = (await t.app.inject("/api/queue")).json();
    expect(q.running.batchId).toBe(a);
    expect(q.queued.map((x: { batchId: number }) => x.batchId)).toEqual([b]);
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1"]); // B 還沒碰手機

    g.open();
    const eb = await events(t, b);
    expect(eb[0]).toMatchObject({ type: "queued", position: 1 });
    expect(last(eb)).toMatchObject({ status: "done" });
    expect(t.timeline).toEqual([
      "teleport 1,1", "bot#1", "teleport 2,2", "bot#2", "stop", // A
      "teleport 1,1", "bot#3", "teleport 2,2", "bot#4", "stop", // B
    ]);
    expect((await t.app.inject("/api/queue")).json()).toEqual({ running: null, queued: [] });
  });

  it("Quiet Batch 與 Target Search 排進同一個佇列，也受取消與 stop 管轄", async () => {
    const g = gate();
    const quietReply = (): FakeReply => ({
      exitCode: 1,
      stdout: JSON.stringify([]) + NL + JSON.stringify({ quiet_area: false, verdict: false, reason: "有人在打", giants: [], claimed: null, unread: 0 }) + NL,
    });
    const t = await setup("1,1 甲"+NL+"2,2 乙", (i) => (i === 0 ? g.wait.then(ok) : quietReply()));
    const a = await start(t); // Target Search 先跑
    const q = await t.app.inject({ method: "POST", url: "/api/batches/quiet-search", payload: { listId: t.listId, radius: 500 } });
    expect(q.statusCode).toBe(201);
    const b = (q.json() as { batchId: number }).batchId;
    await until(() => t.bot.calls.length === 1, "A 開始");
    expect((await t.app.inject(`/api/batches/${b}`)).json().status).toBe("queued");
    expect((await t.app.inject("/api/queue")).json().queued.map((x: { feature: string }) => x.feature)).toEqual(["quiet-search"]);
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1"]);
    g.open();
    await events(t, a);
    expect(last(await events(t, b))).toMatchObject({ status: "done" });
    expect(t.bot.calls.map((c) => c.command)).toEqual(["hunt", "hunt", "quiet", "quiet"]);

    // Quiet 也能強制停止
    const h = await setup("1,1 甲"+NL+"2,2 乙", () => ({ ...ok(), hang: true }));
    const r = await h.app.inject({ method: "POST", url: "/api/batches/quiet-search", payload: { listId: h.listId, radius: 500 } });
    const qid = (r.json() as { batchId: number }).batchId;
    await until(() => h.bot.calls.length === 1, "quiet bot 開始");
    await cancel(h, qid, "force");
    expect(last(await events(h, qid))).toMatchObject({ status: "cancelled" });
    expect(h.bot.killed).toEqual([1]);
    expect(h.timeline.at(-1)).toBe("stop");
  });

  it("把還在排隊的 Batch 移出佇列：不會跑，狀態是 cancelled", async () => {
    const g = gate();
    const t = await setup("1,1 甲", (i) => (i === 0 ? g.wait.then(ok) : ok()));
    const a = await start(t);
    const b = await start(t);
    await until(() => t.bot.calls.length === 1, "A 開始");
    expect((await cancel(t, b)).statusCode).toBe(200);
    expect((await t.app.inject(`/api/batches/${b}`)).json().status).toBe("cancelled");
    expect(last(await events(t, b))).toMatchObject({ type: "finished", status: "cancelled" });
    g.open();
    await events(t, a);
    expect(t.bot.calls).toHaveLength(1);
  });
});

describe("取消", () => {
  it("預設「跑完目前這點就停」：等 bot 正常結束、不 kill、不跑下一點、最後 stop", async () => {
    const g = gate();
    const t = await setup("1,1 甲\n2,2 乙\n3,3 丙", (i) => (i === 0 ? g.wait.then(ok) : ok()));
    const id = await start(t);
    await until(() => t.bot.calls.length === 1, "bot 開始");
    expect((await cancel(t, id)).statusCode).toBe(200);
    expect((await t.app.inject(`/api/batches/${id}`)).json().status).toBe("running"); // 還在等 bot 收尾
    g.open();
    expect(last(await events(t, id))).toMatchObject({ status: "cancelled" });
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1", "stop"]);
    expect(t.bot.killed).toEqual([]);
    expect((await t.app.inject(`/api/batches/${id}`)).json().runs).toHaveLength(1); // 這一點的結果有存
  });

  it("強制停止：立刻 kill bot、不等它收尾、最後 stop", async () => {
    const t = await setup("1,1 甲\n2,2 乙", () => ({ ...ok(), hang: true }));
    const id = await start(t);
    await until(() => t.bot.calls.length === 1, "bot 開始");
    expect((await cancel(t, id, "force")).statusCode).toBe(200);
    expect(last(await events(t, id))).toMatchObject({ status: "cancelled" });
    expect(t.bot.killed).toEqual([1]);
    expect(t.timeline).toEqual(["teleport 1,1", "bot#1", "stop"]);
  });

  it("取消不存在的 Batch 回 404、mode 不合法回 400、已結束的回 409", async () => {
    const t = await setup("1,1 甲", () => ok());
    expect((await cancel(t, 999)).statusCode).toBe(404);
    const id = await start(t);
    await events(t, id);
    expect((await cancel(t, id)).statusCode).toBe(409);
    expect((await cancel(t, id, "亂來")).statusCode).toBe(400);
  });
});

describe("出錯", () => {
  it("某點 bot exit 2：標成失敗，附 abort.txt 的原因與 abort.png，然後繼續下一點", async () => {
    const t = await setup("1,1 甲\n2,2 乙", (i) =>
      i === 0
        ? { exitCode: 2, stdout: "", files: { "abort.txt": "遊戲沒有回應\n原始資料……", "abort.png": TINY_PNG } }
        : ok(),
    );
    const id = await start(t);
    const ev = await events(t, id);
    const failed = ev.find((e) => e.type === "waypoint-failed");
    expect(failed).toMatchObject({ index: 1, error: "遊戲沒有回應", screenshotUrl: "/api/runs/fake-run-001/abort.png" });
    expect(t.bot.calls).toHaveLength(2); // 繼續下一點
    expect(last(ev)).toEqual({ type: "finished", status: "done" });
    const png = await t.app.inject("/api/runs/fake-run-001/abort.png");
    expect(png.statusCode).toBe(200);
    expect(png.headers["content-type"]).toBe("image/png");
    expect(t.timeline.at(-1)).toBe("stop");
  });

  it("adb 斷線：整個 Batch 停下並標明原因，沒呼叫 bot，仍然 stop", async () => {
    const t = await setup("1,1 甲\n2,2 乙", () => ok());
    t.device.failWith = new DeviceLostError("找不到手機（adb: no devices/emulators found）");
    const id = await start(t);
    const ev = await events(t, id);
    expect(last(ev)).toMatchObject({ status: "failed", error: expect.stringContaining("找不到手機") });
    expect(t.bot.calls).toHaveLength(0);
    expect(t.timeline).toEqual(["teleport 1,1", "stop"]); // 沒有再試第二點
  });

  it("途中才斷線：已存的結果保留，後面的 Waypoint 不跑", async () => {
    const t = await setup("1,1 甲\n2,2 乙\n3,3 丙", (i) => {
      if (i === 0) t.device.failWith = new DeviceLostError("手機離線");
      return ok();
    });
    const id = await start(t);
    expect(last(await events(t, id))).toMatchObject({ status: "failed", error: "手機離線" });
    expect(t.bot.calls).toHaveLength(1);
    expect(t.timeline.at(-1)).toBe("stop");
  });

  it("偵測到其他模擬定位 App：不開始（不 Teleport、不跑 bot），並指出是哪個 App", async () => {
    const t = await setup("1,1 甲", () => ok());
    t.device.otherMockApps = ["com.xmap.bluemap"];
    const id = await start(t);
    const e = last(await events(t, id));
    expect(e).toMatchObject({ status: "failed", error: expect.stringContaining("com.xmap.bluemap") });
    expect(e.error).toContain("關掉");
    expect(t.timeline).not.toContain("teleport 1,1");
    expect(t.bot.calls).toHaveLength(0);
  });
});

describe("每種結束方式都恢復真實 GPS", () => {
  it("正常結束與 bot 丟例外", async () => {
    const t = await setup("1,1 甲", () => ok());
    await events(t, await start(t));
    expect(t.timeline.at(-1)).toBe("stop");
    const u = await setup("1,1 甲", () => {
      throw new Error("bot 壞了");
    });
    expect(last(await events(u, await start(u)))).toMatchObject({ status: "failed" });
    expect(u.timeline.at(-1)).toBe("stop");
  });
});

describe("RealBotRunner 的強制停止", () => {
  it("abort 時真的把子程序 kill 掉", async () => {
    const script = join(dir, "sleeper.mjs");
    writeFileSync(
      script,
      `import { writeFileSync } from "node:fs";
       writeFileSync(process.argv[process.argv.indexOf("--runs-dir") + 1] + "/pid.txt", String(process.pid));
       setInterval(() => {}, 1000);`,
    );
    const runsDir = join(dir, "runs");
    const runner = new RealBotRunner({ executable: process.execPath, baseArgs: [script] });
    const ac = new AbortController();
    const p = runner.run({ command: "hunt", args: [], runsDir, signal: ac.signal });
    await until(() => existsSync(join(runsDir, "pid.txt")), "子程序啟動");
    const pid = Number(readFileSync(join(runsDir, "pid.txt"), "utf8"));
    expect(() => process.kill(pid, 0)).not.toThrow(); // 還活著
    ac.abort();
    const r = await p;
    expect(r.killed).toBe(true);
    await until(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    }, "子程序結束");
  });
});
