import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { deriveCapabilities } from "@/lib/capabilities";
import { getActivePropertyCount, getSettings } from "@/lib/data";
import { demoShowsRealTenantNames, isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({children}:{children:React.ReactNode}){
  await requireSession();
  const settings=await getSettings();
  if(!settings) redirect("/setup");
  const actualPropertyCount=await getActivePropertyCount();
  return <AppShell capabilities={deriveCapabilities(settings,actualPropertyCount)} demoMode={isDemoMode()} showRealTenantNames={demoShowsRealTenantNames()}>{children}</AppShell>;
}
