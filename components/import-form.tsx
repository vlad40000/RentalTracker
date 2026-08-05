"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportForm(){
  const router=useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setMessage(null);
    const data=new FormData(event.currentTarget);
    const response=await fetch('/api/import',{method:'POST',body:data});
    const result=await response.json().catch(()=>({error:'Import failed'})) as {error?:string;rows?:number};
    setBusy(false);
    if(!response.ok){setMessage(result.error??'Import failed');return;}
    router.push(`/import?success=${encodeURIComponent(`${result.rows} rows imported as one reversible batch`)}`); router.refresh();
  }
  return <form className="card form" onSubmit={submit}><div className="field"><label htmlFor="csv">CSV file</label><input id="csv" name="file" type="file" accept=".csv,text/csv" required/><small>Required headers: type, property_address, date, amount. Optional fields depend on the row type.</small></div>{message&&<div className="flash error">{message}</div>}<button className="button" disabled={busy} type="submit">{busy?'Importing…':'Preview validation and import'}</button></form>;
}
