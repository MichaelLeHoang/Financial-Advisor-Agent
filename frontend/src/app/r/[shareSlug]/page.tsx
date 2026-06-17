"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicEquityResearchReport } from "@/lib/api";
import Markdown from "@/components/ui/markdown";
import { FinalDecisionCard, ReportFileList } from "@/components/equity-research/ResearchComponents";

export default function SharedResearchReportPage({ params }: { params: Promise<{ shareSlug: string }> }) {
  const { shareSlug } = use(params);
  const [data, setData] = useState<PublicEquityResearchReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.publicEquityResearchReport(shareSlug)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setSelected(payload.reports.find((report) => report.agent_key === "pm")?.agent_key ?? payload.reports[0]?.agent_key ?? null);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message ?? "Shared report not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  const report = data?.reports.find((item) => item.agent_key === selected) ?? data?.reports[0];

  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-5 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/research" className="mb-5 inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="size-4" /> QuanAd Research Desk
        </Link>
        {error ? (
          <div className="rounded-2xl border border-red-negative/30 bg-red-negative/10 p-5 text-red-negative">{error}</div>
        ) : !data ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-8 text-white/45">Loading shared report...</div>
        ) : (
          <div className="space-y-4">
            <FinalDecisionCard run={data.run} />
            <ReportFileList reports={data.reports} selectedAgent={selected} onSelectAgent={setSelected} />
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
              <Markdown content={report?.markdown ?? "No public report content is available."} />
            </article>
          </div>
        )}
      </div>
    </main>
  );
}
