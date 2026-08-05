import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { buildCsvZip, buildExportPackage } from "@/lib/export";
import { query } from "@/lib/db";

export const runtime="nodejs";
export const maxDuration=300;

export async function GET(request:Request){
  if(request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized",{status:401});
  const id=randomUUID();
  try{
    const exported=await buildExportPackage(); const stamp=exported.createdAt.replaceAll(':','-');
    const json=await put(`rental-tracker/nightly/${stamp}.json`,JSON.stringify(exported,null,2),{access:"private",contentType:"application/json",addRandomSuffix:false});
    const csv=await put(`rental-tracker/nightly/${stamp}.zip`,Buffer.from(buildCsvZip(exported.tables)),{access:"private",contentType:"application/zip",addRandomSuffix:false});
    await query(`INSERT INTO export_runs(id,export_version,trigger_type,json_blob_url,csv_blob_url,checksum,status) VALUES($1,1,'scheduled',$2,$3,$4,'complete')`,[id,json.url,csv.url,exported.checksum]);
    return Response.json({ok:true,id,checksum:exported.checksum});
  }catch(error){
    await query(`INSERT INTO export_runs(id,export_version,trigger_type,checksum,status,error_message) VALUES($1,1,'scheduled','unavailable','failed',$2)`,[id,error instanceof Error?error.message:"Unknown export failure"]).catch(()=>undefined);
    return Response.json({ok:false,error:error instanceof Error?error.message:"Export failed"},{status:500});
  }
}
