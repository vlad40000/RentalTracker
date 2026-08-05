import { redirect } from "next/navigation";
import { continueDemoAction, loginAction } from "@/lib/actions";
import { isAuthenticated } from "@/lib/auth";
import { Flash, flashFrom } from "@/components/flash";

export default async function LoginPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  if(await isAuthenticated()) redirect("/dashboard");
  const flash=await flashFrom(searchParams);
  return <main className="auth-wrap"><section className="auth-card">
    <div className="eyebrow">Single-owner demo</div><h1>Rental Tracker</h1><p className="muted">A durable ledger that protects posted financial history from edits and deletion.</p>
    <Flash {...flash}/>
    <form className="form" action={loginAction}>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue="owner@example.com" required autoComplete="username"/></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" defaultValue="demo-only-change-me" required autoComplete="current-password"/></div>
      <button className="button full" type="submit">Sign in</button>
    </form>
    <div className="divider">or</div>
    <form action={continueDemoAction}><button className="button secondary full" type="submit">Explore the Sample Portfolio</button></form>
    <p className="muted" style={{fontSize:13}}>Dummy authentication is for demonstration only. Replace it before storing real rental data.</p>
  </section></main>;
}
