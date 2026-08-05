import { randomUUID } from "node:crypto";
import type { DbClient } from "./db.ts";
import { demoShowsRealTenantNames } from "./demo.ts";
import { buildCurrentPortfolioDemoPlan } from "./domain/current-portfolio-demo.ts";

function iso(date: Date): string { return date.toISOString().slice(0,10); }
function monthAt(asOf:Date,offset:number):Date { return new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()+offset,1)); }
function dateInMonth(month:Date,day:number):string { return iso(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(day,28)))); }

async function addAudit(client:DbClient,action:string,entityType:string,entityId:string|null,detail:Record<string,unknown>={}):Promise<void>{
  await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,$2,$3,$4,$5::jsonb)`,[
    randomUUID(),action,entityType,entityId,JSON.stringify(detail),
  ]);
}

async function postPayment(client:DbClient,input:{propertyId:string;tenantId:string;payerName:string;amountCents:number;receivedDate:string;method:string;reference:string;notes:string}):Promise<string>{
  const paymentId=randomUUID();
  const open=await client.query<{id:string;balance_cents:string}>(`SELECT c.id,
      (c.amount_cents
        + COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=c.id),0)
        - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0)
      )::text AS balance_cents
    FROM charges c WHERE c.property_id=$1 AND c.tenant_id=$2 AND c.reverses_charge_id IS NULL
    ORDER BY c.due_date,c.created_at,c.id FOR UPDATE`,[input.propertyId,input.tenantId]);
  await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reference,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[paymentId,input.propertyId,input.tenantId,input.payerName,input.amountCents,input.receivedDate,input.method,input.reference,input.notes]);
  let remaining=input.amountCents;
  for(const charge of open.rows){
    if(remaining<=0) break;
    const balance=Number(charge.balance_cents);
    if(balance<=0) continue;
    const amount=Math.min(balance,remaining);
    await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents) VALUES($1,$2,$3,$4)`,[randomUUID(),paymentId,charge.id,amount]);
    remaining-=amount;
  }
  return paymentId;
}

async function reversePayment(client:DbClient,paymentId:string,reversalDate:string,reason:string):Promise<void>{
  const original=await client.query<{property_id:string;tenant_id:string;payer_name:string;amount_cents:string;method:string;reference:string|null}>(
    `SELECT property_id,tenant_id,payer_name,amount_cents::text,method,reference FROM payments WHERE id=$1`,[paymentId],
  );
  const row=original.rows[0];
  if(!row) throw new Error("Demo reversal source payment was not found");
  const reversalId=randomUUID();
  await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reference,notes,reverses_payment_id,reversal_reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[
      reversalId,row.property_id,row.tenant_id,row.payer_name,-Number(row.amount_cents),reversalDate,row.method,row.reference,
      "Returned payment — sales demonstration",paymentId,reason,
    ]);
  const allocations=await client.query<{id:string;charge_id:string;amount_cents:string}>(
    `SELECT id,charge_id,amount_cents::text FROM payment_allocations WHERE payment_id=$1 AND reverses_allocation_id IS NULL`,[paymentId],
  );
  for(const allocation of allocations.rows){
    await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents,reverses_allocation_id,reversal_reason)
      VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),reversalId,allocation.charge_id,-Number(allocation.amount_cents),allocation.id,reason]);
  }
}

export async function resetDemoPortfolio(client:DbClient,asOf=new Date()):Promise<void>{
  await client.query(`TRUNCATE TABLE
    import_review_items,payment_allocations,payments,charges,expenses,lease_rent_terms,lease_tenants,leases,tenants,units,properties,
    import_batches,export_runs,audit_log,app_settings`);

  const plan=buildCurrentPortfolioDemoPlan(asOf,{showRealTenantNames:demoShowsRealTenantNames()});
  await client.query(`INSERT INTO app_settings(id,owner_key,property_count_target,portfolio_unit_type,phone_access_required,historical_import_months,setup_completed_at,updated_at)
    VALUES($1,'demo-owner',$2,'single-family',true,3,now(),now())`,[randomUUID(),plan.properties.length]);

  await client.query(`INSERT INTO import_batches(id,filename,status,imported_rows,created_at) VALUES($1,'Mill_Creek_Manor.xlsx','committed',$2,now()-interval '2 days')`,[
    plan.importBatchId,plan.charges.length+plan.payments.length,
  ]);
  await client.query(`INSERT INTO import_batches(id,filename,status,imported_rows,created_at) VALUES($1,'unmapped-legacy-rows.csv','failed',0,now()-interval '1 day')`,[randomUUID()]);

  for(const property of plan.properties) await client.query(`INSERT INTO properties(id,address_line1,city,region,postal_code,notes) VALUES($1,$2,$3,$4,$5,$6)`,[
    property.id,property.address,property.city,property.region,property.postalCode,property.notes,
  ]);
  for(const unit of plan.units) await client.query(`INSERT INTO units(id,property_id,name) VALUES($1,$2,$3)`,[unit.id,unit.propertyId,unit.name]);
  for(const tenant of plan.tenants) await client.query(`INSERT INTO tenants(id,full_name,notes) VALUES($1,$2,$3)`,[tenant.id,tenant.fullName,tenant.notes]);
  for(const lease of plan.leases){
    await client.query(`INSERT INTO leases(id,unit_id,start_date,due_day,deposit_contract_cents,status,notes) VALUES($1,$2,$3,$4,0,'active','Current portfolio demo lease')`,[
      lease.id,lease.unitId,lease.startDate,lease.dueDay,
    ]);
    await client.query(`INSERT INTO lease_tenants(id,lease_id,tenant_id,is_primary) VALUES($1,$2,$3,true)`,[randomUUID(),lease.id,lease.tenantId]);
    await client.query(`INSERT INTO lease_rent_terms(id,lease_id,effective_from,rent_cents,due_day,reason) VALUES($1,$2,$3,$4,$5,'Standing rent from tenant roster')`,[
      randomUUID(),lease.id,lease.startDate,lease.rentCents,lease.dueDay,
    ]);
  }
  for(const charge of plan.charges) await client.query(`INSERT INTO charges(id,property_id,unit_id,lease_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date,import_batch_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[
      charge.id,charge.propertyId,charge.unitId,charge.leaseId,charge.tenantId,charge.chargeType,charge.description,charge.amountCents,charge.effectiveDate,charge.dueDate,charge.importBatchId,
    ]);
  for(const payment of plan.payments) await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reference,notes,import_batch_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[
      payment.id,payment.propertyId,payment.tenantId,payment.payerName,payment.amountCents,payment.receivedDate,payment.method,payment.reference,payment.notes,payment.importBatchId,
    ]);
  for(const allocation of plan.allocations) await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents,import_batch_id) VALUES($1,$2,$3,$4,$5)`,[
    allocation.id,allocation.paymentId,allocation.chargeId,allocation.amountCents,allocation.importBatchId,
  ]);
  for(const item of plan.reviewItems) await client.query(`INSERT INTO import_review_items(id,import_batch_id,issue_type,subject,detail) VALUES($1,$2,$3,$4,$5)`,[
    item.id,item.importBatchId,item.issueType,item.subject,item.detail,
  ]);

  const currentMonth=monthAt(asOf,0);
  const reversalLease=plan.leases[8];
  const reversalTenant=plan.tenants.find(tenant=>tenant.id===reversalLease.tenantId)!;
  const returnedPayment=await postPayment(client,{
    propertyId:reversalLease.propertyId,tenantId:reversalLease.tenantId,payerName:reversalTenant.fullName,amountCents:reversalLease.rentCents,
    receivedDate:dateInMonth(currentMonth,2),method:"check",reference:"DEMO-RETURNED-CHECK",notes:"Temporary payment used to demonstrate linked reversal behavior",
  });
  await reversePayment(client,returnedPayment,dateInMonth(currentMonth,3),"Bank returned check for insufficient funds");

  await client.query(`INSERT INTO expenses(id,property_id,unit_id,category,description,amount_cents,expense_date,vendor) VALUES
    ($1,$2,$3,'Maintenance','Water-heater service',28500,$4,'Demo Maintenance Co.'),
    ($5,$6,NULL,'Landscaping','Portfolio lawn service',42000,$7,'Demo Grounds Co.'),
    ($8,$9,NULL,'Insurance','Landlord policy installment',97500,$10,'Demo Mutual')`,[
      randomUUID(),plan.properties[1].id,plan.units[1].id,dateInMonth(currentMonth,2),
      randomUUID(),plan.properties[6].id,dateInMonth(currentMonth,3),
      randomUUID(),plan.properties[14].id,dateInMonth(monthAt(asOf,-1),18),
    ]);

  await client.query(`INSERT INTO export_runs(id,export_version,trigger_type,json_blob_url,csv_blob_url,checksum,status,created_at)
    VALUES($1,1,'scheduled',NULL,NULL,$2,'complete',now()-interval '8 hours')`,[randomUUID(),"d".repeat(64)]);

  await addAudit(client,"demo.reset","portfolio",null,{properties:plan.properties.length,activeLeases:plan.leases.length,importReviewItems:plan.reviewItems.length,realTenantNames:demoShowsRealTenantNames(),asOf:iso(asOf)});
  await addAudit(client,"payment.reversed","payment",returnedPayment,{reason:"Bank returned check for insufficient funds"});
  await addAudit(client,"import.review_created","import_batch",plan.importBatchId,{openItems:plan.reviewItems.length});
}
