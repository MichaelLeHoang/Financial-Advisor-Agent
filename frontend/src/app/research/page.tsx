"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, Radio, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { ResearchDepth, ResearchSourceSurface } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { ResearchDepthSelector, normalizeResearchTicker } from "@/components/equity-research/ResearchComponents";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";

function sourceFromQuery(value: string | null): ResearchSourceSurface {
  if (value === "intro-demo") return "introduction";
  if (value === "market" || value === "ai_advisor" || value === "shared" || value === "introduction") return value;
  return "research";
}

function researchRunHref(runId: string, source: ResearchSourceSurface) {
  return `/research/${runId}?from=${source}`;
}

function ResearchLandingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const tickerInputRef = useRef<HTMLInputElement>(null);
  const initialTicker = normalizeResearchTicker(params.get("ticker") ?? "");
  const source = sourceFromQuery(params.get("source"));
  const [ticker, setTicker] = useState(initialTicker);
  const [depth, setDepth] = useState<ResearchDepth>("shallow");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStart = useMemo(() => Boolean(initialTicker && params.get("source")), [initialTicker, params]);
  const isGuest = Boolean(user.is_guest);
  const currentPath = `/research${params.toString() ? `?${params.toString()}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(currentPath)}`;

  useEffect(() => {
    if (!autoStart) return;
    let cancelled = false;
    setLoading(true);
    api.createEquityResearchRun({
      ticker: initialTicker,
      source_surface: source,
      research_depth: depth,
    }).then((run) => {
      if (!cancelled) router.replace(researchRunHref(run.run_id, source));
    }).catch((err: any) => {
      if (!cancelled) setError(err.message ?? "Could not start research run.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [autoStart, depth, initialTicker, router, source]);

  const start = async (value = ticker) => {
    const normalized = normalizeResearchTicker(value);
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      const run = await api.createEquityResearchRun({
        ticker: normalized,
        source_surface: source,
        research_depth: user.is_guest ? "shallow" : depth,
      });
      router.push(researchRunHref(run.run_id, source));
    } catch (err: any) {
      setError(err.message ?? "Could not start research run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06080d] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href={source === "market" ? "/market" : source === "introduction" ? "/#equity-research-demo" : "/"} className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft className="size-4" /> {source === "market" ? "Market" : source === "introduction" ? "Introduction Demo" : "AI Advisor"}
        </Link>
        {isGuest ? (
          <Link href={loginHref} className="inline-flex h-9 items-center rounded-full border border-white/[0.12] bg-white/[0.035] px-3 text-sm font-semibold text-white/70 hover:text-white">
            Sign In
          </Link>
        ) : (
          <div className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-100">
            <CheckCircle2 className="size-4" /> {user.email ?? "Signed in"}
          </div>
        )}
      </div>

      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
          <Radio className="size-3.5" /> QuanAd 2.1 Equity Research Desk
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">What equity would you like to analyze?</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/58">
        </p>

        <div className="mt-8 w-full max-w-3xl">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.20)] focus-within:border-indigo-primary/55">
            <TickerSuggestionInput
              value={ticker}
              onValueChange={(value) => setTicker(normalizeResearchTicker(value))}
              onSelect={(selected) => {
                setTicker(selected);
                void start(selected);
              }}
              existingTickers={[]}
              placeholder="Enter a ticker (AAPL, MSFT, NVDA...)"
              className="min-w-0 flex-1"
              inputClassName="h-12 rounded-full border-0 bg-transparent pl-10 pr-9 text-lg font-semibold text-white placeholder:text-white/30 focus-visible:ring-0"
              inputRef={tickerInputRef}
            />
            <button
              type="button"
              onClick={() => start()}
              disabled={loading || !ticker}
              className="h-12 rounded-full bg-indigo-primary px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-primary/90 disabled:opacity-45"
            >
              {loading ? "Starting..." : "Generate Report"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-negative">{error}</p>}
        </div>

        {isGuest ? (
          <div className="mt-6 w-full max-w-2xl rounded-2xl border border-indigo-primary/20 bg-indigo-primary/10 p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-primary/16 text-indigo-primary ring-1 ring-indigo-primary/25">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-primary">Public demo mode</p>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  Run shallow research with default analysts and models on supported large-cap tickers. Sign in to share analysis, choose deeper research, customize agents, and unlock broader ticker coverage.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={loginHref} className="inline-flex h-8 items-center rounded-full bg-indigo-primary px-3 text-xs font-semibold text-white hover:bg-indigo-primary/90">
                    Sign in for more features
                  </Link>
                  <button
                    type="button"
                    onClick={() => tickerInputRef.current?.focus()}
                    className="inline-flex h-8 items-center rounded-full border border-white/[0.10] px-3 text-xs font-semibold text-white/58 hover:text-white"
                  >
                    Continue with public demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-primary">Research depth</p>
            {isGuest && <span className="inline-flex items-center gap-1 text-xs text-white/38"><Lock className="size-3" /> Guest demo uses shallow</span>}
          </div>
          <ResearchDepthSelector value={isGuest ? "shallow" : depth} onChange={setDepth} locked={isGuest} />
          {/* <p className="mt-3 text-xs leading-5 text-white/42">
            Sign up to share reports, use your own API keys, customize analysts, and choose advanced models. Download is available from the generated report.
          </p> */}
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
