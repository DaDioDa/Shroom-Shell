import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, featureName } from "./featureNames.js";

describe("featureName", () => {
  it("每個 feature key 都有中文名稱", () => {
    for (const k of FEATURE_KEYS) expect(featureName(k)).toMatch(/[\u4e00-\u9fff]/);
  });
  it("未知 key 原樣回傳", () => expect(featureName("x")).toBe("x"));
});
