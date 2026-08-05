import { get } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";
import { maybeOne } from "@/lib/db";

export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAuthenticated())) return new Response("Unauthorized",{status:401});
  const {id}=await params;
  const expense=await maybeOne<{receipt_blob_url:string|null}>(`SELECT receipt_blob_url FROM expenses WHERE id=$1`,[id]);
  if(!expense?.receipt_blob_url) return new Response("Receipt not found",{status:404});
  const result=await get(expense.receipt_blob_url,{access:"private"});
  if(!result||result.statusCode!==200||!result.stream) return new Response("Receipt file not found",{status:404});
  return new Response(result.stream,{headers:{"content-type":result.blob.contentType??"application/octet-stream","cache-control":"private, no-store","content-disposition":`inline; filename="receipt-${id}"`}});
}
