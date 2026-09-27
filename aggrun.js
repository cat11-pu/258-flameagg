// aggrun.js：按合并预算聚合并留账（基线：一律给空表）
import { pathsOf, depthOf } from "./frames.js";

export function step(spec) {
  return { state: spec.state, merged: 0, pending_before: 0, pending_ids: [],
           judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
