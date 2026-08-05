"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {label:string;href:string;icon:React.ReactNode;mobile?:boolean};

function Icon({children}:{children:React.ReactNode}){
  return <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg></span>;
}

export function NavLinks({showImport}:{showImport:boolean}){
  const pathname=usePathname();
  const items:NavItem[]=[
    {label:"Dashboard",href:"/dashboard",mobile:true,icon:<Icon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Icon>},
    {label:"Properties",href:"/properties",mobile:true,icon:<Icon><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></Icon>},
    {label:"Record",href:"/payments/new",mobile:true,icon:<Icon><path d="M12 5v14M5 12h14"/></Icon>},
    {label:"Ledger",href:"/ledger",mobile:true,icon:<Icon><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/></Icon>},
    ...(showImport?[{label:"Import",href:"/import",icon:<Icon><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></Icon>}]:[]),
    {label:"Data safety",href:"/settings/data-safety",icon:<Icon><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-5"/></Icon>},
    {label:"Settings",href:"/settings",mobile:true,icon:<Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></Icon>},
  ];
  return <>{items.map(item=>{
    const active=item.href==="/settings"?pathname==="/settings"||pathname==="/setup":pathname===item.href||pathname.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} className={`${active?"active":""} ${item.mobile?"mobile-nav-item":"desktop-only-nav"}`} aria-current={active?"page":undefined}>{item.icon}<span>{item.label}</span></Link>;
  })}</>;
}
