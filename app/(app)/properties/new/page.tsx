import Link from "next/link";
import { createPropertyAction } from "@/lib/actions";
import { getSettings } from "@/lib/data";
import { Flash, flashFrom } from "@/components/flash";

export default async function NewPropertyPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [settings,flash]=await Promise.all([getSettings(),flashFrom(searchParams)]);
  const defaultMode=settings?.portfolio_unit_type==='multi-unit'?'multi-unit':'single-family';
  return <><div className="page-head"><div><div className="eyebrow">Portfolio setup</div><h1>Add property</h1><p>A single-family property still receives one explicit Unit record.</p></div><Link className="button secondary" href="/properties">Cancel</Link></div><Flash {...flash}/>
    <form className="card form" action={createPropertyAction}>
      <div className="form-row"><div className="field"><label htmlFor="addressLine1">Street address</label><input id="addressLine1" name="addressLine1" required/></div><div className="field"><label htmlFor="addressLine2">Address line 2</label><input id="addressLine2" name="addressLine2"/></div></div>
      <div className="form-row"><div className="field"><label htmlFor="city">City</label><input id="city" name="city" required/></div><div className="field"><label htmlFor="region">State/region</label><input id="region" name="region" required defaultValue="FL"/></div></div>
      <div className="form-row"><div className="field"><label htmlFor="postalCode">Postal code</label><input id="postalCode" name="postalCode" required/></div><div className="field"><label htmlFor="purchaseDate">Purchase date</label><input id="purchaseDate" name="purchaseDate" type="date"/></div></div>
      <div className="field"><label htmlFor="purchasePrice">Purchase price</label><input id="purchasePrice" name="purchasePrice" inputMode="decimal" placeholder="245000.00"/></div>
      <fieldset className="field" style={{border:0,padding:0,margin:0}}><legend style={{fontWeight:750,marginBottom:7}}>Property unit mode</legend><div className="choice-grid" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}><label className="choice"><input type="radio" name="unitMode" value="single-family" defaultChecked={defaultMode==='single-family'}/><span>Single-family</span></label><label className="choice"><input type="radio" name="unitMode" value="multi-unit" defaultChecked={defaultMode==='multi-unit'}/><span>Multi-unit</span></label></div></fieldset>
      <div className="field"><label htmlFor="unitCount">Number of units</label><input id="unitCount" name="unitCount" type="number" min="1" max="500" defaultValue="1" required/><small>Ignored for single-family; one “House” unit is created.</small></div>
      <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes"/></div>
      <button className="button" type="submit">Create property</button>
    </form></>;
}
