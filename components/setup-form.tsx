"use client";

import { useState } from "react";
import { saveSetupAction } from "@/lib/actions";
import type { Settings } from "@/lib/data";

const unitChoices=[
  {value:"single-family" as const,title:"Single-family",blurb:"One house per address. Unit language stays out of the way."},
  {value:"multi-unit" as const,title:"Multi-unit",blurb:"Every property opens with an explicit unit roster."},
  {value:"mixed" as const,title:"Mixed",blurb:"Single-family and multi-unit properties can coexist."},
];

export function SetupForm({settings}:{settings:Settings|null}){
  const [count,setCount]=useState(settings?.property_count_target??3);
  const [unitType,setUnitType]=useState<Settings["portfolio_unit_type"]>(settings?.portfolio_unit_type??"mixed");
  const [phone,setPhone]=useState(settings?.phone_access_required??true);
  const [months,setMonths]=useState(settings?.historical_import_months??18);
  const dense=count>=5;
  return <form className="setup-layout" action={saveSetupAction}>
    <div className="setup-questions card"><input type="hidden" name="returnTo" value={settings?"/settings":"/properties"}/>
      <section className="setup-question">
        <div className="question-number">01</div><div className="field"><label htmlFor="propertyCountTarget">Number of properties</label><input id="propertyCountTarget" name="propertyCountTarget" type="number" min="1" max="1000" value={count} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setCount(Number(event.target.value))} required/><small>A starting estimate. The real property count takes over once properties are entered.</small></div>
      </section>
      <section className="setup-question">
        <div className="question-number">02</div><fieldset className="field setup-fieldset"><legend>Unit type</legend><div className="setup-choice-grid">{unitChoices.map(choice=><label className="setup-choice" key={choice.value}><input type="radio" name="portfolioUnitType" value={choice.value} checked={unitType===choice.value} onChange={()=>setUnitType(choice.value)}/><span><strong>{choice.title}</strong><small>{choice.blurb}</small></span></label>)}</div></fieldset>
      </section>
      <section className="setup-question">
        <div className="question-number">03</div><fieldset className="field setup-fieldset"><legend>Access from your phone while out?</legend><div className="binary-choice"><label className="setup-choice"><input type="radio" name="phoneAccessRequired" value="yes" checked={phone} onChange={()=>setPhone(true)}/><span><strong>Yes</strong><small>Prioritize fast mobile payment entry and larger touch controls.</small></span></label><label className="setup-choice"><input type="radio" name="phoneAccessRequired" value="no" checked={!phone} onChange={()=>setPhone(false)}/><span><strong>No</strong><small>Use denser desktop tables while remaining responsive.</small></span></label></div></fieldset>
      </section>
      <section className="setup-question">
        <div className="question-number">04</div><div className="field"><label htmlFor="historicalImportMonths">Months of past history</label><input id="historicalImportMonths" name="historicalImportMonths" type="number" min="0" max="1200" value={months} onChange={(event:React.ChangeEvent<HTMLInputElement>)=>setMonths(Number(event.target.value))} required/><small>Enter 0 to remove Import from primary navigation. Import remains available under Data Tools.</small></div>
      </section>
      <div className="data-note"><strong>No answer can remove existing records.</strong> Settings affect layout, shortcuts, and onboarding only.</div>
      <button className="button setup-submit" type="submit">Save portfolio setup</button>
    </div>
    <aside className="setup-impact card" aria-live="polite">
      <div className="eyebrow">What this changes</div><h2>Your workspace will adapt.</h2>
      <div className="impact-list">
        <div><span>Portfolio view</span><strong>{dense?"Dense table + search":"Scannable property cards"}</strong></div>
        <div><span>Property structure</span><strong>{unitType==="single-family"?"Unit language minimized":unitType==="multi-unit"?"Unit rosters always visible":"Units shown where needed"}</strong></div>
        <div><span>Most-used action</span><strong>{phone?"Payment entry stays one tap away":"Desktop workspace uses tighter spacing"}</strong></div>
        <div><span>Import guidance</span><strong>{months>0?`${months} months targeted`:"Start fresh; Import moves to Data Tools"}</strong></div>
      </div>
      <p className="muted">These are presentation preferences, not permanent limits. You can change them later without converting or deleting data.</p>
    </aside>
  </form>;
}
