import type { Metadata } from "next";
import { Geist, Hanken_Grotesk, Inter } from "next/font/google";
import AppShell from "./AppShell";
import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const rootFontClasses = `${geist.variable} ${hankenGrotesk.variable} ${inter.variable}`;

export const metadata: Metadata = {
  title: {
    default: "Quanfora — AI Financial Research Workspace",
    template: "%s | Quanfora",
  },
  description: "Research markets, evaluate portfolio risk, and document investment decisions in one AI-assisted workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rootFontClasses} dark`} suppressHydrationWarning>
      <body data-theme="Deep Space" className="overflow-x-hidden bg-space-black font-sans text-white antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[300] -translate-y-24 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 motion-reduce:transition-none"
        >
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
