import { describe, expect, it } from "vitest";
import { Adb, type AdbExec } from "./adb.js";
import { DeviceLostError } from "./device.js";
import { Teleporter } from "./teleporter.js";

/** 模擬 `am stopservice` 以 exit code 255 結束、把結果印在 stderr。 */
const exit255 = (stderr: string): AdbExec => async () => {
  throw Object.assign(new Error(`Command failed: adb shell am stopservice\n${stderr}`), {
    stdout: "Stopping service: Intent { cmp=io.appium.settings/.LocationService }\n",
    stderr,
  });
};

describe("恢復真實 GPS（stop）", () => {
  it("am stopservice 印 Service stopped 但 exit code 255：算成功", async () => {
    await expect(new Teleporter(new Adb({ exec: exit255("Service stopped\n") })).stop()).resolves.toBeUndefined();
  });

  it("服務本來就沒在跑（was not running）：也算成功", async () => {
    await expect(new Teleporter(new Adb({ exec: exit255("Service not stopped: was not running.\n") })).stop()).resolves.toBeUndefined();
  });

  it("其他錯誤照樣丟出", async () => {
    await expect(new Teleporter(new Adb({ exec: exit255("Error stopping service\n") })).stop()).rejects.toThrow(/Error stopping service/);
    await expect(new Teleporter(new Adb({ exec: exit255("adb: no devices/emulators found") })).stop()).rejects.toBeInstanceOf(DeviceLostError);
  });
});
