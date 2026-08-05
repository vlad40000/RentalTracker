import test from "node:test";
import assert from "node:assert/strict";
import { createExportPackage, restoreIntoEmpty, validateExportPackage } from "../lib/domain/export-roundtrip.ts";

test("export -> wipe -> restore round-trip preserves every table and ID",()=>{
  const state:Record<string,unknown[]>={
    app_settings:[{id:"settings-1",owner_key:"demo-owner"}],
    properties:[{id:"property-1",address:"125 Demo Street",deleted_at:null}],
    units:[{id:"unit-1",property_id:"property-1"}],
    tenants:[{id:"tenant-1",full_name:"Jordan Ellis"}],
    leases:[{id:"lease-1",unit_id:"unit-1"}],
    lease_tenants:[{id:"lt-1",lease_id:"lease-1",tenant_id:"tenant-1"}],
    lease_rent_terms:[{id:"term-1",lease_id:"lease-1",rent_cents:150000}],
    import_batches:[],
    import_review_items:[],
    charges:[{id:"charge-1",property_id:"property-1",amount_cents:150000}],
    payments:[{id:"payment-1",property_id:"property-1",amount_cents:150000}],
    payment_allocations:[{id:"allocation-1",payment_id:"payment-1",charge_id:"charge-1",amount_cents:150000}],
    expenses:[{id:"expense-1",property_id:"property-1",amount_cents:10000}],
    export_runs:[],
    audit_log:[{id:"audit-1",action:"seeded"}],
  };
  const exported=createExportPackage(state,"2026-08-05T12:00:00.000Z");
  validateExportPackage(exported);
  const wiped=Object.fromEntries(Object.keys(state).map(key=>[key,[]])) as typeof state;
  const restored=restoreIntoEmpty(wiped,exported);
  assert.deepEqual(restored,state);
});

test("restore refuses a non-empty target",()=>{
  const state={properties:[{id:"property-1"}]};
  const exported=createExportPackage(state);
  assert.throws(()=>restoreIntoEmpty(state,exported),/must be empty/);
});

test("checksum detects altered export contents",()=>{
  const exported=createExportPackage({properties:[{id:"property-1"}]});
  exported.tables.properties[0]={id:"tampered"};
  assert.throws(()=>validateExportPackage(exported),/checksum/);
});


test("serialized export validates after Date and bigint normalization",()=>{
  const exported=createExportPackage({audit_log:[{id:"a1",created_at:new Date("2026-08-05T12:00:00.000Z"),amount:10n}]});
  const parsed=JSON.parse(JSON.stringify(exported,(_key,value)=>typeof value==='bigint'?value.toString():value));
  validateExportPackage(parsed);
});
