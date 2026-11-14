import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BotSighting, QuietResult } from "@shell/shared";
import { buildApp } from "../app.js";
import { FakeBotRunner, FakeDevice, type FakeReply } from "../bot/fakeBot.js";

const NL = String.fromCharCode(10);
let dir: string;
const apps: { close(): Promise<unknown> }[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-featfilter-"));
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  rmSync(dir, { recursive: true, force: true });
});

const giant = (spot: string): BotSighting => ({
  target: "巨大 輝煌蘑菇", lat: 25.03, lng: 121.56, spot_name: spot, participant_count: 0, remaining_seconds: null,
  observed_at: "2026-11-14T14:08:00+08:00", map_position: [1, 2], frame: null, postcard: null,
});
const quietAnswer = (): QuietResult => ({ quiet_area: true, verdict: true, reason: "ok", giants: [giant("Q")], claimed: null, unread: 0 });

async function setup() {
  const bot = new FakeBotRunner((req): FakeReply =>
    req.command === "hunt"
      ? { exitCode: 0, stdout: JSON.stringify([giant("H")]), stderr: [] }
      : { exitCode: 0, stdout: JSON.stringify([giant("Q")]) + NL + JSON.stringify(quietAnswer()) + NL, stderr: [] });
  const app = buildApp({ dataDir: dir, bot, device: new FakeDevice(), waitMs: 0 });
  apps.push(app);
  const run = async (feature: string, url: string, body: object) => {
    const list = (await app.inject({ method: "POST", url: "/api/lists", payload: { name: "L", feature } })).json();
    await app.inject({ method: "POST", url: `/api/lists/${list.id}/import`, payload: { text: "1,1 甲" } });
    const res = await app.inject({ method: "POST", url, payload: { listId: list.id, ...body } });
    const { batchId } = res.json() as { batchId: number };
    await app.inject(`/api/batches/${batchId}/events`);
    return batchId;
  };
  const h = await run("target-search", "/api/batches/target-search", { targets: ["巨大 *"], radius: 500, skipCrowded: 0 });
  const q1 = await run("quiet-search", "/api/batches/quiet-search", { radius: 300 });
  const q2 = await run("quiet-search", "/api/batches/quiet-search", { radius: 300 });
  return { app, h, q1, q2 };
}

describe("依功能篩選", () => {
  it("歷史：?feature=X 只回該功能，新的在前；不帶回全部", async () => {
    const t = await setup();
    const ids = async (qs: string) => ((await t.app.inject(`/api/history${qs}`)).json() as { id: number }[]).map((r) => r.id);
    expect(await ids("?feature=quiet-search")).toEqual([t.q2, t.q1]);
    expect(await ids("?feature=target-search")).toEqual([t.h]);
    expect(await ids("?feature=postcard-check")).toEqual([]);
    expect(await ids("")).toEqual([t.q2, t.q1, t.h]);
  });

  it("Sighting：?feature=X 只回該功能 Batch 的；Discovery 與 Quiet 分開；不帶回全部", async () => {
    const t = await setup();
    const spots = async (qs: string) => ((await t.app.inject(`/api/sightings${qs}`)).json() as { spot_name: string }[]).map((s) => s.spot_name);
    expect(await spots("?feature=target-search")).toEqual(["H"]);
    expect(await spots("?feature=quiet-search")).toEqual(["Q", "Q"]);
    expect(await spots("?feature=discovery")).toEqual([]);
    expect((await spots("")).sort()).toEqual(["H", "Q", "Q"]);
  });
});
