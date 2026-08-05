import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home(){
  if(!(await isAuthenticated())) redirect("/login");
  redirect((await getSettings())?"/dashboard":"/setup");
}
