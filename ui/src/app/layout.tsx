import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Financial Advisor AI",
  description: "AI-powered financial analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased flex">
        <Sidebar />
        {/* Offset for fixed sidebar */}
        <main className="flex-1 ml-16 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
