import Link from "next/link";
import { getProperties, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { setPropertyDeletedAction } from "@/lib/actions";
import { Flash, flashFrom } from "@/components/flash";

export default async function PropertiesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams; const showDeleted=params.deleted==='1';
  const [properties,settings,flash]=await Promise.all([getProperties(showDeleted),getSettings(),flashFrom(Promise.resolve(params))]);
  const activeCount=properties.filter(property=>!property.deleted_at).length;
  return <>
    <div className="page-head"><div><div className="eyebrow">Portfolio</div><h1>Properties</h1><p>{activeCount} of {settings?.property_count_target??activeCount} setup-target properties entered. The target is guidance, not a limit.</p></div><div className="actions"><Link className="button secondary" href={showDeleted?"/properties":"/properties?deleted=1"}>{showDeleted?"Hide Deleted":"Show Deleted"}</Link><Link className="button" href="/properties/new">Add property</Link></div></div>
    <Flash {...flash}/>
    <div className="stack">{properties.length===0?<div className="card empty">No properties yet. Add the first one to begin.</div>:properties.map((property)=><section className="card list-card" key={property.id}>
      <div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:20}}>{property.address_line1}</h2>{property.deleted_at&&<span className="pill deleted">Deleted</span>}</div><div className="muted">{property.city}, {property.region} {property.postal_code} · {property.unit_count} unit{property.unit_count===1?'':'s'}</div><div className={`amount ${property.balance_cents>0?'danger-text':'success'}`}>{formatMoney(property.balance_cents)} open balance</div></div>
      <div className="actions"><Link className="button secondary" href={`/properties/${property.id}`}>Open</Link>{property.deleted_at?<form action={setPropertyDeletedAction}><input type="hidden" name="propertyId" value={property.id}/><input type="hidden" name="address" value={property.address_line1}/><input type="hidden" name="mode" value="restore"/><button className="button" type="submit">Restore {property.address_line1}</button></form>:<details className="destructive"><summary>Move to Deleted</summary><form className="form" action={setPropertyDeletedAction} style={{minWidth:280}}><input type="hidden" name="propertyId" value={property.id}/><input type="hidden" name="address" value={property.address_line1}/><input type="hidden" name="mode" value="archive"/><div className="field"><label htmlFor={`confirm-${property.id}`}>Type “{property.address_line1}”</label><input id={`confirm-${property.id}`} name="confirmation" required/></div><button className="button danger" type="submit">Archive {property.address_line1}</button></form></details>}</div>
    </section>)}</div>
  </>;
}
