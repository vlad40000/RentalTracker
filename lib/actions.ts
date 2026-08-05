"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSessionCookie, demoCredentialsMatch, requireSession, setSessionCookie } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { requireDemoMode } from "@/lib/demo";
import { resetDemoPortfolio } from "@/lib/demo-seed";
import { monthStartIso } from "@/lib/dates";
import { dollarsToCents } from "@/lib/money";
import { generateMonthlyCharges, recordPaymentAndAllocate, reverseImportBatch } from "@/lib/services";
import { expenseSchema, oneOffChargeSchema, paymentSchema, propertySchema, setupSchema } from "@/lib/validation";

function str(form: FormData, key: string): string { return String(form.get(key) ?? ""); }
function go(path: string, kind: "success"|"error", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`);
}
function settingsMessage(returnTo:string):string { return returnTo==="/settings"?"Portfolio setup updated":"Setup saved. Add your properties next."; }

export async function loginAction(form: FormData): Promise<void> {
  const email = str(form,"email");
  const password = str(form,"password");
  if (!demoCredentialsMatch(email,password)) go("/login","error","Invalid demo credentials");
  await setSessionCookie();
  redirect("/dashboard");
}

export async function continueDemoAction(): Promise<void> {
  await setSessionCookie();
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function saveSetupAction(form: FormData): Promise<void> {
  await requireSession();
  const parsed = setupSchema.safeParse({
    propertyCountTarget:str(form,"propertyCountTarget"),
    portfolioUnitType:str(form,"portfolioUnitType"),
    phoneAccessRequired:str(form,"phoneAccessRequired"),
    historicalImportMonths:str(form,"historicalImportMonths"),
  });
  if (!parsed.success) go("/setup","error",parsed.error.issues[0]?.message ?? "Invalid setup values");
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO app_settings(id,owner_key,property_count_target,portfolio_unit_type,phone_access_required,historical_import_months,setup_completed_at,updated_at)
      VALUES($1,'demo-owner',$2,$3,$4,$5,now(),now())
      ON CONFLICT(owner_key) DO UPDATE SET property_count_target=EXCLUDED.property_count_target,
        portfolio_unit_type=EXCLUDED.portfolio_unit_type,phone_access_required=EXCLUDED.phone_access_required,
        historical_import_months=EXCLUDED.historical_import_months,updated_at=now()`,
      [randomUUID(),parsed.data.propertyCountTarget,parsed.data.portfolioUnitType,parsed.data.phoneAccessRequired,parsed.data.historicalImportMonths]);
    await client.query(`INSERT INTO audit_log(id,action,entity_type,detail_json) VALUES($1,'settings.saved','app_settings',$2::jsonb)`,[randomUUID(),JSON.stringify(parsed.data)]);
  });
  revalidatePath("/", "layout");
  const returnTo=str(form,"returnTo")==="/settings"?"/settings":"/properties";
  go(returnTo,"success",settingsMessage(returnTo));
}

export async function createPropertyAction(form: FormData): Promise<void> {
  await requireSession();
  const parsed = propertySchema.safeParse({
    addressLine1:str(form,"addressLine1"),addressLine2:str(form,"addressLine2"),city:str(form,"city"),region:str(form,"region"),postalCode:str(form,"postalCode"),
    purchaseDate:str(form,"purchaseDate"),purchasePrice:str(form,"purchasePrice"),notes:str(form,"notes"),unitMode:str(form,"unitMode"),unitCount:str(form,"unitCount"),
  });
  if (!parsed.success) go("/properties/new","error",parsed.error.issues[0]?.message ?? "Invalid property");
  let purchasePriceCents: number|null = null;
  try { purchasePriceCents = parsed.data.purchasePrice ? dollarsToCents(parsed.data.purchasePrice) : null; }
  catch (error) { go("/properties/new","error",error instanceof Error ? error.message : "Invalid purchase price"); }
  const propertyId = randomUUID();
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO properties(id,address_line1,address_line2,city,region,postal_code,purchase_date,purchase_price_cents,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[propertyId,parsed.data.addressLine1,parsed.data.addressLine2||null,parsed.data.city,parsed.data.region,parsed.data.postalCode,parsed.data.purchaseDate||null,purchasePriceCents,parsed.data.notes||null]);
    const count = parsed.data.unitMode === "single-family" ? 1 : parsed.data.unitCount;
    for (let index=1;index<=count;index++) {
      const name = parsed.data.unitMode === "single-family" ? "House" : `Unit ${index}`;
      await client.query(`INSERT INTO units(id,property_id,name) VALUES($1,$2,$3)`,[randomUUID(),propertyId,name]);
    }
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'property.created','property',$2,$3::jsonb)`,[randomUUID(),propertyId,JSON.stringify({unitCount:count})]);
  });
  revalidatePath("/properties"); revalidatePath("/dashboard");
  redirect(`/properties/${propertyId}?success=${encodeURIComponent("Property created")}`);
}

export async function setPropertyDeletedAction(form: FormData): Promise<void> {
  await requireSession();
  const propertyId = str(form,"propertyId");
  const address = str(form,"address");
  const mode = str(form,"mode");
  const confirmation = str(form,"confirmation");
  if (mode === "archive" && confirmation !== address) go("/properties?deleted=1","error",`Type the exact address: ${address}`);
  await withTransaction(async (client)=>{
    if (mode === "archive") {
      await client.query(`UPDATE properties SET deleted_at=now(),deleted_reason=$2 WHERE id=$1 AND deleted_at IS NULL`,[propertyId,"Archived by owner"]);
      await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'property.archived','property',$2,$3::jsonb)`,[randomUUID(),propertyId,JSON.stringify({address})]);
    } else {
      await client.query(`UPDATE properties SET deleted_at=NULL,deleted_reason=NULL WHERE id=$1 AND deleted_at IS NOT NULL`,[propertyId]);
      await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'property.restored','property',$2,$3::jsonb)`,[randomUUID(),propertyId,JSON.stringify({address})]);
    }
  });
  revalidatePath("/properties"); revalidatePath("/dashboard");
  go("/properties?deleted=1","success",mode === "archive" ? `${address} moved to Deleted` : `${address} restored`);
}

export async function generateChargesAction(form: FormData): Promise<void> {
  await requireSession();
  const periodStart = str(form,"periodStart") || monthStartIso();
  const inserted = await withTransaction((client)=>generateMonthlyCharges(client,periodStart));
  revalidatePath("/dashboard"); revalidatePath("/ledger");
  go("/dashboard","success",inserted === 0 ? "No new rent charges were needed" : `${inserted} rent charge${inserted===1?"":"s"} generated`);
}

export async function recordPaymentAction(form: FormData): Promise<void> {
  await requireSession();
  const parsed = paymentSchema.safeParse({propertyId:str(form,"propertyId"),tenantId:str(form,"tenantId"),payerName:str(form,"payerName"),amount:str(form,"amount"),receivedDate:str(form,"receivedDate"),method:str(form,"method"),reference:str(form,"reference"),notes:str(form,"notes")});
  if (!parsed.success) go("/payments/new","error",parsed.error.issues[0]?.message ?? "Invalid payment");
  let amountCents=0; try { amountCents=dollarsToCents(parsed.data.amount); } catch(error){ go("/payments/new","error",error instanceof Error?error.message:"Invalid amount"); }
  if (amountCents<=0) go("/payments/new","error","Payment must be greater than zero");
  const result = await withTransaction(async(client)=>{
    const posted = await recordPaymentAndAllocate(client,{propertyId:parsed.data.propertyId,tenantId:parsed.data.tenantId||null,payerName:parsed.data.payerName,amountCents,receivedDate:parsed.data.receivedDate,method:parsed.data.method,reference:parsed.data.reference,notes:parsed.data.notes});
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'payment.posted','payment',$2,$3::jsonb)`,[randomUUID(),posted.paymentId,JSON.stringify({amountCents,allocatedCents:posted.allocatedCents,unappliedCents:posted.unappliedCents})]);
    return posted;
  });
  revalidatePath("/dashboard"); revalidatePath("/ledger"); revalidatePath("/properties");
  go("/dashboard","success",result.unappliedCents ? `Payment recorded; ${result.unappliedCents/100} remains unapplied` : "Payment recorded and allocated");
}

export async function recordExpenseAction(form: FormData): Promise<void> {
  await requireSession();
  const parsed=expenseSchema.safeParse({propertyId:str(form,"propertyId"),unitId:str(form,"unitId"),category:str(form,"category"),description:str(form,"description"),amount:str(form,"amount"),expenseDate:str(form,"expenseDate"),vendor:str(form,"vendor")});
  if(!parsed.success) go(`/properties/${str(form,"propertyId")}`,"error",parsed.error.issues[0]?.message??"Invalid expense");
  let amountCents=0; try{amountCents=dollarsToCents(parsed.data.amount);}catch(error){go(`/properties/${parsed.data.propertyId}`,"error",error instanceof Error?error.message:"Invalid amount");}
  if(amountCents<=0) go(`/properties/${parsed.data.propertyId}`,"error","Expense must be greater than zero");
  const receipt=form.get("receipt"); let receiptUrl:string|null=null;
  if(receipt instanceof File&&receipt.size>0){
    if(receipt.size>4_000_000) go(`/properties/${parsed.data.propertyId}`,"error","Receipt exceeds the 4 MB server-upload limit");
    if(!process.env.BLOB_READ_WRITE_TOKEN) go(`/properties/${parsed.data.propertyId}`,"error","Vercel Blob is not configured for receipt uploads");
    const uploaded=await put(`rental-tracker/receipts/${randomUUID()}-${receipt.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`,receipt,{access:"private",addRandomSuffix:false}); receiptUrl=uploaded.url;
  }
  try{
    await withTransaction(async(client)=>{
      const active=await client.query(`SELECT 1 FROM properties WHERE id=$1 AND deleted_at IS NULL`,[parsed.data.propertyId]);
      if(active.rows.length!==1) throw new Error("Expenses can only be posted to an active property");
      if(parsed.data.unitId){const unit=await client.query(`SELECT 1 FROM units WHERE id=$1 AND property_id=$2 AND deleted_at IS NULL`,[parsed.data.unitId,parsed.data.propertyId]);if(unit.rows.length!==1) throw new Error("Selected unit does not belong to this active property");}
      const id=randomUUID();
      await client.query(`INSERT INTO expenses(id,property_id,unit_id,category,description,amount_cents,expense_date,vendor,receipt_blob_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,parsed.data.propertyId,parsed.data.unitId||null,parsed.data.category,parsed.data.description,amountCents,parsed.data.expenseDate,parsed.data.vendor||null,receiptUrl]);
      await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'expense.posted','expense',$2,$3::jsonb)`,[randomUUID(),id,JSON.stringify({amountCents,hasReceipt:Boolean(receiptUrl)})]);
    });
  }catch(error){if(receiptUrl) await del(receiptUrl).catch(()=>undefined);throw error;}
  revalidatePath(`/properties/${parsed.data.propertyId}`); revalidatePath("/ledger");
  go(`/properties/${parsed.data.propertyId}`,"success","Expense recorded");
}

export async function createOneOffChargeAction(form: FormData): Promise<void> {
  await requireSession();
  const parsed=oneOffChargeSchema.safeParse({propertyId:str(form,"propertyId"),unitId:str(form,"unitId"),tenantId:str(form,"tenantId"),chargeType:str(form,"chargeType"),description:str(form,"description"),amount:str(form,"amount"),effectiveDate:str(form,"effectiveDate"),dueDate:str(form,"dueDate")});
  if(!parsed.success) go(`/properties/${str(form,"propertyId")}`,"error",parsed.error.issues[0]?.message??"Invalid charge");
  let amountCents=0; try{amountCents=dollarsToCents(parsed.data.amount);}catch(error){go(`/properties/${parsed.data.propertyId}`,"error",error instanceof Error?error.message:"Invalid amount");}
  if(amountCents<=0) go(`/properties/${parsed.data.propertyId}`,"error","Charge must be greater than zero");
  await withTransaction(async(client)=>{
    const active=await client.query(`SELECT 1 FROM properties WHERE id=$1 AND deleted_at IS NULL`,[parsed.data.propertyId]);
    if(active.rows.length!==1) throw new Error("Charges can only be posted to an active property");
    if(parsed.data.unitId){const unit=await client.query(`SELECT 1 FROM units WHERE id=$1 AND property_id=$2 AND deleted_at IS NULL`,[parsed.data.unitId,parsed.data.propertyId]);if(unit.rows.length!==1) throw new Error("Selected unit does not belong to this active property");}
    const id=randomUUID();
    await client.query(`INSERT INTO charges(id,property_id,unit_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,parsed.data.propertyId,parsed.data.unitId||null,parsed.data.tenantId||null,parsed.data.chargeType,parsed.data.description,amountCents,parsed.data.effectiveDate,parsed.data.dueDate]);
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'charge.posted','charge',$2,$3::jsonb)`,[randomUUID(),id,JSON.stringify({amountCents})]);
  });
  revalidatePath(`/properties/${parsed.data.propertyId}`); revalidatePath("/dashboard"); revalidatePath("/ledger");
  go(`/properties/${parsed.data.propertyId}`,"success","Charge recorded");
}

export async function reverseImportBatchAction(form: FormData): Promise<void> {
  await requireSession();
  const batchId=str(form,"batchId"); const filename=str(form,"filename"); const reason=str(form,"reason").trim(); const confirmation=str(form,"confirmation");
  if(confirmation!==filename) go("/import","error",`Type the exact filename: ${filename}`);
  if(reason.length<5) go("/import","error","A reversal reason of at least five characters is required");
  await withTransaction(async(client)=>{ await reverseImportBatch(client,batchId,reason); await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'import.reversed','import_batch',$2,$3::jsonb)`,[randomUUID(),batchId,JSON.stringify({filename,reason})]); });
  revalidatePath("/", "layout"); go("/import","success",`${filename} reversed as one batch; originals remain visible`);
}


const leaseSetupSchema=z.object({
  propertyId:z.string().uuid(),unitId:z.string().uuid(),tenantId:z.string().uuid().optional().or(z.literal("")),tenantName:z.string().trim().max(200).optional(),tenantEmail:z.string().trim().email().optional().or(z.literal("")),tenantPhone:z.string().trim().max(50).optional(),
  startDate:z.iso.date(),endDate:z.iso.date().optional().or(z.literal("")),dueDay:z.coerce.number().int().min(1).max(28),deposit:z.string().min(1),rent:z.string().min(1),notes:z.string().trim().max(2000).optional(),
});

export async function createLeaseAction(form:FormData):Promise<void>{
  await requireSession();
  const parsed=leaseSetupSchema.safeParse({propertyId:str(form,"propertyId"),unitId:str(form,"unitId"),tenantId:str(form,"tenantId"),tenantName:str(form,"tenantName"),tenantEmail:str(form,"tenantEmail"),tenantPhone:str(form,"tenantPhone"),startDate:str(form,"startDate"),endDate:str(form,"endDate"),dueDay:str(form,"dueDay"),deposit:str(form,"deposit"),rent:str(form,"rent"),notes:str(form,"notes")});
  if(!parsed.success) go(`/properties/${str(form,"propertyId")}/lease/new`,"error",parsed.error.issues[0]?.message??"Invalid lease");
  let depositCents=0,rentCents=0; try{depositCents=dollarsToCents(parsed.data.deposit);rentCents=dollarsToCents(parsed.data.rent);}catch(error){go(`/properties/${parsed.data.propertyId}/lease/new`,"error",error instanceof Error?error.message:"Invalid money amount");}
  if(depositCents<0||rentCents<=0) go(`/properties/${parsed.data.propertyId}/lease/new`,"error","Rent must be positive and deposit cannot be negative");
  if(parsed.data.endDate&&parsed.data.endDate<parsed.data.startDate) go(`/properties/${parsed.data.propertyId}/lease/new`,"error","Lease end date cannot precede start date");
  await withTransaction(async(client)=>{
    const property=await client.query(`SELECT 1 FROM units u JOIN properties p ON p.id=u.property_id WHERE p.id=$1 AND u.id=$2 AND p.deleted_at IS NULL AND u.deleted_at IS NULL FOR UPDATE`,[parsed.data.propertyId,parsed.data.unitId]);
    if(property.rows.length!==1) throw new Error("Selected unit does not belong to this active property");
    const active=await client.query(`SELECT 1 FROM leases WHERE unit_id=$1 AND status='active' AND deleted_at IS NULL LIMIT 1`,[parsed.data.unitId]);
    if(active.rows.length) throw new Error("This unit already has an active lease");
    let tenantId=parsed.data.tenantId||"";
    if(tenantId){const tenant=await client.query(`SELECT 1 FROM tenants WHERE id=$1 AND deleted_at IS NULL`,[tenantId]);if(tenant.rows.length!==1) throw new Error("Selected tenant is not active");}
    else {if(!parsed.data.tenantName?.trim()) throw new Error("Enter a tenant name or select an existing tenant");tenantId=randomUUID();await client.query(`INSERT INTO tenants(id,full_name,email,phone) VALUES($1,$2,$3,$4)`,[tenantId,parsed.data.tenantName,parsed.data.tenantEmail||null,parsed.data.tenantPhone||null]);}
    const leaseId=randomUUID();
    await client.query(`INSERT INTO leases(id,unit_id,start_date,end_date,due_day,deposit_contract_cents,status,notes) VALUES($1,$2,$3,$4,$5,$6,'active',$7)`,[leaseId,parsed.data.unitId,parsed.data.startDate,parsed.data.endDate||null,parsed.data.dueDay,depositCents,parsed.data.notes||null]);
    await client.query(`INSERT INTO lease_tenants(id,lease_id,tenant_id,is_primary) VALUES($1,$2,$3,true)`,[randomUUID(),leaseId,tenantId]);
    await client.query(`INSERT INTO lease_rent_terms(id,lease_id,effective_from,rent_cents,due_day,reason) VALUES($1,$2,$3,$4,$5,'Initial rent')`,[randomUUID(),leaseId,parsed.data.startDate,rentCents,parsed.data.dueDay]);
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'lease.created','lease',$2,$3::jsonb)`,[randomUUID(),leaseId,JSON.stringify({tenantId,rentCents,depositCents})]);
  });
  revalidatePath(`/properties/${parsed.data.propertyId}`); revalidatePath("/payments/new");
  go(`/properties/${parsed.data.propertyId}`,"success","Lease created and rent history initialized");
}

const rentChangeSchema=z.object({propertyId:z.string().uuid(),leaseId:z.string().uuid(),effectiveFrom:z.iso.date(),rent:z.string().min(1),reason:z.string().trim().min(3).max(500),dueDay:z.coerce.number().int().min(1).max(28)});
export async function addRentTermAction(form:FormData):Promise<void>{
  await requireSession(); const parsed=rentChangeSchema.safeParse({propertyId:str(form,"propertyId"),leaseId:str(form,"leaseId"),effectiveFrom:str(form,"effectiveFrom"),rent:str(form,"rent"),reason:str(form,"reason"),dueDay:str(form,"dueDay")});
  if(!parsed.success) go(`/properties/${str(form,"propertyId")}`,"error",parsed.error.issues[0]?.message??"Invalid rent change");
  let rentCents=0;try{rentCents=dollarsToCents(parsed.data.rent);}catch(error){go(`/properties/${parsed.data.propertyId}`,"error",error instanceof Error?error.message:"Invalid rent");} if(rentCents<=0) go(`/properties/${parsed.data.propertyId}`,"error","Rent must be positive");
  await withTransaction(async(client)=>{
    const previous=await client.query<{id:string;effective_from:string}>(`SELECT id,effective_from::text FROM lease_rent_terms WHERE lease_id=$1 AND deleted_at IS NULL ORDER BY effective_from DESC LIMIT 1 FOR UPDATE`,[parsed.data.leaseId]);
    if(previous.rows.length&&parsed.data.effectiveFrom<=previous.rows[0].effective_from) throw new Error("New rent must start after the current rent term");
    const id=randomUUID(); await client.query(`INSERT INTO lease_rent_terms(id,lease_id,effective_from,rent_cents,due_day,reason) VALUES($1,$2,$3,$4,$5,$6)`,[id,parsed.data.leaseId,parsed.data.effectiveFrom,rentCents,parsed.data.dueDay,parsed.data.reason]);
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'rent_term.created','lease_rent_term',$2,$3::jsonb)`,[randomUUID(),id,JSON.stringify({rentCents,effectiveFrom:parsed.data.effectiveFrom})]);
  });
  revalidatePath(`/properties/${parsed.data.propertyId}`); go(`/properties/${parsed.data.propertyId}`,"success","New dated rent term added; prior rent history preserved");
}

export async function reverseFinancialEntryAction(form:FormData):Promise<void>{
  await requireSession(); const entryType=str(form,"entryType"); const entryId=str(form,"entryId"); const expected=str(form,"expectedConfirmation"); const confirmation=str(form,"confirmation"); const reason=str(form,"reason").trim(); const reversalDate=str(form,"reversalDate");
  if(confirmation!==expected) go("/ledger","error",`Type the exact confirmation: ${expected}`); if(reason.length<5) go("/ledger","error","A reversal reason of at least five characters is required"); if(!z.iso.date().safeParse(reversalDate).success) go("/ledger","error","Choose a valid reversal date");
  await withTransaction(async(client)=>{
    if(entryType==='payment'){
      const original=await client.query<{id:string;property_id:string;tenant_id:string|null;payer_name:string;amount_cents:string;received_date:string;method:string;reference:string|null}>(`SELECT id,property_id,tenant_id,payer_name,amount_cents::text,received_date::text,method,reference FROM payments WHERE id=$1 AND reverses_payment_id IS NULL FOR UPDATE`,[entryId]);
      if(original.rows.length!==1) throw new Error("Original payment was not found or is itself a reversal");
      const already=await client.query(`SELECT 1 FROM payments WHERE reverses_payment_id=$1`,[entryId]); if(already.rows.length) throw new Error("This payment has already been reversed");
      const row=original.rows[0],reversalId=randomUUID();
      await client.query(`INSERT INTO payments(id,property_id,tenant_id,payer_name,amount_cents,received_date,method,reference,notes,reverses_payment_id,reversal_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[reversalId,row.property_id,row.tenant_id,row.payer_name,-Number(row.amount_cents),reversalDate,row.method,row.reference,`Reversal of payment ${row.id}`,row.id,reason]);
      const allocations=await client.query<{id:string;charge_id:string;amount_cents:string}>(`SELECT id,charge_id,amount_cents::text FROM payment_allocations WHERE payment_id=$1 AND reverses_allocation_id IS NULL`,[entryId]);
      for(const allocation of allocations.rows) await client.query(`INSERT INTO payment_allocations(id,payment_id,charge_id,amount_cents,reverses_allocation_id,reversal_reason) VALUES($1,$2,$3,$4,$5,$6)`,[randomUUID(),reversalId,allocation.charge_id,-Number(allocation.amount_cents),allocation.id,reason]);
    }else if(entryType==='charge'){
      const result=await client.query<{property_id:string;unit_id:string|null;lease_id:string|null;tenant_id:string|null;description:string;amount_cents:string;effective_date:string;due_date:string}>(`SELECT property_id,unit_id,lease_id,tenant_id,description,amount_cents::text,effective_date::text,due_date::text FROM charges WHERE id=$1 AND reverses_charge_id IS NULL FOR UPDATE`,[entryId]); if(result.rows.length!==1) throw new Error("Original charge was not found or is itself a reversal");
      const already=await client.query(`SELECT 1 FROM charges WHERE reverses_charge_id=$1`,[entryId]); if(already.rows.length) throw new Error("This charge has already been reversed"); const row=result.rows[0];
      await client.query(`INSERT INTO charges(id,property_id,unit_id,lease_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date,reverses_charge_id,reversal_reason) VALUES($1,$2,$3,$4,$5,'reversal',$6,$7,$8,$9,$10,$11)`,[randomUUID(),row.property_id,row.unit_id,row.lease_id,row.tenant_id,`Reversal — ${row.description}`,-Number(row.amount_cents),reversalDate,reversalDate,entryId,reason]);
    }else if(entryType==='expense'){
      const result=await client.query<{property_id:string;unit_id:string|null;category:string;description:string;amount_cents:string;expense_date:string;vendor:string|null}>(`SELECT property_id,unit_id,category,description,amount_cents::text,expense_date::text,vendor FROM expenses WHERE id=$1 AND reverses_expense_id IS NULL FOR UPDATE`,[entryId]); if(result.rows.length!==1) throw new Error("Original expense was not found or is itself a reversal");
      const already=await client.query(`SELECT 1 FROM expenses WHERE reverses_expense_id=$1`,[entryId]); if(already.rows.length) throw new Error("This expense has already been reversed"); const row=result.rows[0];
      await client.query(`INSERT INTO expenses(id,property_id,unit_id,category,description,amount_cents,expense_date,vendor,reverses_expense_id,reversal_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),row.property_id,row.unit_id,row.category,`Reversal — ${row.description}`,-Number(row.amount_cents),reversalDate,row.vendor,entryId,reason]);
    }else throw new Error("Unsupported financial entry type");
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'financial_entry.reversed',$2,$3,$4::jsonb)`,[randomUUID(),entryType,entryId,JSON.stringify({reason,reversalDate})]);
  });
  revalidatePath("/", "layout"); go("/ledger","success",`${entryType} reversed; the original remains in the ledger`);
}


export async function resetDemoDataAction(form:FormData):Promise<void>{
  await requireSession();
  requireDemoMode();
  const confirmation=str(form,"confirmation");
  if(confirmation!=="RESET SAMPLE PORTFOLIO") go("/settings","error","Type RESET SAMPLE PORTFOLIO exactly");
  await withTransaction(client=>resetDemoPortfolio(client,new Date()));
  revalidatePath("/","layout");
  go("/dashboard","success","Current portfolio demo restored to its original sales-demo state");
}

const importReviewStatusSchema=z.object({
  reviewItemId:z.string().uuid(),
  status:z.enum(["resolved","dismissed"]),
  resolutionNote:z.string().trim().max(500),
});

export async function updateImportReviewItemAction(form:FormData):Promise<void>{
  await requireSession();
  const parsed=importReviewStatusSchema.safeParse({reviewItemId:str(form,"reviewItemId"),status:str(form,"status"),resolutionNote:str(form,"resolutionNote")});
  if(!parsed.success) go("/import","error",parsed.error.issues[0]?.message??"Invalid review update");
  await withTransaction(async(client)=>{
    const result=await client.query(`UPDATE import_review_items SET status=$2,resolution_note=$3,resolved_at=now() WHERE id=$1 AND status='open'`,[
      parsed.data.reviewItemId,parsed.data.status,parsed.data.resolutionNote||null,
    ]);
    if(result.rowCount!==1) throw new Error("Import review item was not found or is already closed");
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'import_review.updated','import_review_item',$2,$3::jsonb)`,[
      randomUUID(),parsed.data.reviewItemId,JSON.stringify({status:parsed.data.status,resolutionNote:parsed.data.resolutionNote||null}),
    ]);
  });
  revalidatePath("/dashboard"); revalidatePath("/import");
  go("/import","success",`Import issue marked ${parsed.data.status}`);
}
