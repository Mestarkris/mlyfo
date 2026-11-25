import type { Metadata, Viewport } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Mlyfo: the AI keyboard that can pay",
  description: "Split bills, pay requests, check addresses and plan from any chat. Verified with Kane CLI.",
  applicationName: "Mlyfo",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Mlyfo", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#07080D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="night">{children}</body>
    </html>
  );
}
