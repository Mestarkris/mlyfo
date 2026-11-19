import type { Metadata } from "next";
import { Familjen_Grotesk, Figtree } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const bodyFont = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Mlyfo: the AI keyboard that can pay",
  description: "Split bills, pay requests, check addresses and plan from any chat. Verified with Kane CLI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
