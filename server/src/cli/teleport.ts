/**
 * 用法：
 *   npm run teleport -- <lat> <lng>     設定模擬位置
 *   npm run teleport -- <lat>,<lng>     同上
 *   npm run teleport -- --stop          停止模擬，恢復真實 GPS
 *   npm run teleport -- --status        顯示目前 gps 位置
 *
 * 環境變數 ADB_PATH、ADB_SERIAL 可覆寫 adb 路徑與裝置序號。
 */
import { Adb, adbOptionsFromEnv } from "../device/adb.js";
import { Teleporter, TeleportError } from "../device/teleporter.js";

const adb = new Adb(adbOptionsFromEnv());
const tp = new Teleporter(adb);

async function main(argv: string[]): Promise<number> {
  if (argv[0] === "--stop") {
    await tp.stop();
    console.error("已停止模擬，恢復真實 GPS。");
    return 0;
  }
  if (argv[0] === "--status") {
    const now = await tp.currentGps();
    console.log(JSON.stringify(now));
    return 0;
  }

  const nums = argv.join(",").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (nums.length !== 2 || nums.some(Number.isNaN)) {
    console.error("用法：teleport <lat> <lng> | --stop | --status");
    return 2;
  }
  const [lat, lng] = nums as [number, number];

  const others = await tp.otherActiveMockApps();
  if (others.length) {
    console.error(`警告：這些模擬定位 App 正在運作，可能會搶走位置：${others.join("、")}`);
  }

  const r = await tp.teleport({ lat, lng });
  console.log(JSON.stringify({ lat, lng, ...r }));
  console.error(`已 Teleport 到 ${lat},${lng}（${r.settledMs} ms${r.restarted ? "，重啟過 LocationService" : ""}）`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof TeleportError ? err.message : err);
    process.exit(2);
  },
);
