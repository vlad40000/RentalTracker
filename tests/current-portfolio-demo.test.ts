import test from "node:test";
import assert from "node:assert/strict";
import { buildCurrentPortfolioDemoPlan, summarizeCurrentPortfolioPlan } from "../lib/domain/current-portfolio-demo.ts";

function ids(){let value=0;return()=>`id-${++value}`;}

test("current portfolio demo preserves imported ledger totals and review queue",()=>{
  const plan=buildCurrentPortfolioDemoPlan(new Date("2026-08-05T12:00:00.000Z"),{idFactory:ids()});
  assert.equal(plan.properties.length,17);
  assert.equal(plan.units.length,17);
  assert.equal(plan.tenants.length,17);
  assert.equal(plan.leases.length,17);
  assert.equal(plan.charges.length,90);
  assert.equal(plan.payments.length,42);
  assert.equal(plan.allocations.length,89);
  assert.equal(plan.reviewItems.length,16);
  assert.deepEqual(summarizeCurrentPortfolioPlan(plan),{
    totalOwedCents:400694,
    creditHeldCents:45438,
    netPositionCents:355256,
  });
});

test("tenant names are masked unless controlled demo mode explicitly enables them",()=>{
  const masked=buildCurrentPortfolioDemoPlan(new Date("2026-08-05T12:00:00.000Z"),{idFactory:ids()});
  const real=buildCurrentPortfolioDemoPlan(new Date("2026-08-05T12:00:00.000Z"),{idFactory:ids(),showRealTenantNames:true});
  assert.equal(masked.tenants[0].fullName,"R. Alvarez");
  assert.equal(real.tenants[0].fullName,"Aaron Dunn");
  assert.equal(masked.reviewItems[0].subject,"J. Ibarra");
});

test("current-month payment dates never seed into the future",()=>{
  const plan=buildCurrentPortfolioDemoPlan(new Date("2026-08-05T12:00:00.000Z"),{idFactory:ids()});
  assert.ok(plan.payments.every(payment=>payment.receivedDate<="2026-08-05"));
});
