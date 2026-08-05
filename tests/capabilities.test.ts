import test from "node:test";
import assert from "node:assert/strict";
import { deriveCapabilities } from "../lib/capabilities.ts";

const base = {
  property_count_target: 3,
  portfolio_unit_type: "single-family" as const,
  phone_access_required: true,
  historical_import_months: 0,
  setup_completed_at: "2026-08-05T00:00:00.000Z",
};

test("actual property count overrides the setup estimate for density", () => {
  assert.equal(deriveCapabilities(base, 6).densePortfolio, true);
  assert.equal(deriveCapabilities({...base, property_count_target: 9}, 2).densePortfolio, false);
});

test("setup answers derive navigation and presentation capabilities", () => {
  const capabilities = deriveCapabilities({
    ...base,
    portfolio_unit_type: "mixed",
    phone_access_required: false,
    historical_import_months: 18,
  }, 0);
  assert.equal(capabilities.showUnitsByDefault, true);
  assert.equal(capabilities.mobilePriority, false);
  assert.equal(capabilities.showImportInPrimaryNav, true);
});
