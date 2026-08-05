import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { Flash, flashFrom } from "@/components/flash";
import { SetupForm } from "@/components/setup-form";

export default async function SetupPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  await requireSession();
  const [settings,flash]=await Promise.all([getSettings(),flashFrom(searchParams)]);
  return <main className="setup-wrap"><section className="setup-card">
    <div className="setup-header"><div><div className="eyebrow">Portfolio setup · four answers</div><h1>Tell it what you actually manage.</h1><p>Everything stays editable. These answers shape the interface without becoming data limits.</p></div>{settings&&<Link className="button secondary" href="/settings">Cancel</Link>}</div>
    <Flash {...flash}/><SetupForm settings={settings}/>
  </section></main>;
}
