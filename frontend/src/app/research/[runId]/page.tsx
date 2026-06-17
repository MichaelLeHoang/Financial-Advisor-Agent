"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisWorkspace } from "@/components/equity-research/ResearchComponents";

export default function ResearchRunPage({ params }: { params: { runId: string } }) {
  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-4 text-white sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/research" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="size-4" /> Research Desk
        </Link>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/50">
          QuanAd 2.1
        </div>
      </div>
      <AnalysisWorkspace runId={params.runId} />
    </main>
  );
}
