import { isAuthenticated } from "@/lib/auth";
import { importCsvBatch } from "@/lib/import";

export const runtime="nodejs";

export async function POST(request:Request){
  if(!(await isAuthenticated())) return Response.json({error:"Unauthorized"},{status:401});
  try{
    const form=await request.formData(); const file=form.get("file");
    if(!(file instanceof File)) return Response.json({error:"Choose a CSV file"},{status:400});
    if(file.size>5_000_000) return Response.json({error:"CSV exceeds the 5 MB demo limit"},{status:413});
    if(!file.name.toLowerCase().endsWith('.csv')) return Response.json({error:"Only .csv files are accepted"},{status:400});
    const result=await importCsvBatch(file.name,await file.text());
    return Response.json(result,{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Import failed"},{status:400});}
}
