import { buildExportPackage } from "@/lib/export";

export const runtime="nodejs";
export async function GET(){
  const exported=await buildExportPackage();
  const stamp=exported.createdAt.replaceAll(':','-');
  return new Response(JSON.stringify(exported,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="rental-tracker-${stamp}.json"`,"cache-control":"no-store"}});
}
