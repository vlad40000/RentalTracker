import test from "node:test";
import assert from "node:assert/strict";
import { allocateOldestFirst, chargeBalance, generateRentCharges, unappliedAmount } from "../lib/domain/ledger.ts";

test("monthly charge generation is idempotent",()=>{
  const request={leaseId:"lease-1",rentTermId:"term-1",periodStart:"2026-08-01",amountCents:150000,dueDate:"2026-08-05"};
  const first=generateRentCharges([], [request]);
  assert.equal(first.length,1);
  const second=generateRentCharges(first,[request]);
  assert.equal(second.length,0);
});

test("partial payment leaves the correct charge balance",()=>{
  const charges=[{id:"charge-1",amountCents:150000,dueDate:"2026-08-05"}];
  const payment={id:"payment-1",amountCents:60000};
  const allocations=allocateOldestFirst(payment,charges,[]);
  assert.deepEqual(allocations.map(a=>a.amountCents),[60000]);
  assert.equal(chargeBalance("charge-1",charges,allocations),90000);
  assert.equal(unappliedAmount(payment,allocations),0);
});

test("one payment can span multiple charges and retain an unapplied remainder",()=>{
  const charges=[
    {id:"older",amountCents:100000,dueDate:"2026-07-05"},
    {id:"newer",amountCents:80000,dueDate:"2026-08-05"},
  ];
  const payment={id:"payment-1",amountCents:200000};
  const allocations=allocateOldestFirst(payment,charges,[]);
  assert.deepEqual(allocations.map(a=>[a.chargeId,a.amountCents]),[["older",100000],["newer",80000]]);
  assert.equal(chargeBalance("older",charges,allocations),0);
  assert.equal(chargeBalance("newer",charges,allocations),0);
  assert.equal(unappliedAmount(payment,allocations),20000);
});

test("negative reversal allocation restores the original balance",()=>{
  const charges=[{id:"charge-1",amountCents:150000,dueDate:"2026-08-05"}];
  const allocations=[
    {id:"a1",paymentId:"p1",chargeId:"charge-1",amountCents:150000},
    {id:"a2",paymentId:"p2",chargeId:"charge-1",amountCents:-150000},
  ];
  assert.equal(chargeBalance("charge-1",charges,allocations),150000);
});


test("imported rent for the same lease and month prevents duplicate generation",()=>{
  const existing=[{id:"imported-rent",amountCents:150000,dueDate:"2026-08-05",leaseId:"lease-1",periodStart:"2026-08-01"}];
  const request={leaseId:"lease-1",rentTermId:"term-1",periodStart:"2026-08-01",amountCents:150000,dueDate:"2026-08-05"};
  assert.equal(generateRentCharges(existing,[request]).length,0);
});
