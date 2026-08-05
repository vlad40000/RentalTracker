import test from "node:test";
import assert from "node:assert/strict";
import { demoShowsRealTenantNames, isDemoMode } from "../lib/demo.ts";

test("sales demo access defaults on without environment configuration", () => {
  assert.equal(isDemoMode({}), true);
  assert.equal(isDemoMode({ DEMO_MODE: "true" }), true);
});

test("demo access is disabled only by an explicit false value", () => {
  assert.equal(isDemoMode({ DEMO_MODE: "false" }), false);
  assert.equal(isDemoMode({ DEMO_MODE: "FALSE" }), false);
});

test("real tenant names remain opt-in", () => {
  assert.equal(demoShowsRealTenantNames({}), false);
  assert.equal(demoShowsRealTenantNames({ DEMO_SHOW_REAL_TENANT_NAMES: "true" }), true);
});
