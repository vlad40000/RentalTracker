import { strToU8, zipSync } from "fflate";
import { checksumTables, createExportPackage, validateExportPackage, type ExportPackage } from "@/lib/domain/export-roundtrip";
import { getPool, withTransaction, type DbClient } from "@/lib/db";

export const EXPORT_TABLES = ["app_settings","properties","units","tenants","leases","lease_tenants","lease_rent_terms","import_batches","import_review_items","charges","payments","payment_allocations","expenses","export_runs","audit_log"] as const;
export type ExportTable = typeof EXPORT_TABLES[number];

function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key,item])=>[key,toJsonSafe(item)]));
  return value;
}

export async function readAllTables(client?: DbClient): Promise<Record<ExportTable, unknown[]>> {
  const runner: DbClient = client ?? getPool();
  const result = {} as Record<ExportTable, unknown[]>;
  for (const table of EXPORT_TABLES) {
    const rows = await runner.query(`SELECT * FROM ${table} ORDER BY id`);
    result[table] = toJsonSafe(rows.rows) as unknown[];
  }
  return result;
}

export async function buildExportPackage(): Promise<ExportPackage<Record<ExportTable, unknown[]>>> {
  const tables = await readAllTables();
  return createExportPackage(tables);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const string = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"','""')}"` : string;
}

function tableCsv(rows: unknown[]): string {
  if (!rows.length) return "";
  const objects = rows as Record<string,unknown>[];
  const headers = [...new Set(objects.flatMap(Object.keys))];
  return `${headers.map(csvEscape).join(",")}\n${objects.map((row)=>headers.map((header)=>csvEscape(row[header])).join(",")).join("\n")}\n`;
}

export function buildCsvZip(tables: Record<string,unknown[]>): Uint8Array {
  const files: Record<string,Uint8Array> = {};
  for (const [table,rows] of Object.entries(tables)) files[`${table}.csv`] = strToU8(tableCsv(rows));
  files["README.txt"] = strToU8("Rental Tracker full CSV export. Financial reversal entries are included as separate signed rows. Do not remove IDs if this data may be used for audit or recovery.\n");
  return zipSync(files,{level:6});
}

const restoreOrder: ExportTable[] = ["app_settings","properties","units","tenants","leases","lease_tenants","lease_rent_terms","import_batches","import_review_items","charges","payments","payment_allocations","expenses","export_runs","audit_log"];

function quoteIdentifier(identifier:string):string { if(!/^[a-z_]+$/.test(identifier)) throw new Error("Unsafe identifier"); return `"${identifier}"`; }

export async function restoreExportIntoEmptyDatabase(value: unknown): Promise<{tables:number;rows:number}> {
  validateExportPackage(value);
  const source=value as ExportPackage<Record<string,Record<string,unknown>[]>>;
  const legacyWithoutReviewItems=!Array.isArray(source.tables.import_review_items);
  const normalizedTables={...source.tables,import_review_items:source.tables.import_review_items??[]} as Record<ExportTable,Record<string,unknown>[]>;
  const exported={...source,tables:normalizedTables} as ExportPackage<Record<ExportTable,Record<string,unknown>[]>>;
  for(const table of EXPORT_TABLES){if(!Array.isArray(exported.tables[table])) throw new Error(`Export is missing required table: ${table}`);}
  return withTransaction(async(client)=>{
    for(const table of EXPORT_TABLES){ const count=await client.query<{count:number}>(`SELECT count(*)::int AS count FROM ${quoteIdentifier(table)}`); if(count.rows[0].count!==0) throw new Error(`Restore target is not empty: ${table} contains rows`); }
    let rowsInserted=0;
    for(const table of restoreOrder){
      let rows=[...exported.tables[table]];
      const reversalColumn=table==='charges'?'reverses_charge_id':table==='payments'?'reverses_payment_id':table==='payment_allocations'?'reverses_allocation_id':table==='expenses'?'reverses_expense_id':null;
      if(reversalColumn) rows=rows.sort((a,b)=>Number(Boolean(a[reversalColumn]))-Number(Boolean(b[reversalColumn])));
      for(const row of rows){
        const columns=Object.keys(row);
        if(columns.length===0) continue;
        const values=columns.map((column)=>row[column]);
        const placeholders=columns.map((_,index)=>`$${index+1}`).join(",");
        await client.query(`INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")}) VALUES (${placeholders})`,values);
        rowsInserted++;
      }
    }
    for(const table of EXPORT_TABLES){const count=await client.query<{count:number}>(`SELECT count(*)::int AS count FROM ${quoteIdentifier(table)}`);if(count.rows[0].count!==exported.tables[table].length) throw new Error(`Restore verification failed for ${table}`);}
    const restoredTables=await readAllTables(client);
    const checksumTarget=legacyWithoutReviewItems
      ? Object.fromEntries(Object.entries(restoredTables).filter(([table])=>table!=="import_review_items"))
      : restoredTables;
    if(checksumTables(checksumTarget)!==source.checksum) throw new Error("Restore checksum verification failed after insert");
    return {tables:restoreOrder.length,rows:rowsInserted};
  });
}
