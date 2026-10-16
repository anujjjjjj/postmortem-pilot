import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostmortemPilot: cited, blameless postmortems from incident chat",
  description: "Paste an incident channel and get a blameless postmortem draft. Every claim links to its source line. Deterministic timestamps, runs in the browser, bring your own key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
