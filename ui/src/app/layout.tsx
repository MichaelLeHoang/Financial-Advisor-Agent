import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Advisor AI",
  description: "AI-powered financial analysis with RAG, ML prediction and quantum portfolio optimization",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
