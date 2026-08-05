import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import type { AppCapabilities } from "@/lib/capabilities";
import { NavLinks } from "@/components/nav-links";

export function AppShell({children,capabilities,demoMode,showRealTenantNames}:{children:React.ReactNode;capabilities:AppCapabilities;demoMode:boolean;showRealTenantNames:boolean}){
  return <div className={`shell ${capabilities.mobilePriority?"phone-priority":"desktop-priority"} ${capabilities.densePortfolio?"dense-portfolio":"card-portfolio"}`}>
    <aside className="sidebar">
      <Link href="/dashboard" className="brand"><span className="brand-mark">RT</span><span>Rental Tracker<small>append-only ledger</small></span></Link>
      <nav className="nav" aria-label="Primary navigation"><NavLinks showImport={capabilities.showImportInPrimaryNav}/></nav>
      <div className="sidebar-footer">
        <div className="safety-lock"><span aria-hidden="true">✓</span><div><strong>Financial history protected</strong><small>Corrections create reversals.</small></div></div>
        <Link href="/settings/data-safety">View data safety</Link>
      </div>
    </aside>
    <main className="main">
      {demoMode&&<div className="demo-banner"><strong>Current Portfolio Demo</strong><span>{showRealTenantNames?"Approved current tenant names visible":"Tenant names masked"} · changes are temporary</span><Link href="/settings">Demo settings</Link></div>}
      <header className="topbar">
        <div><span className="desktop-title">{capabilities.actualPropertyCount} active propert{capabilities.actualPropertyCount===1?"y":"ies"} · single-owner workspace</span><span className="mobile-title">Rental Tracker</span></div>
        <div className="topbar-actions"><Link className="button compact secondary" href="/settings/data-safety">Data safety</Link><form action={logoutAction}><button className="button compact ghost" type="submit">Sign out</button></form></div>
      </header>
      <div className="content">{children}</div>
      <Link className="quick-payment" href="/payments/new"><span aria-hidden="true">＋</span> Record payment</Link>
    </main>
  </div>;
}
