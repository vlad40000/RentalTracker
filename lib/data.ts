import { maybeOne, query } from "@/lib/db";
import { monthStartIso, todayIso } from "@/lib/dates";
import { toSafeCents } from "@/lib/money";

export type Settings = {
  property_count_target: number;
  portfolio_unit_type: "single-family" | "multi-unit" | "mixed";
  phone_access_required: boolean;
  historical_import_months: number;
  setup_completed_at: string;
};

export async function getSettings(): Promise<Settings | null> {
  return maybeOne<Settings>(`SELECT property_count_target, portfolio_unit_type, phone_access_required,
    historical_import_months, setup_completed_at::text FROM app_settings WHERE owner_key = 'demo-owner'`);
}

export type DashboardData = {
  totalBalanceCents: number;
  collectedThisMonthCents: number;
  expensesThisMonthCents: number;
  ytdNetCents: number;
  creditHeldCents: number;
  openImportReviewCount: number;
  propertyCount: number;
  activeLeaseCount: number;
  vacantUnitCount: number;
  attention: Array<{
    propertyId: string;
    address: string;
    tenantId: string | null;
    tenantName: string;
    oldestDueDate: string;
    balanceCents: number;
    daysLate: number;
  }>;
  propertySummaries: Array<{
    propertyId: string;
    address: string;
    city: string;
    unitCount: number;
    occupiedUnits: number;
    balanceCents: number;
    collectedThisMonthCents: number;
    expensesThisMonthCents: number;
  }>;
  recentActivity: Array<{
    id: string;
    entryType: "charge" | "payment" | "expense";
    entryDate: string;
    propertyAddress: string;
    description: string;
    amountCents: number;
  }>;
  lastExport: {createdAt:string;status:string;triggerType:string} | null;
};

export async function getActivePropertyCount(): Promise<number> {
  const [row] = await query<{count:number}>(`SELECT count(*)::int AS count FROM properties WHERE deleted_at IS NULL`);
  return row.count;
}

export async function getDashboardData(): Promise<DashboardData> {
  const monthStart = monthStartIso();
  const today = todayIso();
  const yearStart = `${today.slice(0,4)}-01-01`;
  const [
    balanceRows,collectedRows,expenseRows,ytdRows,creditRows,propertyRows,leaseRows,vacancyRows,
    attentionRows,summaryRows,activityRows,exportRows,reviewRows,
  ] = await Promise.all([
    query<{balance_cents:string}>(`SELECT COALESCE(SUM(effective_amount-allocated),0)::text AS balance_cents FROM (
      SELECT c.id,
        c.amount_cents+COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=c.id),0) AS effective_amount,
        COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0) AS allocated
      FROM charges c WHERE c.reverses_charge_id IS NULL
    ) balances`),
    query<{collected_cents:string}>(`SELECT COALESCE(SUM(amount_cents),0)::text AS collected_cents FROM payments WHERE received_date BETWEEN $1::date AND $2::date`,[monthStart,today]),
    query<{expense_cents:string}>(`SELECT COALESCE(SUM(amount_cents),0)::text AS expense_cents FROM expenses WHERE expense_date BETWEEN $1::date AND $2::date`,[monthStart,today]),
    query<{net_cents:string}>(`SELECT (
      COALESCE((SELECT SUM(amount_cents) FROM payments WHERE received_date BETWEEN $1::date AND $2::date),0)
      - COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE expense_date BETWEEN $1::date AND $2::date),0)
    )::text AS net_cents`,[yearStart,today]),
    query<{credit_cents:string}>(`SELECT COALESCE(SUM(GREATEST(p.amount_cents-COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.payment_id=p.id),0),0)),0)::text AS credit_cents
      FROM payments p WHERE p.reverses_payment_id IS NULL`),
    query<{count:number}>(`SELECT count(*)::int AS count FROM properties WHERE deleted_at IS NULL`),
    query<{count:number}>(`SELECT count(*)::int AS count FROM leases l JOIN units u ON u.id=l.unit_id JOIN properties p ON p.id=u.property_id WHERE l.status='active' AND l.deleted_at IS NULL AND u.deleted_at IS NULL AND p.deleted_at IS NULL`),
    query<{count:number}>(`SELECT count(*)::int AS count FROM units u JOIN properties p ON p.id=u.property_id WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.unit_id=u.id AND l.status='active' AND l.deleted_at IS NULL)`),
    query<{property_id:string;address:string;tenant_id:string|null;tenant_name:string|null;oldest_due_date:string;balance_cents:string}>(`WITH open_charges AS (
      SELECT c.property_id,c.tenant_id,c.due_date,
        c.amount_cents
        + COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=c.id),0)
        - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0) AS balance_cents
      FROM charges c WHERE c.reverses_charge_id IS NULL
    )
    SELECT oc.property_id,p.address_line1 AS address,oc.tenant_id,t.full_name AS tenant_name,
      min(oc.due_date)::text AS oldest_due_date,sum(oc.balance_cents)::text AS balance_cents
    FROM open_charges oc
    JOIN properties p ON p.id=oc.property_id
    LEFT JOIN tenants t ON t.id=oc.tenant_id
    WHERE oc.balance_cents>0 AND oc.due_date<$1::date AND p.deleted_at IS NULL
    GROUP BY oc.property_id,p.address_line1,oc.tenant_id,t.full_name
    ORDER BY min(oc.due_date),p.address_line1`,[today]),
    query<{property_id:string;address:string;city:string;unit_count:number;occupied_units:number;balance_cents:string;collected_cents:string;expense_cents:string}>(`SELECT p.id AS property_id,p.address_line1 AS address,p.city,
      (SELECT count(*)::int FROM units u WHERE u.property_id=p.id AND u.deleted_at IS NULL) AS unit_count,
      (SELECT count(*)::int FROM leases l JOIN units u ON u.id=l.unit_id WHERE u.property_id=p.id AND u.deleted_at IS NULL AND l.status='active' AND l.deleted_at IS NULL) AS occupied_units,
      (COALESCE((SELECT SUM(c.amount_cents) FROM charges c WHERE c.property_id=p.id),0)
        - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa JOIN charges c ON c.id=pa.charge_id WHERE c.property_id=p.id),0))::text AS balance_cents,
      COALESCE((SELECT SUM(pay.amount_cents) FROM payments pay WHERE pay.property_id=p.id AND pay.received_date BETWEEN $1::date AND $2::date),0)::text AS collected_cents,
      COALESCE((SELECT SUM(e.amount_cents) FROM expenses e WHERE e.property_id=p.id AND e.expense_date BETWEEN $1::date AND $2::date),0)::text AS expense_cents
    FROM properties p WHERE p.deleted_at IS NULL ORDER BY p.address_line1`,[monthStart,today]),
    query<{id:string;entry_type:"charge"|"payment"|"expense";entry_date:string;property_address:string;description:string;amount_cents:string}>(`WITH activity AS (
      SELECT c.id,'charge'::text AS entry_type,c.effective_date AS entry_date,p.address_line1 AS property_address,c.description,c.amount_cents,c.created_at
        FROM charges c JOIN properties p ON p.id=c.property_id
      UNION ALL
      SELECT pay.id,'payment',pay.received_date,p.address_line1,('Payment — '||pay.payer_name||' · '||pay.method),(-pay.amount_cents),pay.created_at
        FROM payments pay JOIN properties p ON p.id=pay.property_id
      UNION ALL
      SELECT e.id,'expense',e.expense_date,p.address_line1,(e.category||' — '||e.description),e.amount_cents,e.created_at
        FROM expenses e JOIN properties p ON p.id=e.property_id
    ) SELECT id,entry_type,entry_date::text,property_address,description,amount_cents::text FROM activity ORDER BY entry_date DESC,created_at DESC LIMIT 8`),
    query<{created_at:string;status:string;trigger_type:string}>(`SELECT created_at::text,status,trigger_type FROM export_runs ORDER BY created_at DESC LIMIT 1`),
    query<{count:number}>(`SELECT count(*)::int AS count FROM import_review_items WHERE status='open'`),
  ]);

  const todayTime = new Date(`${today}T00:00:00Z`).getTime();
  return {
    totalBalanceCents: toSafeCents(balanceRows[0].balance_cents),
    collectedThisMonthCents: toSafeCents(collectedRows[0].collected_cents),
    expensesThisMonthCents: toSafeCents(expenseRows[0].expense_cents),
    ytdNetCents: toSafeCents(ytdRows[0].net_cents),
    creditHeldCents: toSafeCents(creditRows[0].credit_cents),
    openImportReviewCount: reviewRows[0].count,
    propertyCount: propertyRows[0].count,
    activeLeaseCount: leaseRows[0].count,
    vacantUnitCount: vacancyRows[0].count,
    attention: attentionRows.map(row=>({
      propertyId:row.property_id,address:row.address,tenantId:row.tenant_id,tenantName:row.tenant_name??"Unassigned",
      oldestDueDate:row.oldest_due_date,balanceCents:toSafeCents(row.balance_cents),
      daysLate:Math.max(1,Math.floor((todayTime-new Date(`${row.oldest_due_date}T00:00:00Z`).getTime())/86_400_000)),
    })),
    propertySummaries: summaryRows.map(row=>({
      propertyId:row.property_id,address:row.address,city:row.city,unitCount:row.unit_count,occupiedUnits:row.occupied_units,
      balanceCents:toSafeCents(row.balance_cents),collectedThisMonthCents:toSafeCents(row.collected_cents),expensesThisMonthCents:toSafeCents(row.expense_cents),
    })),
    recentActivity: activityRows.map(row=>({
      id:row.id,entryType:row.entry_type,entryDate:row.entry_date,propertyAddress:row.property_address,description:row.description,amountCents:toSafeCents(row.amount_cents),
    })),
    lastExport:exportRows[0]?{createdAt:exportRows[0].created_at,status:exportRows[0].status,triggerType:exportRows[0].trigger_type}:null,
  };
}

export type PropertyListItem = {
  id: string;
  address_line1: string;
  city: string;
  region: string;
  postal_code: string;
  deleted_at: string | null;
  unit_count: number;
  balance_cents: number;
};

export async function getProperties(includeDeleted = false): Promise<PropertyListItem[]> {
  const rows = await query<Omit<PropertyListItem, "balance_cents"> & { balance_cents: string }>(`SELECT p.id, p.address_line1, p.city, p.region, p.postal_code,
      p.deleted_at::text, count(DISTINCT u.id)::int AS unit_count,
      COALESCE((SELECT SUM(c.amount_cents) FROM charges c WHERE c.property_id=p.id),0)
      - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa JOIN charges c2 ON c2.id=pa.charge_id WHERE c2.property_id=p.id),0) AS balance_cents
    FROM properties p
    LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
    WHERE ($1::boolean OR p.deleted_at IS NULL)
    GROUP BY p.id
    ORDER BY p.deleted_at NULLS FIRST, p.address_line1`, [includeDeleted]);
  return rows.map((row) => ({ ...row, balance_cents: toSafeCents(row.balance_cents) }));
}

export async function getPropertyDetail(id: string) {
  const property = await maybeOne<{
    id: string; address_line1: string; address_line2: string | null; city: string; region: string;
    postal_code: string; purchase_date: string | null; purchase_price_cents: string | null; notes: string | null;
    deleted_at: string | null;
  }>(`SELECT id,address_line1,address_line2,city,region,postal_code,purchase_date::text,purchase_price_cents::text,notes,deleted_at::text
      FROM properties WHERE id=$1`, [id]);
  if (!property) return null;
  const units = await query<{ id:string; name:string; bedrooms:string|null; bathrooms:string|null; deleted_at:string|null }>(`SELECT id,name,bedrooms::text,bathrooms::text,deleted_at::text FROM units WHERE property_id=$1 ORDER BY name`, [id]);
  const leases = await query<{ lease_id:string; unit_id:string; unit_name:string; start_date:string; end_date:string|null; status:string; due_day:number; tenant_id:string|null; tenant_name:string|null; rent_cents:string|null }>(`SELECT l.id AS lease_id,l.unit_id,u.name AS unit_name,l.start_date::text,l.end_date::text,l.status,l.due_day,
      t.id AS tenant_id,t.full_name AS tenant_name,
      (SELECT rt.rent_cents::text FROM lease_rent_terms rt WHERE rt.lease_id=l.id AND rt.deleted_at IS NULL ORDER BY rt.effective_from DESC LIMIT 1) AS rent_cents
    FROM leases l
    JOIN units u ON u.id=l.unit_id
    LEFT JOIN lease_tenants lt ON lt.lease_id=l.id AND lt.is_primary AND lt.deleted_at IS NULL
    LEFT JOIN tenants t ON t.id=lt.tenant_id
    WHERE u.property_id=$1 AND l.deleted_at IS NULL
    ORDER BY l.status='active' DESC,l.start_date DESC`, [id]);
  const payments = await query<{ id:string; received_date:string; payer_name:string; amount_cents:string; method:string; reference:string|null }>(`SELECT id,received_date::text,payer_name,amount_cents::text,method,reference FROM payments WHERE property_id=$1 ORDER BY received_date DESC,created_at DESC LIMIT 100`, [id]);
  const expenses = await query<{ id:string; expense_date:string; category:string; description:string; amount_cents:string; vendor:string|null; receipt_blob_url:string|null }>(`SELECT id,expense_date::text,category,description,amount_cents::text,vendor,receipt_blob_url FROM expenses WHERE property_id=$1 ORDER BY expense_date DESC,created_at DESC LIMIT 100`, [id]);
  const [net] = await query<{ received:string; spent:string }>(`SELECT
      COALESCE((SELECT SUM(amount_cents) FROM payments WHERE property_id=$1 AND received_date >= date_trunc('year',now())::date),0)::text AS received,
      COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE property_id=$1 AND expense_date >= date_trunc('year',now())::date),0)::text AS spent`, [id]);
  return {
    property,
    units,
    leases: leases.map((row) => ({...row, rent_cents: row.rent_cents === null ? null : toSafeCents(row.rent_cents)})),
    payments: payments.map((row) => ({...row, amount_cents: toSafeCents(row.amount_cents)})),
    expenses: expenses.map((row) => ({...row, amount_cents: toSafeCents(row.amount_cents)})),
    ytdNetCents: toSafeCents(net.received) - toSafeCents(net.spent),
  };
}

export type PaymentOption = {
  propertyId: string;
  address: string;
  tenantId: string | null;
  tenantName: string;
  expectedCents: number;
  openBalanceCents: number;
};

export async function getPaymentOptions(): Promise<PaymentOption[]> {
  const rows = await query<{ property_id:string; address:string; tenant_id:string|null; tenant_name:string|null; expected_cents:string|null; open_balance_cents:string }>(`SELECT p.id AS property_id,p.address_line1 AS address,t.id AS tenant_id,t.full_name AS tenant_name,
      (SELECT rt.rent_cents::text FROM lease_rent_terms rt WHERE rt.lease_id=l.id AND rt.deleted_at IS NULL ORDER BY rt.effective_from DESC LIMIT 1) AS expected_cents,
      COALESCE((SELECT SUM(c.amount_cents + COALESCE((SELECT SUM(r.amount_cents) FROM charges r WHERE r.reverses_charge_id=c.id),0)
        - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0))
        FROM charges c WHERE c.property_id=p.id AND c.tenant_id=t.id AND c.reverses_charge_id IS NULL),0)::text AS open_balance_cents
    FROM properties p
    JOIN units u ON u.property_id=p.id AND u.deleted_at IS NULL
    JOIN leases l ON l.unit_id=u.id AND l.status='active' AND l.deleted_at IS NULL
    LEFT JOIN lease_tenants lt ON lt.lease_id=l.id AND lt.is_primary AND lt.deleted_at IS NULL
    LEFT JOIN tenants t ON t.id=lt.tenant_id
    WHERE p.deleted_at IS NULL
    ORDER BY (COALESCE((SELECT SUM(c.amount_cents - COALESCE((SELECT SUM(pa.amount_cents) FROM payment_allocations pa WHERE pa.charge_id=c.id),0)) FROM charges c WHERE c.property_id=p.id AND c.tenant_id=t.id AND c.reverses_charge_id IS NULL),0)>0) DESC,p.address_line1`, []);
  return rows.map((row) => ({
    propertyId: row.property_id,
    address: row.address,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name ?? "Unassigned tenant",
    expectedCents: row.expected_cents ? toSafeCents(row.expected_cents) : 0,
    openBalanceCents: toSafeCents(row.open_balance_cents),
  }));
}

export async function getLedger(filters: { propertyId?: string; tenantId?: string; from?: string; to?: string }) {
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (sql: string, value: unknown) => { values.push(value); where.push(sql.replace("?", `$${values.length}`)); };
  if (filters.propertyId) add("property_id = ?::uuid", filters.propertyId);
  if (filters.tenantId) add("tenant_id = ?::uuid", filters.tenantId);
  if (filters.from) add("entry_date >= ?::date", filters.from);
  if (filters.to) add("entry_date <= ?::date", filters.to);
  const condition = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<{ id:string; entry_type:string; entry_date:string; property_id:string; property_address:string; tenant_id:string|null; tenant_name:string|null; description:string; amount_cents:string; created_at:string }>(`WITH ledger AS (
    SELECT c.id,'charge'::text AS entry_type,c.effective_date AS entry_date,c.property_id,p.address_line1 AS property_address,c.tenant_id,t.full_name AS tenant_name,c.description,c.amount_cents,c.created_at
      FROM charges c JOIN properties p ON p.id=c.property_id LEFT JOIN tenants t ON t.id=c.tenant_id
    UNION ALL
    SELECT pay.id,'payment',pay.received_date,pay.property_id,p.address_line1,pay.tenant_id,t.full_name,('Payment — '||pay.method),(-pay.amount_cents),pay.created_at
      FROM payments pay JOIN properties p ON p.id=pay.property_id LEFT JOIN tenants t ON t.id=pay.tenant_id
    UNION ALL
    SELECT e.id,'expense',e.expense_date,e.property_id,p.address_line1,NULL::uuid,NULL::text,(e.category||' — '||e.description),e.amount_cents,e.created_at
      FROM expenses e JOIN properties p ON p.id=e.property_id
  ) SELECT id,entry_type,entry_date::text,property_id,property_address,tenant_id,tenant_name,description,amount_cents::text,created_at::text
    FROM ledger ${condition} ORDER BY entry_date DESC,created_at DESC LIMIT 2000`, values);
  return rows.map((row) => ({...row, amount_cents: toSafeCents(row.amount_cents)}));
}

export async function getFilterOptions() {
  const [properties, tenants] = await Promise.all([
    query<{id:string;label:string}>(`SELECT id,address_line1 AS label FROM properties WHERE deleted_at IS NULL ORDER BY address_line1`),
    query<{id:string;label:string}>(`SELECT id,full_name AS label FROM tenants WHERE deleted_at IS NULL ORDER BY full_name`),
  ]);
  return { properties, tenants };
}

export async function getImportBatches() {
  return query<{id:string;filename:string;status:string;imported_rows:number;created_at:string;reversed_at:string|null}>(`SELECT id,filename,status,imported_rows,created_at::text,reversed_at::text FROM import_batches ORDER BY created_at DESC LIMIT 50`);
}


export type ImportReviewItem = {
  id:string;
  import_batch_id:string;
  filename:string;
  issue_type:string;
  subject:string;
  detail:string;
  status:"open"|"resolved"|"dismissed";
  resolution_note:string|null;
  created_at:string;
  resolved_at:string|null;
};

export async function getImportReviewItems():Promise<ImportReviewItem[]> {
  return query<ImportReviewItem>(`SELECT iri.id,iri.import_batch_id,ib.filename,iri.issue_type,iri.subject,iri.detail,iri.status,iri.resolution_note,
    iri.created_at::text,iri.resolved_at::text
    FROM import_review_items iri JOIN import_batches ib ON ib.id=iri.import_batch_id
    ORDER BY (iri.status='open') DESC,iri.created_at,iri.subject`);
}
