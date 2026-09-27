// aggrun.js：按合并预算聚合并留账
import { pathsOf, depthOf } from "./frames.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codesOf(spec) {
  return {
    duplicate: spec.duplicate_error_code || "E_DUPLICATE_SAMPLE",
    depth: spec.depth_error_code || "E_DEPTH_LIMIT",
    pending: spec.pending_error_code || "E_NOT_PENDING",
    event: spec.event_error_code || "E_BAD_EVENT"
  };
}

function cloneRow(row) {
  return [row[0], (Array.isArray(row[1]) ? row[1].slice() : []), row[2]];
}

function cloneState(state) {
  const src = state || {};
  return {
    tree: Object.assign({}, src.tree || {}),
    pending: (src.pending || []).map(cloneRow),
    merged: (src.merged || []).map(cloneRow),
    applied: (src.applied || []).slice()
  };
}

function checkEvent(event, code) {
  if (!event || typeof event !== "object") fail(code, "event is not an object");
  if (event.kind === "sample") {
    if (typeof event.sample !== "string" || !Array.isArray(event.stack)
        || typeof event.count !== "number") {
      fail(code, "bad sample event");
    }
  } else if (event.kind === "drop") {
    if (typeof event.sample !== "string") fail(code, "bad drop event");
  } else {
    fail(code, "unknown event kind");
  }
}

function mergeInto(state, sample, stack, count) {
  for (const path of pathsOf(stack)) {
    state.tree[path] = (state.tree[path] || 0) + count;
  }
  state.merged.push([sample, stack.slice(), count]);
}

function dropFrom(state, sample, applied) {
  const pendAt = state.pending.findIndex((row) => row[0] === sample);
  if (pendAt >= 0) {
    state.pending.splice(pendAt, 1);
    return true;
  }
  const mergedAt = state.merged.findIndex((row) => row[0] === sample);
  if (mergedAt >= 0) {
    const row = state.merged[mergedAt];
    state.merged.splice(mergedAt, 1);
    for (const path of pathsOf(row[1])) {
      const next = (state.tree[path] || 0) - row[2];
      if (next === 0) delete state.tree[path];
      else state.tree[path] = next;
    }
    return true;
  }
  return applied.has(sample);
}

export function step(spec) {
  const codes = codesOf(spec);
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  const limit = spec.depth_limit == null ? Infinity : spec.depth_limit;
  let budget = spec.budget == null ? 0 : spec.budget;
  let merged = 0;
  let judged = 0;
  const seen = new Set();
  const applied = new Set(state.applied);

  for (const event of events) {
    checkEvent(event, codes.event);
    judged += 1;
    if (event.kind === "sample") {
      if (seen.has(event.sample)) fail(codes.duplicate, "duplicate sample " + event.sample);
      seen.add(event.sample);
      if (applied.has(event.sample)) continue;
      if (depthOf(event.stack) > limit) fail(codes.depth, "stack too deep for " + event.sample);
      if (budget > 0) {
        budget -= 1;
        mergeInto(state, event.sample, event.stack, event.count);
        merged += 1;
      } else {
        state.pending.push([event.sample, event.stack.slice(), event.count]);
      }
      applied.add(event.sample);
      state.applied.push(event.sample);
    } else if (!dropFrom(state, event.sample, applied)) {
      fail(codes.pending, "sample not pending " + event.sample);
    }
  }

  return { state: state, merged: merged,
           pending_before: state.pending.length,
           pending_ids: state.pending.map((row) => row[0]),
           judged: judged, judged_bound: events.length };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  for (const row of state.pending) {
    mergeInto(state, row[0], row[1], row[2]);
    catchup += 1;
  }
  state.pending = [];
  return { state: state, catchup: catchup };
}
