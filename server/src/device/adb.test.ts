import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Adb, adbOptionsFromEnv, defaultAdbPath, type AdbExec } from "./adb.js";
import { DeviceLostError } from "./device.js";

const failing = (stderr: string): AdbExec => async () => {
  throw Object.assign(new Error("Command failed"), { stderr });
};

describe("adb 設定", () => {
  it("ADB_PATH、ADB_SERIAL 從環境變數讀（和 CLI 一致）；沒設就用預設路徑", () => {
    expect(adbOptionsFromEnv({ ADB_PATH: "D:\sdk\adb.exe", ADB_SERIAL: "ABC123" })).toEqual({ adbPath: "D:\sdk\adb.exe", serial: "ABC123" });
    expect(adbOptionsFromEnv({})).toEqual({ adbPath: undefined, serial: undefined });
  });

  it("adbPath 與 serial 真的用在 adb 指令上", async () => {
    const calls: { file: string; args: string[] }[] = [];
    const adb = new Adb({ adbPath: "D:\sdk\adb.exe", serial: "ABC123", exec: async (file, args) => (calls.push({ file, args }), "ok") });
    await adb.shell("echo hi");
    expect(calls).toEqual([{ file: "D:\sdk\adb.exe", args: ["-s", "ABC123", "shell", "echo hi"] }]);
    const dflt: string[] = [];
    await new Adb({ exec: async (file) => (dflt.push(file), "") }).shell("x");
    expect(dflt).toEqual([defaultAdbPath()]);
  });

  it("預設 adb 路徑：依序找 ANDROID_HOME、ANDROID_SDK_ROOT、目前使用者的 LOCALAPPDATA，都沒有就用 PATH 上的 adb", () => {
    const exe = process.platform === "win32" ? "adb.exe" : "adb";
    const has = (...paths: string[]) => (p: string) => paths.includes(p);
    const home = join("E:", "sdk", "platform-tools", exe);
    const root = join("F:", "sdk", "platform-tools", exe);
    const local = join("C:", "Users", "Ss", "AppData", "Local", "Android", "Sdk", "platform-tools", exe);
    const env = { ANDROID_HOME: join("E:", "sdk"), ANDROID_SDK_ROOT: join("F:", "sdk"), LOCALAPPDATA: join("C:", "Users", "Ss", "AppData", "Local") };
    expect(defaultAdbPath(env, has(home, root, local))).toBe(home);
    expect(defaultAdbPath(env, has(root, local))).toBe(root);
    expect(defaultAdbPath(env, has(local))).toBe(local);
    expect(defaultAdbPath(env, has())).toBe("adb");
    expect(defaultAdbPath({}, has(local))).toBe("adb");
  });
});

describe("adb 錯誤分類", () => {
  it("more than one device：不是 DeviceLost，訊息教使用者設 ADB_SERIAL", async () => {
    const err = await new Adb({ exec: failing("adb.exe: more than one device/emulator") }).shell("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(DeviceLostError);
    expect((err as Error).message).toContain("ADB_SERIAL");
    expect((err as Error).message).toContain("多台");
  });

  it("no devices／offline 仍是 DeviceLost", async () => {
    for (const text of ["error: no devices/emulators found", "error: device offline"]) {
      expect(await new Adb({ exec: failing(text) }).shell("x").catch((e: unknown) => e)).toBeInstanceOf(DeviceLostError);
    }
  });
});
