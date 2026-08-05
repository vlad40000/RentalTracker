import { randomUUID } from "node:crypto";
import { withTransaction } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { recordPaymentAndAllocate } from "@/lib/services";

export type ImportRow = Record<string,string>;

export function parseCsv(text:string):ImportRow[]{
  const rows:string[][]=[]; let row:string[]=[]; let field=""; let quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){ if(char==='"'&&text[i+1]==='"'){field+='"';i++;} else if(char==='"'){quoted=false;} else field+=char; }
    else if(char==='"'){quoted=true;} else if(char===','){row.push(field);field="";} else if(char==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field="";} else field+=char;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(quoted) throw new Error("CSV has an unclosed quoted field");
  const [headers,...data]=rows.filter((item)=>item.some((field)=>field.trim()!==""));
  if(!headers) return [];
  const normalized=headers.map((header)=>header.trim().toLowerCase());
  return data.map((values)=>Object.fromEntries(normalized.map((header,index)=>[header,(values[index]??"").trim()])));
}

export async function importCsvBatch(filename:string,text:string):Promise<{batchId:string;rows:number}> {
  const rows=parseCsv(text);
  if(rows.length===0) throw new Error("CSV contains no data rows");
  const batchId=randomUUID();
  return withTransaction(async(client)=>{
    await client.query(`INSERT INTO import_batches(id,filename,status,imported_rows) VALUES($1,$2,'committed',$3)`,[batchId,filename,rows.length]);
    for(const [index,row] of rows.entries()){
      const type=row.type;
      const property=await client.query<{id:string}>(`SELECT id FROM properties WHERE lower(address_line1)=lower($1) AND deleted_at IS NULL LIMIT 1`,[row.property_address]);
      if(property.rows.length!==1) throw new Error(`Row ${index+2}: property_address does not match an active property`);
      const propertyId=property.rows[0].id;
      const tenant=row.tenant_name?await client.query<{id:string}>(`SELECT id FROM tenants WHERE lower(full_name)=lower($1) AND deleted_at IS NULL LIMIT 1`,[row.tenant_name]):{rows:[] as {id:string}[]};
      const tenantId=tenant.rows[0]?.id??null;
      const amountCents=dollarsToCents(row.amount);
      if(type==='payment'){
        if(amountCents<=0) throw new Error(`Row ${index+2}: payment amount must be positive`);
        await recordPaymentAndAllocate(client,{propertyId,tenantId,payerName:row.payer_name||row.tenant_name||"Imported payer",amountCents,receivedDate:row.date,method:row.method||"other",reference:row.reference||null,notes:`Imported from ${filename}`,importBatchId:batchId});
      } else if(type==='charge'){
        if(amountCents<=0) throw new Error(`Row ${index+2}: charge amount must be positive`);
        await client.query(`INSERT INTO charges(id,property_id,tenant_id,charge_type,description,amount_cents,effective_date,due_date,import_batch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),propertyId,tenantId,row.charge_type||"adjustment",row.description||"Imported charge",amountCents,row.date,row.due_date||row.date,batchId]);
      } else if(type==='expense'){
        if(amountCents<=0) throw new Error(`Row ${index+2}: expense amount must be positive`);
        await client.query(`INSERT INTO expenses(id,property_id,category,description,amount_cents,expense_date,vendor,import_batch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),propertyId,row.category||"Imported",row.description||"Imported expense",amountCents,row.date,row.vendor||null,batchId]);
      } else throw new Error(`Row ${index+2}: type must be payment, charge, or expense`);
    }
    await client.query(`INSERT INTO audit_log(id,action,entity_type,entity_id,detail_json) VALUES($1,'import.committed','import_batch',$2,$3::jsonb)`,[randomUUID(),batchId,JSON.stringify({filename,rows:rows.length})]);
    return {batchId,rows:rows.length};
  });
}
