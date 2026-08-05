import Link from "next/link";
import { PaymentForm } from "@/components/payment-form";
import { Flash, flashFrom } from "@/components/flash";
import { getPaymentOptions } from "@/lib/data";
import { todayIso } from "@/lib/dates";

export default async function NewPaymentPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams; const initialPropertyId=typeof params.propertyId==='string'?params.propertyId:undefined;
  const [options,flash]=await Promise.all([getPaymentOptions(),flashFrom(Promise.resolve(params))]);
  return <><div className="page-head"><div><div className="eyebrow">Most-used action</div><h1>Record a payment</h1><p>Pre-filled from the selected tenant and oldest open balance.</p></div><Link className="button secondary" href="/dashboard">Cancel</Link></div><Flash {...flash}/><PaymentForm options={options} initialPropertyId={initialPropertyId} today={todayIso()}/></>;
}
