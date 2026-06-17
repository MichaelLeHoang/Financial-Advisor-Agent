"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { AnalysisWorkspace } from "@/components/equity-research/ResearchComponents";
import { useAuth } from "@/components/auth/AuthProvider";

function returnTarget(from: string | null) {
  if (from === "market") return { href: "/market", label: "Market" };
  if (from === "introduction" || from === "intro-demo") return { href: "/introduction#equity-research-demo", label: "Introduction Demo" };
  if (from === "ai_advisor") return { href: "/", label: "AI Advisor" };
  return { href: "/research", label: "Research Desk" };
}

export default function ResearchRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const backTarget = returnTarget(searchParams.get("from"));
  const currentPath = `/research/${runId}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(currentPath)}`;

  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-4 text-white sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push(backTarget.href);
          }}
          className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"
        >
          <ArrowLeft className="size-4" /> {backTarget.label}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {user.is_guest ? (
            <Link href={loginHref} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 text-xs font-semibold text-indigo-100 hover:bg-indigo-primary/16 hover:text-white">
              <Lock className="size-3.5" /> Sign in to share
            </Link>
          ) : null}
          <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold text-white/50">
            QuanAd 2.1
          </div>
        </div>
      </div>
      <AnalysisWorkspace runId={runId} />
    </main>
  );
}
