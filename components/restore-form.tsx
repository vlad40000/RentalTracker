"use client";

import { useState, type ChangeEvent } from "react";

export function RestoreForm(){
  const [file,setFile]=useState<File|null>(null); const [confirmation,setConfirmation]=useState(""); const [message,setMessage]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  async function restore(){
    if(!file){setMessage("Choose a JSON export file");return;} setBusy(true); setMessage(null);
    try{
      const exported=JSON.parse(await file.text()) as unknown;
      const response=await fetch('/api/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation,export:exported})});
      const result=await response.json() as {error?:string;rows?:number;tables?:number};
      if(!response.ok) throw new Error(result.error??'Restore failed');
      setMessage(`Restore complete: ${result.rows} rows across ${result.tables} tables.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Restore failed');}finally{setBusy(false);}
  }
  return <div className="card form"><div className="data-note"><strong>Recovery-only operation.</strong> Restore is intentionally rejected unless every application table is empty. Create a fresh Neon branch/database, migrate it, then restore there.</div><div className="field"><label htmlFor="restoreFile">Canonical JSON export</label><input id="restoreFile" type="file" accept="application/json,.json" onChange={(event:ChangeEvent<HTMLInputElement>)=>setFile(event.target.files?.[0]??null)}/></div><div className="field"><label htmlFor="restoreConfirm">Type “RESTORE INTO EMPTY DATABASE”</label><input id="restoreConfirm" value={confirmation} onChange={(event:ChangeEvent<HTMLInputElement>)=>setConfirmation(event.target.value)}/></div>{message&&<div className={message.startsWith('Restore complete')?'flash success':'flash error'}>{message}</div>}<button className="button danger" type="button" onClick={restore} disabled={busy}>{busy?'Validating and restoring…':'Restore into empty database'}</button></div>;
}
