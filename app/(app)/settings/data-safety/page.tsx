import Link from "next/link";
import { RestoreForm } from "@/components/restore-form";
import { query } from "@/lib/db";

export default async function DataSafetyPage(){
  const runs=await query<{id:string;status:string;checksum:string;created_at:string;error_message:string|null}>(`SELECT id,status,checksum,created_at::text,error_message FROM export_runs ORDER BY created_at DESC LIMIT 20`);
  return <><div className="page-head"><div><div className="eyebrow">Backup and recovery</div><h1>Data safety</h1><p>Human-readable CSV plus canonical JSON. Nightly files are versioned rather than overwritten.</p></div><Link className="button secondary" href="/settings">Back to settings</Link></div><div className="actions" style={{marginBottom:20}}><a className="button" href="/api/export/json">Download full JSON</a><a className="button secondary" href="/api/export/csv">Download full CSV ZIP</a></div><div className="grid cols-2"><section><h2>Restore</h2><RestoreForm/></section><section><h2>Scheduled export history</h2><div className="stack">{runs.length===0?<div className="card empty">No scheduled export has run yet.</div>:runs.map(run=><div className="card" key={run.id}><div className="list-card"><div><strong>{run.created_at}</strong><div className="muted">Checksum: {run.checksum.slice(0,16)}…</div></div><span className={`pill ${run.status==='failed'?'deleted':''}`}>{run.status}</span></div>{run.error_message&&<p className="danger-text">{run.error_message}</p>}</div>)}</div></section></div></>;
}
