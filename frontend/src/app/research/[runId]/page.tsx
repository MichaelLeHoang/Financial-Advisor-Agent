"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AnalysisWorkspace } from "@/components/equity-research/ResearchComponents";

function returnTarget(from: string | null) {
  if (from === "market") return { href: "/market", label: "Market" };
  if (from === "introduction" || from === "intro-demo") return { href: "/introduction#equity-research-demo", label: "Introduction Demo" };
  if (from === "ai_advisor") return { href: "/", label: "AI Advisor" };
  return { href: "/research", label: "Research Desk" };
}

export default function ResearchRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const searchParams = useSearchParams();
  const backTarget = returnTarget(searchParams.get("from"));

  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-4 text-white sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href={backTarget.href} className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="size-4" /> {backTarget.label}
        </Link>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/50">
          QuanAd 2.1
        </div>
      </div>
      <AnalysisWorkspace runId={runId} />
    </main>
  );
}
