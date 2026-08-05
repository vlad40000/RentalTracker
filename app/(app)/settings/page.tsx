import Link from "next/link";
import { getSettings } from "@/lib/data";
import { resetDemoDataAction } from "@/lib/actions";
import { demoShowsRealTenantNames, isDemoMode } from "@/lib/demo";
import { Flash, flashFrom } from "@/components/flash";

export default async function SettingsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [settings,flash]=await Promise.all([getSettings(),flashFrom(searchParams)]);
  const demoMode=isDemoMode();
  const realNamesVisible=demoShowsRealTenantNames();
  return <><div className="page-head"><div><div className="eyebrow">Owner configuration</div><h1>Settings</h1><p>Preferences alter the presentation. Existing rental and financial history stays untouched.</p></div><Link className="button" href="/setup">Edit portfolio setup</Link></div><Flash {...flash}/>
    <div className="grid cols-2 settings-grid"><section className="card"><h2 style={{marginTop:0}}>Portfolio setup</h2><dl className="settings-list"><div><dt>Target properties</dt><dd>{settings?.property_count_target}</dd></div><div><dt>Unit type</dt><dd>{settings?.portfolio_unit_type}</dd></div><div><dt>Phone access</dt><dd>{settings?.phone_access_required?'Mobile-priority':'Desktop-priority'}</dd></div><div><dt>History target</dt><dd>{settings?.historical_import_months} months</dd></div></dl><Link className="button secondary" href="/setup">Change answers</Link></section>
      <section className="card"><h2 style={{marginTop:0}}>Data tools</h2><p>Import history, download complete exports, review scheduled backups, and access controlled restore.</p><div className="actions"><Link className="button secondary" href="/import">Import history</Link><Link className="button" href="/settings/data-safety">Open data safety</Link></div></section>
    </div>
    {demoMode&&<><section className="card demo-dataset-card"><div><div className="eyebrow">Demo dataset</div><h2>Current 17-property portfolio patterns</h2><p>Three months of rent, utilities, payments, credits, imported inconsistencies, a linked payment reversal, expenses, and backup history.</p></div><div className={`privacy-state ${realNamesVisible?'visible':'masked'}`}><strong>{realNamesVisible?'Real tenant names visible':'Tenant names masked'}</strong><small>Controlled by DEMO_SHOW_REAL_TENANT_NAMES. Reset after changing the environment variable.</small></div></section><section className="card demo-reset-card"><div><div className="eyebrow">Demo control</div><h2>Reset the current portfolio demo</h2><p>Rebuilds all 17 properties, the imported ledger, review queue, credits, expenses, reversal example, and backup history.</p></div><details className="destructive"><summary>Reset demo data</summary><form className="form" action={resetDemoDataAction}><div className="field"><label htmlFor="demo-reset-confirmation">Type “RESET SAMPLE PORTFOLIO”</label><input id="demo-reset-confirmation" name="confirmation" required autoComplete="off"/></div><button className="button danger" type="submit">Reset current portfolio demo</button></form></details></section></>}
  </>;
}
