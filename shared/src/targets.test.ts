import { describe, expect, it } from "vitest";
import { GIANT_TARGET, addTarget } from "./targets.js";

describe("addTarget（多值輸入框）", () => {
  it("去掉頭尾空白後加進去，保持輸入順序", () => {
    expect(addTarget(["一般 紅色蘑菇"], "  巨大 輝煌蘑菇 ")).toEqual(["一般 紅色蘑菇", "巨大 輝煌蘑菇"]);
  });
  it("空白或重複的不加", () => {
    expect(addTarget(["巨大 *"], "   ")).toEqual(["巨大 *"]);
    expect(addTarget(["巨大 *"], "巨大 *")).toEqual(["巨大 *"]);
  });
  it("「巨菇」快捷填入 `巨大 *`", () => {
    expect(GIANT_TARGET).toBe("巨大 *");
    expect(addTarget([], GIANT_TARGET)).toEqual(["巨大 *"]);
  });
});
