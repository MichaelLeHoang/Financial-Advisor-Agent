"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  CircleDotDashed,
  ExternalLink,
  FileText,
  Lock,
  Radio,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  EquityResearchEvent,
  EquityResearchReport,
  EquityResearchRun,
  EquityResearchRunDetail,
  ResearchDepth,
  ResearchRecommendation,
  ResearchRunStatus,
  ResearchSourceSurface,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import Markdown from "@/components/ui/markdown";
import { useAuth } from "@/components/auth/AuthProvider";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";

const AGENT_GROUPS = [
  { title: "Analyst Agents", agents: [["market", "Market Analyst"], ["social", "Social Media Analyst"], ["news", "News Analyst"], ["fundamentals", "Fundamentals Analyst"]] },
  { title: "Research Agents", agents: [["bull", "Bull Researcher"], ["bear", "Bear Researcher"], ["evaluator", "Research Evaluator"]] },
  { title: "Trading Desk", agents: [["trader", "Trader"]] },
  { title: "Risk Management Agents", agents: [["risky", "Risky Analyst"], ["neutral", "Neutral Analyst"], ["safe", "Safe Analyst"]] },
  { title: "Final Verdict", agents: [["pm", "Portfolio Manager"]] },
] as const;

const REPORT_FILES: Record<string, string> = {
  market: "market_report.md",
  social: "sentiment_report.md",
  news: "news_report.md",
  fundamentals: "fundamentals_report.md",
  bull: "bull_case.md",
  bear: "bear_case.md",
  evaluator: "research_evaluation.md",
  trader: "trader_plan.md",
  risky: "risk_opportunity.md",
  neutral: "risk_review.md",
  safe: "safe_risk_controls.md",
  pm: "final_trade_decision.md",
};

export function normalizeResearchTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function TickerAnalyzeInput({
  source,
  compact = false,
  initialTicker = "",
  newTab = false,
  onCreated,
}: {
  source: ResearchSourceSurface;
  compact?: boolean;
  initialTicker?: string;
  newTab?: boolean;
  onCreated?: (run: EquityResearchRun) => void;
}) {
  const router = useRouter();
  const [ticker, setTicker] = useState(initialTicker);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value = ticker) => {
    const normalized = normalizeResearchTicker(value);
    if (!normalized) return;
    setLoading(true);
    setError(null);
    try {
      if (newTab) {
        window.open(`/research?ticker=${encodeURIComponent(normalized)}&source=${source}`, "_blank", "noopener,noreferrer");
        return;
      }
      const run = await api.createEquityResearchRun({
        ticker: normalized,
        source_surface: source,
        research_depth: "shallow",
      });
      onCreated?.(run);
      if (!onCreated) router.push(`/research/${run.run_id}?from=${source}`);
    } catch (err: any) {
      setError(err.message ?? "Could not start research run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("w-full", compact ? "max-w-xl" : "max-w-3xl")}>
      <div className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.20)] focus-within:border-indigo-primary/55">
        <TickerSuggestionInput
          value={ticker}
          onValueChange={(value) => setTicker(normalizeResearchTicker(value))}
          onSelect={(selected) => {
            setTicker(selected);
            void submit(selected);
          }}
          existingTickers={[]}
          placeholder="Enter a ticker: AAPL, MSFT, NVDA..."
          className="min-w-0 flex-1"
          inputClassName="h-11 rounded-full border-0 bg-transparent pl-10 pr-9 text-base font-semibold text-white placeholder:text-white/30 focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={loading || !ticker.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-primary text-white transition-colors hover:bg-indigo-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Generate research report"
        >
          {loading ? <CircleDotDashed className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-negative">{error}</p>}
    </div>
  );
}

export function EquityResearchIntroDemo() {
  return (
    <section id="equity-research-demo" className="relative mx-auto mt-10 max-w-6xl scroll-mt-24 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#090b12] px-5 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.32)] sm:px-8 sm:py-9">
      <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
            <Radio className="size-3.5" /> QuanAd 2.1 Equity Research Desk
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">What stock would you like to analyze?</h2>
          <div className="mt-6">
            <TickerAnalyzeInput source="introduction" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/42">
            {/* <span>
              Inspired by Trading Agent research patterns. Read the paper{" "}
              <a href="https://arxiv.org/pdf/2412.20138" target="_blank" rel="noopener noreferrer" className="text-indigo-200 underline decoration-indigo-200/30 underline-offset-2 hover:text-white">
                arXiv:2412.20138
              </a>.
            </span> */}
            <Link
              href="/research?source=introduction"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white"
            >
              Open full demo in new tab <ExternalLink className="size-3" />
            </Link>
          </div>
      
          <p className="mt-1 text-xs text-white/38"> Inspired by Trading Agent research patterns. Read the paper{" "}
              <a href="https://arxiv.org/pdf/2412.20138" target="_blank" rel="noopener noreferrer" className="text-indigo-200 underline decoration-indigo-200/30 underline-offset-2 hover:text-white">
                arXiv:2412.20138
              </a>.
          </p>
          <p className="mt-4 text-xs text-white/38">Not investment advice. For educational and informational use only.</p>
          
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <ResearchDemoProgressLoop />
        </div>
      </div>
    </section>
  );
}

function ResearchDemoProgressLoop() {
  const steps = [
    "Market Analyst",
    "News Analyst",
    "Sentiment Analyst",
    "Fundamentals Analyst",
    "Bull Researcher",
    "Bear Researcher",
    "Trader",
    "Risk Review",
    "Portfolio Manager",
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % steps.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Workflow</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-primary via-cyan-secondary to-emerald-300 transition-[width] duration-500"
          style={{ width: `${((active + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const completed = index < active;
          const running = index === active;
          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
                running ? "bg-indigo-primary/14 text-white" : completed ? "text-white/38" : "text-white/28"
              )}
            >
              {running ? (
                <CircleDotDashed className="size-4 animate-spin text-indigo-200" />
              ) : completed ? (
                <CheckCircle2 className="size-4 text-emerald-300" />
              ) : (
                <Circle className="size-4" />
              )}
              <span className="text-sm font-medium">{step}</span>
              {running && <span className="ml-auto text-[10px] uppercase tracking-wider text-indigo-100/70">processing</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FinalDecisionCard({ run }: { run: EquityResearchRun }) {
  const tone = recommendationTone(run.recommendation);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Final Recommendation</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-xl px-3 py-1.5 text-lg font-bold", tone.className)}>{tone.label}</span>
            <span className="rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm font-semibold text-white/70">
              {Math.round(run.confidence * 100)}% confidence
            </span>
          </div>
        </div>
        <div className="text-right text-sm text-white/48">
          <div className="font-semibold text-white">{run.ticker}</div>
          <div>{run.company_name ?? "Resolving company..."}</div>
          <div>{run.analysis_date}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DecisionFact icon={<BarChart3 className="size-4" />} label="Main upside" value={run.main_upside ?? "Pending research output."} />
        <DecisionFact icon={<AlertTriangle className="size-4" />} label="Main risk" value={run.main_risk ?? "Pending risk review."} />
      </div>
      {run.final_summary && <p className="mt-4 text-sm leading-6 text-white/62">{run.final_summary}</p>}
      <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/45">
        <ShieldCheck className="size-3.5" /> {run.disclaimer}
      </p>
    </div>
  );
}

function DecisionFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/35">{icon}{label}</div>
      <p className="text-sm leading-5 text-white/70">{value}</p>
    </div>
  );
}

export function AgentProgressSidebar({
  reports,
  status,
  selectedAgent,
  onSelectAgent,
  compact = false,
}: {
  reports: EquityResearchReport[];
  status: ResearchRunStatus;
  selectedAgent?: string;
  onSelectAgent?: (agentKey: string) => void;
  compact?: boolean;
}) {
  const reportByAgent = useMemo(() => new Map(reports.map((report) => [report.agent_key, report])), [reports]);
  const firstPendingMarkedRunning = status === "running";
  let markedRunning = false;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {AGENT_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/32">{group.title}</p>
          <div className="space-y-1">
            {group.agents.map(([key, name]) => {
              const report = reportByAgent.get(key);
              let agentStatus = report?.status ?? "pending";
              if (!report && firstPendingMarkedRunning && !markedRunning) {
                agentStatus = "running";
                markedRunning = true;
              }
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!report}
                  onClick={() => report && onSelectAgent?.(key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selectedAgent === key ? "bg-indigo-primary/16 text-white" : "text-white/58 hover:bg-white/[0.05]",
                    !report && "cursor-default hover:bg-transparent"
                  )}
                >
                  <StatusIcon status={agentStatus} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {report && <span className="text-[10px] text-white/30">{REPORT_FILES[key]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="size-4 text-emerald-300" aria-label="completed" />;
  if (status === "running") return <CircleDotDashed className="size-4 animate-spin text-indigo-300" aria-label="running" />;
  if (status === "failed") return <AlertTriangle className="size-4 text-amber-warning" aria-label="failed" />;
  if (status === "skipped") return <Circle className="size-4 text-white/25" aria-label="skipped" />;
  return <Circle className="size-4 text-white/20" aria-label="pending" />;
}

export function MessagesToolsFeed({ events }: { events: EquityResearchEvent[] }) {
  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-sm text-white/38">Waiting for research events...</p>
      ) : events.slice().reverse().map((event) => (
        <div key={event.event_id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/52">
              {event.event_type}
            </span>
            <span className="text-[10px] text-white/28">{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white/75">{event.label}</p>
          <p className="mt-1 text-xs leading-5 text-white/45">{event.content}</p>
          {event.tool_name && (
            <p className="mt-2 rounded-lg bg-black/20 px-2 py-1 font-mono text-[10px] text-cyan-200/70">{event.tool_name}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function AnalysisConfigPanel({ run }: { run: EquityResearchRun }) {
  const { user } = useAuth();
  const isGuest = Boolean(user?.is_guest);
  return (
    <div className="space-y-3">
      <ConfigRow label="Analysis Date" value={run.analysis_date} />
      <ConfigRow label="Research Depth" value={run.research_depth} locked={isGuest && run.research_depth === "shallow"} lockText="Sign up to unlock medium and deep research." />
      <ConfigRow label="Quick Thinking" value={run.quick_model} locked={isGuest} lockText="Sign up to choose Quick Thinking models." />
      <ConfigRow label="Deep Thinking" value={run.deep_model} locked={isGuest} lockText="Sign up to choose Deep Thinking models." />
      <ConfigRow label="Analyst Team" value={run.selected_analysts.join(", ")} locked={isGuest} lockText="Sign up to customize analyst team." />
    </div>
  );
}

function ConfigRow({ label, value, locked, lockText }: { label: string; value: string; locked?: boolean; lockText?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/32">{label}</p>
        {locked && <Lock className="size-3.5 text-amber-warning" />}
      </div>
      <p className="mt-1 text-sm font-semibold capitalize text-white/72">{value}</p>
      {locked && <p className="mt-1 text-xs text-white/36">{lockText}</p>}
    </div>
  );
}

export function ReportFileList({
  reports,
  selectedAgent,
  onSelectAgent,
}: {
  reports: EquityResearchReport[];
  selectedAgent: string | null;
  onSelectAgent: (agent: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {reports.map((report) => (
        <button
          key={report.report_id}
          onClick={() => onSelectAgent(report.agent_key)}
          className={cn(
            "shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
            selectedAgent === report.agent_key
              ? "border-indigo-primary/50 bg-indigo-primary/18 text-white"
              : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:bg-white/[0.055]"
          )}
        >
          <span className="flex items-center gap-1.5 font-semibold"><FileText className="size-3.5" />{REPORT_FILES[report.agent_key] ?? report.title}</span>
          <span className="mt-1 block text-[10px] text-white/34">{report.agent_name}</span>
        </button>
      ))}
    </div>
  );
}

export function AnalysisWorkspace({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<EquityResearchRunDetail | null>(null);
  const [events, setEvents] = useState<EquityResearchEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let eventCursor = 0;
    const load = async () => {
      try {
        const next = await api.equityResearchRun(runId);
        if (cancelled) return;
        setDetail(next);
        setEvents((current) => mergeEvents(current, next.latest_events));
        if (!selectedAgent && next.reports.length > 0) {
          setSelectedAgent(next.reports[next.reports.length - 1].agent_key);
        }
        const listed = await api.equityResearchEvents(runId, eventCursor);
        if (!cancelled) {
          eventCursor = listed.cursor;
          setEvents((current) => mergeEvents(current, listed.events));
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Could not load research run.");
      }
    };
    load();
    const timer = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runId, selectedAgent]);

  if (error) return <div className="rounded-2xl border border-red-negative/30 bg-red-negative/10 p-5 text-red-negative">{error}</div>;
  if (!detail) return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-8 text-white/45">Loading QuanAd 2.1 workspace...</div>;

  const selectedReport = detail.reports.find((report) => report.agent_key === selectedAgent) ?? detail.reports.find((report) => report.agent_key === "pm") ?? detail.reports[0];

  return (
    <div className="grid min-h-[calc(100vh-5rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <AgentProgressSidebar reports={detail.reports} status={detail.run.status} selectedAgent={selectedAgent ?? undefined} onSelectAgent={setSelectedAgent} />
      </aside>
      <main className="min-w-0 space-y-4">
        <FinalDecisionCard run={detail.run} />
        <ReportFileList reports={detail.reports} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
        <article className="min-h-[30rem] rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          {selectedReport ? (
            <Markdown content={selectedReport.markdown} />
          ) : (
            <div className="flex min-h-[20rem] items-center justify-center text-center text-white/42">
              Agent reports will appear here as the run progresses.
            </div>
          )}
        </article>
      </main>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Configuration</h3>
            {detail.run.share_slug ? (
              <Link href={`/r/${detail.run.share_slug}`} className="text-xs text-indigo-200 hover:text-white">Shared</Link>
            ) : <ShareButton run={detail.run} />}
          </div>
          <AnalysisConfigPanel run={detail.run} />
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Messages & Tools</h3>
          <MessagesToolsFeed events={events} />
        </div>
      </aside>
    </div>
  );
}

function ShareButton({ run }: { run: EquityResearchRun }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  if (user.is_guest) {
    return <span className="inline-flex items-center gap-1 text-xs text-white/35"><Lock className="size-3" /> Sign in to share</span>;
  }
  return (
    <button
      type="button"
      disabled={loading || run.status !== "completed"}
      onClick={async () => {
        setLoading(true);
        await api.shareEquityResearchRun(run.run_id, true).finally(() => setLoading(false));
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-white/55 hover:text-white disabled:opacity-40"
    >
      <Share2 className="size-3.5" /> Share
    </button>
  );
}

function mergeEvents(current: EquityResearchEvent[], incoming: EquityResearchEvent[]) {
  const map = new Map(current.map((event) => [event.event_id, event]));
  incoming.forEach((event) => map.set(event.event_id, event));
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function recommendationTone(recommendation: ResearchRecommendation) {
  if (recommendation === "buy") return { label: "BUY", className: "bg-emerald-400/14 text-emerald-200 ring-1 ring-emerald-400/25" };
  if (recommendation === "sell") return { label: "SELL", className: "bg-rose-400/14 text-rose-200 ring-1 ring-rose-400/25" };
  if (recommendation === "hold") return { label: "HOLD", className: "bg-amber-400/14 text-amber-100 ring-1 ring-amber-400/25" };
  return { label: "INSUFFICIENT DATA", className: "bg-slate-400/14 text-slate-200 ring-1 ring-slate-400/25" };
}

export function ResearchRunCompactResult({ run, from }: { run: EquityResearchRun; from?: ResearchSourceSurface }) {
  const tone = recommendationTone(run.recommendation);
  const fullReportHref = from ? `/research/${run.run_id}?from=${from}` : `/research/${run.run_id}`;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("rounded-lg px-2.5 py-1 text-sm font-bold", tone.className)}>{tone.label}</span>
        <span className="text-xs text-white/45">{Math.round(run.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-3 text-sm text-white/62">{run.final_summary ?? "Final verdict is pending."}</p>
      <Link
        href={fullReportHref}
        className="on-accent accent-gradient-surface mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl px-3 text-sm font-semibold"
      >
        Open Full Report
      </Link>
    </div>
  );
}

export function ResearchDepthSelector({ value, onChange, locked }: { value: ResearchDepth; onChange: (value: ResearchDepth) => void; locked?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] p-1">
      {(["shallow", "medium", "deep"] as ResearchDepth[]).map((depth) => (
        <button
          key={depth}
          type="button"
          disabled={locked && depth !== "shallow"}
          onClick={() => onChange(depth)}
          className={cn(
            "rounded-lg px-2 py-2 text-xs font-semibold capitalize transition-colors",
            value === depth ? "bg-white/12 text-white" : "text-white/42 hover:bg-white/[0.05]",
            locked && depth !== "shallow" && "cursor-not-allowed opacity-35"
          )}
        >
          {depth}
        </button>
      ))}
    </div>
  );
}
