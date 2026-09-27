// aggrun.js：按合并预算聚合采样到栈前缀树，预算用尽连栈压账，收尾清账
import { pathsOf, depthOf } from "./frames.js";

const DEFAULTS = {
  duplicate_error_code: "E_DUPLICATE_SAMPLE",
  depth_error_code: "E_DEPTH_LIMIT",
  pending_error_code: "E_NOT_PENDING",
  event_error_code: "E_BAD_EVENT"
};

function makeError(spec, key, message) {
  const code = spec[key] || DEFAULTS[key];
  const error = new Error(message);
  error.code = code;
  return error;
}

function cloneState(state) {
  const source = state || {};
  return {
    tree: Object.assign({}, source.tree || {}),
    pending: (source.pending || []).map(function (row) { return row.slice(); }),
    merged: (source.merged || []).slice(),
    applied: (source.applied || []).slice(),
    ledger: (source.ledger || []).map(function (row) {
      return { sample: row.sample, stack: row.stack.slice(), count: row.count };
    })
  };
}

function addToTree(tree, stack, delta) {
  pathsOf(stack).forEach(function (path) {
    tree[path] = (tree[path] || 0) + delta;
    if (tree[path] === 0) delete tree[path];
  });
}

// 把账上的采样按可用预算合并进树；available 为 Infinity 时全清
function drainPending(state, available) {
  let mergedCount = 0;
  while (state.pending.length > 0 && mergedCount < available) {
    const row = state.pending.shift();
    addToTree(state.tree, JSON.parse(row[1]), row[2]);
    state.merged.push(row[0]);
    state.ledger.push({ sample: row[0], stack: JSON.parse(row[1]), count: row[2] });
    mergedCount += 1;
  }
  return mergedCount;
}

export function step(spec) {
  const input = spec || {};
  const events = input.events || [];
  const budget = input.budget || 0;
  const depthLimit = input.depth_limit;
  const state = cloneState(input.state);

  let remaining = budget;
  let mergedNow = drainPending(state, remaining);
  remaining -= mergedNow;
  let judged = 0;

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event || typeof event !== "object" || !event.kind) {
      throw makeError(input, "event_error_code", "事件不合法：缺少 kind");
    }
    if (event.id !== undefined && state.applied.indexOf(event.id) !== -1) {
      continue; // 重放：同一条事件已处理过，静默跳过
    }

    if (event.kind === "sample") {
      if (typeof event.sample !== "string" || !Array.isArray(event.stack)
          || typeof event.count !== "number" || !(event.count > 0)) {
        throw makeError(input, "event_error_code", "事件不合法：sample 字段缺失");
      }
      if (state.pending.some(function (row) { return row[0] === event.sample; })
          || state.merged.indexOf(event.sample) !== -1) {
        throw makeError(input, "duplicate_error_code", "重复采样：" + event.sample);
      }
      if (depthLimit !== undefined && depthOf(event.stack) > depthLimit) {
        throw makeError(input, "depth_error_code",
          "栈深超过上限：" + depthOf(event.stack) + " > " + depthLimit);
      }
      if (remaining > 0) {
        addToTree(state.tree, event.stack, event.count);
        state.merged.push(event.sample);
        state.ledger.push({ sample: event.sample, stack: event.stack.slice(), count: event.count });
        remaining -= 1;
        mergedNow += 1;
      } else {
        state.pending.push([event.sample, JSON.stringify(event.stack), event.count]);
      }
      judged += 1;
      if (event.id !== undefined) state.applied.push(event.id);
    } else if (event.kind === "drop") {
      if (typeof event.sample !== "string") {
        throw makeError(input, "event_error_code", "事件不合法：drop 缺少 sample");
      }
      const pendingIndex = state.pending.findIndex(function (row) { return row[0] === event.sample; });
      const ledgerIndex = state.ledger.findIndex(function (row) { return row.sample === event.sample; });
      if (pendingIndex !== -1) {
        state.pending.splice(pendingIndex, 1); // 还在账上：直接撤，未进树
      } else if (ledgerIndex !== -1) {
        const row = state.ledger[ledgerIndex];
        addToTree(state.tree, row.stack, -row.count); // 已进树：把贡献撤出来
        state.ledger.splice(ledgerIndex, 1);
        state.merged.splice(state.merged.indexOf(row.sample), 1);
      } else {
        throw makeError(input, "pending_error_code", "账外采样，无法撤销：" + event.sample);
      }
      judged += 1;
      if (event.id !== undefined) state.applied.push(event.id);
    } else {
      throw makeError(input, "event_error_code", "事件不合法：未知 kind " + event.kind);
    }
  }

  return {
    state: state,
    merged: mergedNow,
    pending_before: state.pending.length,
    pending_ids: state.pending.map(function (row) { return row[0]; }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  const input = spec || {};
  const state = cloneState(input.state);
  const catchup = drainPending(state, Infinity);
  return { state: state, catchup: catchup };
}
