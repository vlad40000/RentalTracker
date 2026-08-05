import { isAuthenticated } from "@/lib/auth";
import { buildCsvZip, readAllTables } from "@/lib/export";

export const runtime="nodejs";
export async function GET(){
  if(!(await isAuthenticated())) return new Response("Unauthorized",{status:401});
  const tables=await readAllTables(); const zip=buildCsvZip(tables); const stamp=new Date().toISOString().replaceAll(':','-');
  return new Response(zip,{headers:{"content-type":"application/zip","content-disposition":`attachment; filename="rental-tracker-csv-${stamp}.zip"`,"cache-control":"no-store"}});
}
