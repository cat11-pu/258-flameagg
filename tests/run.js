import assert from "node:assert";
import { pathsOf, depthOf } from "../frames.js";
import { step, close } from "../aggrun.js";
import { render } from "../app.js";

const base = {
  budget: 2, depth_limit: 4,
  state: { tree: {}, pending: [], merged: [], applied: [] },
  events: [],
  duplicate_error_code: "E_DUPLICATE_SAMPLE", depth_error_code: "E_DEPTH_LIMIT",
  pending_error_code: "E_NOT_PENDING", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("pathsOf returns a list", () => {
  assert.ok(Array.isArray(pathsOf(["main"])));
});

check("depthOf returns a number", () => {
  assert.strictEqual(typeof depthOf(["main"]), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
