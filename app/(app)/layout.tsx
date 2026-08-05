import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { deriveCapabilities } from "@/lib/capabilities";
import { getActivePropertyCount, getSettings } from "@/lib/data";
import { demoShowsRealTenantNames, isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function AppLayout({children}:{children:React.ReactNode}){
  const settings=await getSettings();
  if(!settings) redirect("/setup");
  const actualPropertyCount=await getActivePropertyCount();
  return <AppShell capabilities={deriveCapabilities(settings,actualPropertyCount)} demoMode={isDemoMode()} showRealTenantNames={demoShowsRealTenantNames()}>{children}</AppShell>;
}
