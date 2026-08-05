import { isAuthenticated } from "@/lib/auth";
import { restoreExportIntoEmptyDatabase } from "@/lib/export";

export const runtime="nodejs";
export async function POST(request:Request){
  if(!(await isAuthenticated())) return Response.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json() as {confirmation?:string;export?:unknown};
    if(body.confirmation!=="RESTORE INTO EMPTY DATABASE") return Response.json({error:"Typed confirmation does not match"},{status:400});
    const result=await restoreExportIntoEmptyDatabase(body.export);
    return Response.json(result,{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Restore failed"},{status:400});}
}
