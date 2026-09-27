// app.js：渲染结果
import { pathsOf, depthOf } from "./frames.js";
import { step, close } from "./aggrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      tree: Object.keys(state.tree).sort().map(function (path) { return [path, state.tree[path]]; }),
      pending: state.pending.map(function (row) { return row.join(":"); }),
      applied: state.applied.length
    });
  };
  const paths = Object.keys(closed.state.tree).sort();
  const tree = paths.map(function (path) { return [path, closed.state.tree[path]]; });
  return { tree: tree, total: paths.reduce(function (sum, path) { return sum + closed.state.tree[path]; }, 0),
           merged_first: first.merged, merged_wide: wide.merged,
           pair_differs: first.merged !== wide.merged,
           pending_before: first.pending_before, pending_ids: first.pending_ids,
           catchup: closed.catchup, pending_after: closed.state.pending.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.merged, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length, tail: pathsOf(["main"]).length + depthOf(["main"]) };
}
