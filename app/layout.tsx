import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Tracker Demo",
  description: "Append-only personal rental ledger sales demo",
  robots: {index:false,follow:false},
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
