import { randomUUID } from "node:crypto";
import type { DbClient } from "@/lib/db";
import { dueDateForMonth, monthLabel } from "@/lib/dates";
import { allocateOldestFirst, type AllocationEntry, type ChargeEntry } from "@/lib/domain/ledger";
import { toSafeCents } from "@/lib/money";

export async function generateMonthlyCharges(client: DbClient, periodStart: string): Promise<number> {
  const terms = await client.query<{ lease_id:string; term_id:string; property_id:string; unit_id:string; tenant_id:string|null; rent_cents:string; due_day:number }>(`SELECT l.id AS lease_id,rt.id AS term_id,u.property_id,l.unit_id,lt.tenant_id,rt.rent_cents::text,rt.due_day
    FROM leases l
    JOIN units u ON u.id=l.unit_id
    JOIN lease_rent_terms rt ON rt.lease_id=l.id AND rt.deleted_at IS NULL
      AND rt.effective_from <= $1::date AND (rt.effective_through IS NULL OR rt.effective_through >= $1::date)
    LEFT JOIN lease_tenants lt ON lt.lease_id=l.id AND lt.is_primary AND lt.deleted_at IS NULL
    WHERE l.status='active' AND l.deleted_at IS NULL
      AND l.start_date <= ($1::date + interval '1 month - 1 day')::date
      AND (l.end_date IS NULL OR l.end_date >= $1::date)
    ORDER BY rt.effective_from DESC`, [periodStart]);
  let inserted = 0;
  const seenLeases = new Set<string>();
  for (const term of terms.rows) {
    if (seenLeases.has(term.lease_id)) continue;
    seenLeases.add(term.lease_id);
    const key = `${term.lease_id}:${term.term_id}:${periodStart}:rent`;
    const result = await client.query(`INSERT INTO charges(id,property_id,unit_id,lease_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date,generation_key)
      SELECT $1,$2,$3,$4,$5,'rent',$6,$7,$8,$9,$10
      WHERE NOT EXISTS (
        SELECT 1 FROM charges existing
        WHERE existing.lease_id=$4 AND existing.charge_type='rent' AND existing.effective_date=$8::date
          AND existing.reverses_charge_id IS NULL
          AND existing.amount_cents+COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=existing.id),0)<>0
      )
      ON CONFLICT(generation_key) DO NOTHING`, [randomUUID(),term.property_id,term.unit_id,term.lease_id,term.tenant_id,`Rent — ${monthLabel(periodStart)}`,term.rent_cents,periodStart,dueDateForMonth(periodStart,term.due_day),key]);
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export async function recordPaymentAndAllocate(client: DbClient, input: {
  propertyId:string; tenantId?:string|null; payerName:string; amountCents:number; receivedDate:string;
  method:string; reference?:string|null; notes?:string|null; importBatchId?:string|null;
}): Promise<{ paymentId:string; allocatedCents:number; unappliedCents:number }> {
  if (input.amountCents <= 0) throw new Error("Payment amount must be positive");
  const activeProperty=await client.query(`SELECT 1 FROM properties WHERE id=$1 AND deleted_at IS NULL`,[input.propertyId]);
  if(activeProperty.rows.length!==1) throw new Error("Payments can only be posted to an active property");
  const paymentId = randomUUID();
  const openRows = await client.query<{ id:string; amount_cents:string; due_date:string; allocated_cents:string; reversal_cents:string }>(`SELECT c.id,c.amount_cents::text,c.due_date::text,
      COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0)::text AS allocated_cents,
      COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=c.id),0)::text AS reversal_cents
    FROM charges c
    WHERE c.property_id=$1
      AND c.reverses_charge_id IS NULL
      AND ($2::uuid IS NULL OR c.tenant_id=$2::uuid)
    ORDER BY c.due_date,c.created_at FOR UPDATE`, [input.propertyId,input.tenantId||null]);
  const charges: ChargeEntry[] = openRows.rows.map((row) => ({ id:row.id, dueDate:row.due_date, amountCents:toSafeCents(row.amount_cents)+toSafeCents(row.reversal_cents) }));
  const existingAllocations: AllocationEntry[] = openRows.rows.flatMap((row) => {
    const allocated = toSafeCents(row.allocated_cents);
    return allocated === 0 ? [] : [{ id:`existing:${row.id}`,paymentId:"existing",chargeId:row.id,amountCents:allocated }];
  });
  const allocations = allocateOldestFirst({id:paymentId,amountCents:input.amountCents},charges,existingAllocations);
  await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reference,notes,import_batch_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [paymentId,input.propertyId,input.tenantId||null,input.payerName,input.amountCents,input.receivedDate,input.method,input.reference||null,input.notes||null,input.importBatchId||null]);
  for (const allocation of allocations) {
    await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents,import_batch_id) VALUES($1,$2,$3,$4,$5)`, [randomUUID(),paymentId,allocation.chargeId,allocation.amountCents,input.importBatchId||null]);
  }
  const allocatedCents = allocations.reduce((sum,item)=>sum+item.amountCents,0);
  return {paymentId,allocatedCents,unappliedCents:input.amountCents-allocatedCents};
}

export async function reverseImportBatch(client: DbClient, batchId:string, reason:string): Promise<void> {
  const batch = await client.query<{status:string}>(`SELECT status FROM import_batches WHERE id=$1 FOR UPDATE`,[batchId]);
  if (batch.rows.length !== 1) throw new Error("Import batch not found");
  if (batch.rows[0].status !== "committed") throw new Error("Only a committed import can be reversed");

  const payments = await client.query<{id:string;property_id:string;tenant_id:string|null;payer_name:string;amount_cents:string;received_date:string;method:string}>(`SELECT id,property_id,tenant_id,payer_name,amount_cents::text,received_date::text,method FROM payments WHERE import_batch_id=$1 AND reverses_payment_id IS NULL`,[batchId]);
  for (const row of payments.rows) {
    const reversalPaymentId=randomUUID();
    await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reverses_payment_id,reversal_reason,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[reversalPaymentId,row.property_id,row.tenant_id,row.payer_name,-toSafeCents(row.amount_cents),row.received_date,row.method,row.id,reason,`Reversal of imported payment ${row.id}`]);
    const allocations = await client.query<{id:string;charge_id:string;amount_cents:string}>(`SELECT id,charge_id,amount_cents::text FROM payment_allocations WHERE payment_id=$1 AND reverses_allocation_id IS NULL`,[row.id]);
    for (const allocation of allocations.rows) {
      await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents,reverses_allocation_id,reversal_reason) VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),reversalPaymentId,allocation.charge_id,-toSafeCents(allocation.amount_cents),allocation.id,reason]);
    }
  }
  const charges = await client.query<{id:string;property_id:string;unit_id:string|null;lease_id:string|null;tenant_id:string|null;amount_cents:string;effective_date:string;due_date:string}>(`SELECT id,property_id,unit_id,lease_id,tenant_id,amount_cents::text,effective_date::text,due_date::text FROM charges WHERE import_batch_id=$1 AND reverses_charge_id IS NULL`,[batchId]);
  for (const row of charges.rows) {
    await client.query(`INSERT INTO charges(id,property_id,unit_id,lease_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date,reverses_charge_id,reversal_reason) VALUES($1,$2,$3,$4,$5,'reversal',$6,$7,$8,$9,$10,$11)`,[randomUUID(),row.property_id,row.unit_id,row.lease_id,row.tenant_id,`Reversal of imported charge ${row.id}`,-toSafeCents(row.amount_cents),row.effective_date,row.due_date,row.id,reason]);
  }
  const expenses = await client.query<{id:string;property_id:string;unit_id:string|null;category:string;description:string;amount_cents:string;expense_date:string}>(`SELECT id,property_id,unit_id,category,description,amount_cents::text,expense_date::text FROM expenses WHERE import_batch_id=$1 AND reverses_expense_id IS NULL`,[batchId]);
  for (const row of expenses.rows) {
    await client.query(`INSERT INTO expenses(id,property_id,unit_id,category,description,amount_cents,expense_date,reverses_expense_id,reversal_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),row.property_id,row.unit_id,row.category,`Reversal — ${row.description}`,-toSafeCents(row.amount_cents),row.expense_date,row.id,reason]);
  }
  await client.query(`UPDATE import_review_items SET status='dismissed',resolution_note=$2,resolved_at=now() WHERE import_batch_id=$1 AND status='open'`,[batchId,`Import batch reversed: ${reason}`]);
  await client.query(`UPDATE import_batches SET status='reversed',reversed_at=now(),reverse_reason=$2 WHERE id=$1`,[batchId,reason]);
}
