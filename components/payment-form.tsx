"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { recordPaymentAction } from "@/lib/actions";
import type { PaymentOption } from "@/lib/data";
import { formatMoney } from "@/lib/money";

function centsInput(cents:number){return (cents/100).toFixed(2)}

export function PaymentForm({options,initialPropertyId,today}:{options:PaymentOption[];initialPropertyId?:string;today:string}){
  const defaultIndex=Math.max(0,options.findIndex(option=>option.propertyId===initialPropertyId));
  const [index,setIndex]=useState(defaultIndex);
  const selected=options[index];
  const suggested=useMemo(()=>selected?(selected.openBalanceCents>0?selected.openBalanceCents:selected.expectedCents):0,[selected]);
  const [amount,setAmount]=useState(()=>centsInput(suggested));
  if(!selected) return <div className="card empty">Add a property, tenant, active lease, and rent term before recording a payment.</div>;
  return <form className="payment-workflow" action={recordPaymentAction}>
    <section className="card form payment-form-card">
      <div className="payment-steps"><span className="active">1 · Tenant</span><span>2 · Payment</span><span>3 · Post</span></div>
      <div className="field"><label htmlFor="paymentTarget">Tenant and lease</label><select id="paymentTarget" value={index} onChange={(event:ChangeEvent<HTMLSelectElement>)=>{const next=Number(event.target.value);setIndex(next);const option=options[next];setAmount(centsInput(option.openBalanceCents>0?option.openBalanceCents:option.expectedCents));}}>{options.map((option,i)=><option value={i} key={`${option.propertyId}:${option.tenantId}`}>{option.tenantName} — {option.address}</option>)}</select></div>
      <input type="hidden" name="propertyId" value={selected.propertyId}/><input type="hidden" name="tenantId" value={selected.tenantId??""}/>
      <div className="selected-tenant-summary"><div><span>Open balance</span><strong className={selected.openBalanceCents>0?"danger-text":"success"}>{formatMoney(selected.openBalanceCents)}</strong></div><div><span>Expected monthly rent</span><strong>{formatMoney(selected.expectedCents)}</strong></div></div>
      <div className="field"><label htmlFor="payerName">Payer</label><input id="payerName" name="payerName" defaultValue={selected.tenantName} required/></div>
      <div className="form-row"><div className="field"><label htmlFor="amount">Amount received</label><div className="money-input"><span>$</span><input id="amount" name="amount" inputMode="decimal" value={amount} onChange={(event:ChangeEvent<HTMLInputElement>)=>setAmount(event.target.value)} required/></div><small>{selected.openBalanceCents>0?"Pre-filled to the selected tenant’s current open balance.":"No open balance; expected rent is shown as the starting amount."}</small></div><div className="field"><label htmlFor="receivedDate">Date received</label><input id="receivedDate" name="receivedDate" type="date" defaultValue={today} required/></div></div>
      <div className="form-row"><div className="field"><label htmlFor="method">Method</label><select id="method" name="method" defaultValue="ach"><option value="ach">ACH / bank transfer</option><option value="zelle">Zelle</option><option value="venmo">Venmo</option><option value="cash">Cash</option><option value="check">Check</option><option value="card">Card</option><option value="money_order">Money order</option><option value="other">Other</option></select></div><div className="field"><label htmlFor="reference">Reference</label><input id="reference" name="reference" placeholder="Check number or transfer ID"/></div></div>
      <div className="field"><label htmlFor="notes">Notes <span className="muted">(optional)</span></label><textarea id="notes" name="notes" placeholder="Memo or context for this payment"/></div>
    </section>
    <aside className="card posting-summary">
      <div className="eyebrow">Posting summary</div><h2>{formatMoney(Math.round(Number(amount||0)*100))}</h2><p>{selected.tenantName}<br/><span>{selected.address}</span></p>
      <div className="allocation-note"><strong>Automatic allocation</strong><p>The payment applies only to this tenant’s oldest open charges first. It may cover a charge partially or span several charges.</p></div>
      <div className="data-note"><strong>Permanent entry:</strong> once posted, this payment cannot be edited or deleted. Corrections create a linked reversal.</div>
      <button className="button full" type="submit">Post payment →</button>
    </aside>
  </form>;
}
