export function Flash({success,error}:{success?:string;error?:string}){
  if(success) return <div className="flash success" role="status">{success}</div>;
  if(error) return <div className="flash error" role="alert">{error}</div>;
  return null;
}

export async function flashFrom(searchParams:Promise<Record<string,string|string[]|undefined>>){
  const params=await searchParams;
  const pick=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
  return {success:pick(params.success),error:pick(params.error)};
}
