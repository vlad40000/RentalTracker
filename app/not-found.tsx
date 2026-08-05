import Link from "next/link";
export default function NotFound(){return <main className="auth-wrap"><section className="auth-card"><div className="eyebrow">Not found</div><h1>That record does not exist.</h1><p className="muted">It may have been archived or the link may be incomplete.</p><Link className="button" href="/dashboard">Return to dashboard</Link></section></main>}
