import { ImportForm } from "@/components/import-form";
import { Flash, flashFrom } from "@/components/flash";
import { reverseImportBatchAction, updateImportReviewItemAction } from "@/lib/actions";
import { getImportBatches, getImportReviewItems, getSettings } from "@/lib/data";

function issueLabel(value:string):string {
  return ({rent_mismatch:"Rent mismatch",occupancy:"Occupancy",identity:"Identity",invalid_date:"Invalid date",balance_gap:"Balance gap"} as Record<string,string>)[value]??"Other";
}

export default async function ImportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [batches,reviewItems,settings,flash]=await Promise.all([getImportBatches(),getImportReviewItems(),getSettings(),flashFrom(searchParams)]);
  const openItems=reviewItems.filter(item=>item.status==='open');
  const closedItems=reviewItems.filter(item=>item.status!=='open');
  return <><div className="page-head"><div><div className="eyebrow">Isolated history intake</div><h1>Import</h1><p>{settings?.historical_import_months?`Setup expects roughly ${settings.historical_import_months} months of history.`:'Historical import was marked as optional.'} A failed batch rolls back completely.</p></div><a className="button secondary" href="/import-template.csv">Download template</a></div><Flash {...flash}/>
    <div className="data-note" style={{marginBottom:18}}><strong>Import does not reproduce a spreadsheet grid.</strong> Each row becomes a charge, payment, or expense in the domain ledger. Ambiguous source facts are preserved for review instead of guessed.</div><ImportForm/>

    <section id="review-queue" className="review-section">
      <div className="page-head" style={{marginTop:28}}><div><div className="eyebrow">Source reconciliation</div><h2 style={{margin:0}}>Import review queue</h2><p>{openItems.length} open issue{openItems.length===1?'':'s'}. Resolving an issue changes only its review status; it never rewrites imported money records.</p></div></div>
      <div className="review-grid">{openItems.length===0?<div className="card empty">No open import-review items.</div>:openItems.map(item=><article className="card review-item" key={item.id}><div className="review-item-head"><span className={`issue-badge ${item.issue_type}`}>{issueLabel(item.issue_type)}</span><small>{item.filename}</small></div><h3>{item.subject}</h3><p>{item.detail}</p><details><summary>Resolve this item</summary><form className="form review-resolution" action={updateImportReviewItemAction}><input type="hidden" name="reviewItemId" value={item.id}/><div className="field"><label htmlFor={`resolution-${item.id}`}>Resolution note</label><input id={`resolution-${item.id}`} name="resolutionNote" placeholder="What did you confirm?" maxLength={500}/></div><div className="actions"><button className="button" name="status" value="resolved" type="submit">Mark resolved</button><button className="button secondary" name="status" value="dismissed" type="submit">Dismiss</button></div></form></details></article>)}</div>
      {closedItems.length>0&&<details className="closed-review-items"><summary>{closedItems.length} resolved or dismissed item{closedItems.length===1?'':'s'}</summary><div className="stack">{closedItems.map(item=><div className="card list-card" key={item.id}><div><strong>{item.subject}</strong><div className="muted">{issueLabel(item.issue_type)} · {item.resolution_note||'No resolution note'}</div></div><span className="pill">{item.status}</span></div>)}</div></details>}
    </section>

    <div className="page-head" style={{marginTop:28}}><div><h2 style={{margin:0}}>Import batches</h2><p>Undo appends reversals. Imported originals remain visible.</p></div></div>
    <div className="stack">{batches.length===0?<div className="card empty">No import batches.</div>:batches.map(batch=><section className="card list-card" key={batch.id}><div><strong>{batch.filename}</strong><div className="muted">{batch.imported_rows} rows · {batch.created_at}</div><span className={`pill ${batch.status==='reversed'?'deleted':''}`}>{batch.status}</span></div>{batch.status==='committed'&&<details className="destructive"><summary>Undo this batch</summary><form action={reverseImportBatchAction} className="form" style={{minWidth:300}}><input type="hidden" name="batchId" value={batch.id}/><input type="hidden" name="filename" value={batch.filename}/><div className="field"><label>Reason</label><input name="reason" required minLength={5}/></div><div className="field"><label>Type “{batch.filename}”</label><input name="confirmation" required/></div><button className="button danger" type="submit">Reverse every entry from {batch.filename}</button></form></details>}</section>)}</div>
  </>;
}
