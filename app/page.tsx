import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home(){
  redirect((await getSettings())?"/dashboard":"/setup");
}
