import Link from "next/link";
import { generateChargesAction } from "@/lib/actions";
import { getDashboardData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { monthStartIso } from "@/lib/dates";
import { Flash, flashFrom } from "@/components/flash";

function shortDate(value:string){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));}
function dateTime(value:string){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));}

export default async function DashboardPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [data,flash]=await Promise.all([getDashboardData(),flashFrom(searchParams)]);
  const paidUp=data.totalBalanceCents<=0&&data.attention.length===0;
  return <>
    <div className="dashboard-hero">
      <div><div className="eyebrow">Portfolio status · today</div><div className="status-line"><span className={`status-dot ${paidUp?"paid":"attention"}`}/><h1>{paidUp?"Everyone is paid up":"Rent needs attention"}</h1></div><p>{paidUp?"Every posted charge is fully covered.":`${data.attention.length} tenant balance${data.attention.length===1?"":"s"} are overdue. ${formatMoney(data.totalBalanceCents)} remains open across the portfolio.`}</p></div>
      <div className="actions"><Link className="button" href="/payments/new">＋ Record payment</Link><form action={generateChargesAction}><input type="hidden" name="periodStart" value={monthStartIso()}/><button className="button secondary" type="submit">Generate this month</button></form></div>
    </div>
    <Flash {...flash}/>

    <div className="kpi-grid">
      <section className="kpi-card"><div className="kpi-label">Collected this month</div><div className="kpi-value success">{formatMoney(data.collectedThisMonthCents)}</div><div className="kpi-foot">Cash received, net of reversals</div></section>
      <section className={`kpi-card ${data.totalBalanceCents>0?"kpi-alert":""}`}><div className="kpi-label">Outstanding</div><div className={`kpi-value ${data.totalBalanceCents>0?"danger-text":"success"}`}>{formatMoney(data.totalBalanceCents)}</div><div className="kpi-foot">Derived ledger balance · {formatMoney(data.creditHeldCents)} unapplied credit held</div></section>
      <section className="kpi-card"><div className="kpi-label">Expenses this month</div><div className="kpi-value">{formatMoney(data.expensesThisMonthCents)}</div><div className="kpi-foot">Posted expenses, net of reversals</div></section>
      <section className="kpi-card"><div className="kpi-label">YTD net cash</div><div className={`kpi-value ${data.ytdNetCents>=0?"success":"danger-text"}`}>{formatMoney(data.ytdNetCents)}</div><div className="kpi-foot">Collections − expenses this year</div></section>
    </div>

    {data.openImportReviewCount>0&&<section className="import-review-callout"><div><div className="eyebrow">Import integrity</div><h2>{data.openImportReviewCount} source item{data.openImportReviewCount===1?"":"s"} need review</h2><p>The imported workbook contradicts itself in these places. The ledger preserved what was billed and did not silently guess.</p></div><Link className="button secondary" href="/import#review-queue">Review imported data →</Link></section>}

    <div className="dashboard-grid">
      <section className="panel attention-panel">
        <div className="panel-head"><div><div className="eyebrow">Needs attention</div><h2>Overdue balances</h2></div><Link className="text-link" href="/ledger">Open ledger →</Link></div>
        {data.attention.length===0?<div className="clear-state"><span>✓</span><div><strong>No overdue balances</strong><p>The portfolio is clear.</p></div></div>:<div className="attention-list">{data.attention.map(item=><article className="attention-row" key={`${item.propertyId}:${item.tenantId}`}><div className="attention-person"><div className="avatar">{item.tenantName.split(/\s+/).map(part=>part[0]).slice(0,2).join("")}</div><div><strong>{item.tenantName}</strong><Link href={`/properties/${item.propertyId}`}>{item.address}</Link></div></div><div className="attention-meta"><span className="status-badge overdue">{item.daysLate}d late</span><small>Due {shortDate(item.oldestDueDate)}</small></div><div className="attention-amount"><strong>{formatMoney(item.balanceCents)}</strong><Link className="button compact" href={`/payments/new?propertyId=${item.propertyId}`}>Record</Link></div></article>)}</div>}
      </section>

      <aside className="panel safety-panel">
        <div className="safety-shield" aria-hidden="true">✓</div><div className="eyebrow">Data safety</div><h2>Ledger protection is active.</h2><ul className="check-list"><li>Posted money records are append-only</li><li>Corrections create linked reversals</li><li>No cascade deletes</li><li>Full CSV + JSON recovery exports</li></ul><div className="backup-status"><span className={`status-dot ${data.lastExport?.status==="complete"?"paid":"attention"}`}/><div><strong>{data.lastExport?.status==="complete"?"Latest export complete":"No verified export yet"}</strong><small>{data.lastExport?`${dateTime(data.lastExport.createdAt)} · ${data.lastExport.triggerType}`:"Run a manual export before using real data."}</small></div></div><Link className="button secondary full" href="/settings/data-safety">View backup history</Link>
      </aside>
    </div>

    <section className="panel portfolio-panel">
      <div className="panel-head"><div><div className="eyebrow">Portfolio performance</div><h2>{data.propertyCount} properties · {data.activeLeaseCount} active leases · {data.vacantUnitCount} vacancy</h2></div><Link className="text-link" href="/properties">Manage properties →</Link></div>
      <div className="portfolio-table-wrap"><table className="portfolio-table"><thead><tr><th>Property</th><th>Occupancy</th><th>Collected</th><th>Expenses</th><th>Open balance</th><th/></tr></thead><tbody>{data.propertySummaries.map(property=><tr key={property.propertyId}><td><strong>{property.address}</strong><small>{property.city}</small></td><td><span className={`status-badge ${property.occupiedUnits===property.unitCount?"paid":"partial"}`}>{property.occupiedUnits}/{property.unitCount} occupied</span></td><td className="amount success">{formatMoney(property.collectedThisMonthCents)}</td><td className="amount">{formatMoney(property.expensesThisMonthCents)}</td><td className={`amount ${property.balanceCents>0?"danger-text":"success"}`}>{formatMoney(property.balanceCents)}</td><td><Link className="text-link" href={`/properties/${property.propertyId}`}>Open →</Link></td></tr>)}</tbody></table></div>
    </section>

    <section className="panel activity-panel">
      <div className="panel-head"><div><div className="eyebrow">Recent activity</div><h2>Immutable transaction trail</h2></div><Link className="text-link" href="/ledger">See all →</Link></div>
      <div className="activity-list">{data.recentActivity.map(entry=><div className="activity-row" key={`${entry.entryType}:${entry.id}`}><span className={`activity-mark ${entry.entryType}`}>{entry.entryType==="payment"?"↓":entry.entryType==="expense"?"↗":"＋"}</span><div><strong>{entry.description}</strong><small>{entry.propertyAddress} · {shortDate(entry.entryDate)}</small></div><span className={`amount ${entry.amountCents<0?"success":entry.entryType==="expense"?"danger-text":""}`}>{formatMoney(entry.amountCents)}</span></div>)}</div>
    </section>
  </>;
}
