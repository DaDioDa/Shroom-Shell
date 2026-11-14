/** 功能的顯示名稱（中文）。feature key 是程式與 DB 用的識別字，不隨顯示名稱改變。 */
export const FEATURE_KEYS = ["waypoint-list", "quiet-search", "discovery", "postcard-check", "target-search"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_NAME: Record<FeatureKey, string> = {
  "waypoint-list": "座標清單",
  "quiet-search": "無人巨菇",
  discovery: "探索區域",
  "postcard-check": "美片菇",
  "target-search": "指定菇菇",
};

/** 未知的 feature key 原樣回傳。 */
export const featureName = (key: string): string => (FEATURE_NAME as Record<string, string>)[key] ?? key;
