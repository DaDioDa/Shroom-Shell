import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/database.js";
import { enforceRunsLimit } from "./retention.js";

let dir: string;
let runsDir: string;
let db: Db;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shell-retention-"));
  runsDir = join(dir, "runs");
  mkdirSync(runsDir);
  db = openDb(":memory:");
  db.exec("INSERT INTO waypoint_lists (name) VALUES ('清單')");
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

/** 建一個 Batch，帶一個 run 資料夾（bytes 大小）、一筆 waypoint_run 與一筆 Sighting。 */
function seedBatch(runName: string, bytes: number, status = "done"): number {
  mkdirSync(join(runsDir, runName));
  writeFileSync(join(runsDir, runName, "sighting-01.png"), Buffer.alloc(bytes));
  const id = Number(
    db.prepare("INSERT INTO batches (list_id, feature, params, status, created_at) VALUES (1, 'target-search', '{}', ?, 'x')").run(status).lastInsertRowid,
  );
  db.prepare("INSERT INTO waypoint_runs (batch_id, waypoint_id, lat, lng, label, idx, exit_code, result_json, run_dir) VALUES (?, 1, 1, 1, '', 1, 0, '[]', ?)").run(id, runName);
  db.prepare(
    "INSERT INTO sightings (batch_id, waypoint_id, target, lat, lng, spot_name, observed_at, frame, run_dir) VALUES (?, 1, '巨菇', 1, 2, '地點', 't', 'sighting-01.png', ?)",
  ).run(id, runName);
  return id;
}
const exists = (name: string) => existsSync(join(runsDir, name));

describe("enforceRunsLimit", () => {
  it("超過上限時從最舊的 Batch 開始刪，低於上限就停止", () => {
    const a = seedBatch("run-a", 100);
    const b = seedBatch("run-b", 100);
    const c = seedBatch("run-c", 100);
    // 總量 300，上限 250：刪最舊的 a 就夠了。
    const cleared = enforceRunsLimit({ db, runsDir, limitBytes: 250, busyBatchIds: new Set() });
    expect(cleared).toEqual([a]);
    expect([exists("run-a"), exists("run-b"), exists("run-c")]).toEqual([false, true, true]);
    expect(b).toBeLessThan(c);
  });

  it("一個不夠就繼續刪下一個，直到低於上限", () => {
    const a = seedBatch("run-a", 100);
    const b = seedBatch("run-b", 100);
    seedBatch("run-c", 100);
    const cleared = enforceRunsLimit({ db, runsDir, limitBytes: 150, busyBatchIds: new Set() });
    expect(cleared).toEqual([a, b]);
    expect([exists("run-a"), exists("run-b"), exists("run-c")]).toEqual([false, false, true]);
  });

  it("沒超過上限就什麼都不刪", () => {
    seedBatch("run-a", 100);
    expect(enforceRunsLimit({ db, runsDir, limitBytes: 1000, busyBatchIds: new Set() })).toEqual([]);
    expect(exists("run-a")).toBe(true);
  });

  it("正在執行的 Batch 不刪，改刪下一個最舊的", () => {
    const a = seedBatch("run-a", 100, "running");
    const b = seedBatch("run-b", 100);
    seedBatch("run-c", 100);
    const cleared = enforceRunsLimit({ db, runsDir, limitBytes: 250, busyBatchIds: new Set([a]) });
    expect(cleared).toEqual([b]);
    expect([exists("run-a"), exists("run-b"), exists("run-c")]).toEqual([true, false, true]);
  });

  it("DB 狀態是 running／queued 的 Batch 即使沒列在 busyBatchIds 也不刪", () => {
    seedBatch("run-a", 100, "running");
    const b = seedBatch("run-b", 100, "queued");
    expect(enforceRunsLimit({ db, runsDir, limitBytes: 10, busyBatchIds: new Set() })).toEqual([]);
    expect(exists("run-a") && exists("run-b")).toBe(true);
    expect(b).toBe(2);
  });

  it("文字結果保留，Batch 標記為圖片已清除", () => {
    const a = seedBatch("run-a", 100);
    seedBatch("run-b", 100);
    enforceRunsLimit({ db, runsDir, limitBytes: 150, busyBatchIds: new Set() });
    const flag = (id: number) => (db.prepare("SELECT images_cleared AS c FROM batches WHERE id = ?").get(id) as { c: number }).c;
    expect(flag(a)).toBe(1);
    expect(flag(2)).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sightings WHERE batch_id = ?").get(a)).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM waypoint_runs WHERE batch_id = ?").get(a)).toEqual({ n: 1 });
  });

  it("已清除的 Batch 不重複處理", () => {
    const a = seedBatch("run-a", 100);
    seedBatch("run-b", 100);
    enforceRunsLimit({ db, runsDir, limitBytes: 150, busyBatchIds: new Set() });
    expect(enforceRunsLimit({ db, runsDir, limitBytes: 50, busyBatchIds: new Set() })).not.toContain(a);
  });

  it("run_dir 想跳出 runs 目錄時不刪外面的東西", () => {
    const outside = join(dir, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "keep.txt"), Buffer.alloc(500));
    seedBatch("run-a", 100);
    db.prepare("UPDATE waypoint_runs SET run_dir = '../outside'").run();
    enforceRunsLimit({ db, runsDir, limitBytes: 10, busyBatchIds: new Set() });
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
  });
});
