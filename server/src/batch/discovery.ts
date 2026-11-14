import { quietSearchFeature } from "./quietSearch.js";
import type { BatchFeature } from "./runBatch.js";

/** Discovery：就是 Quiet Giant Search，只是輸入是 Region 的 Grid Cell；答案不會自動進任何清單。 */
export function discoveryFeature(params: { radius: number }): BatchFeature {
  return quietSearchFeature({ listId: 0, radius: params.radius });
}
