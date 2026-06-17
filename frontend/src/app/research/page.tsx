"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Radio } from "lucide-react";
import { api } from "@/lib/api";
import type { ResearchDepth, ResearchSourceSurface } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ResearchDepthSelector, normalizeResearchTicker } from "@/components/equity-research/ResearchComponents";

function sourceFromQuery(value: string | null): ResearchSourceSurface {
  if (value === "intro-demo") return "introduction";
  if (value === "market" || value === "ai_advisor" || value === "shared" || value === "introduction") return value;
  return "research";
}

function ResearchLandingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const initialTicker = normalizeResearchTicker(params.get("ticker") ?? "");
  const source = sourceFromQuery(params.get("source"));
  const [ticker, setTicker] = useState(initialTicker);
  const [depth, setDepth] = useState<ResearchDepth>("shallow");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStart = useMemo(() => Boolean(initialTicker && params.get("source")), [initialTicker, params]);

  useEffect(() => {
    if (!autoStart) return;
    let cancelled = false;
    setLoading(true);
    api.createEquityResearchRun({
      ticker: initialTicker,
      source_surface: source,
      research_depth: depth,
    }).then((run) => {
      if (!cancelled) router.replace(`/research/${run.run_id}`);
    }).catch((err: any) => {
      if (!cancelled) setError(err.message ?? "Could not start research run.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [autoStart, depth, initialTicker, router, source]);

  const start = async () => {
    const normalized = normalizeResearchTicker(ticker);
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const run = await api.createEquityResearchRun({
        ticker: normalized,
        source_surface: "research",
        research_depth: user.is_guest ? "shallow" : depth,
      });
      router.push(`/research/${run.run_id}`);
    } catch (err: any) {
      setError(err.message ?? "Could not start research run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="size-4" /> AI Advisor
        </Link>
        <Link href="/login" className="inline-flex h-9 items-center rounded-full border border-white/[0.12] bg-white/[0.035] px-3 text-sm font-semibold text-white/70 hover:text-white">
          Sign In
        </Link>
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          <Radio className="size-3.5" /> QuanAd 2.1 Equity Research Desk
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">What equity would you like to analyze?</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/58">
          Generate a structured research workflow with market, news, sentiment, fundamentals, trading, and risk-management agents.
        </p>

        <div className="mt-8 w-full max-w-3xl">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.20)] focus-within:border-indigo-primary/55">
            <input
              value={ticker}
              onChange={(event) => setTicker(normalizeResearchTicker(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  start();
                }
              }}
              placeholder="Enter a ticker (AAPL, MSFT, NVDA...)"
              className="h-12 min-w-0 flex-1 bg-transparent px-5 text-lg font-semibold text-white placeholder:text-white/30 focus:outline-none"
              aria-label="Ticker for equity research"
            />
            <button
              type="button"
              onClick={start}
              disabled={loading || !ticker}
              className="h-12 rounded-full bg-indigo-primary px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-primary/90 disabled:opacity-45"
            >
              {loading ? "Starting..." : "Generate Research Report"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-negative">{error}</p>}
        </div>

        <div className="mt-6 w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Research depth</p>
            {user.is_guest && <span className="inline-flex items-center gap-1 text-xs text-white/38"><Lock className="size-3" /> Guest demo uses shallow</span>}
          </div>
          <ResearchDepthSelector value={user.is_guest ? "shallow" : depth} onChange={setDepth} locked={user.is_guest} />
          <p className="mt-3 text-xs leading-5 text-white/42">
            Sign up to save reports, use your own API keys, customize analysts, and choose advanced models.
          </p>
        </div>

        <p className="mt-6 text-xs text-white/38">Not investment advice. For educational and informational use only.</p>
      </section>
    </main>
  );
}

export default function ResearchLandingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#06080d] p-8 text-white/50">Loading research desk...</main>}>
      <ResearchLandingContent />
    </Suspense>
  );
}
