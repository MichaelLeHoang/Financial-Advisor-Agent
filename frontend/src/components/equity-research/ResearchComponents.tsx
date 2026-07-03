"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDotDashed,
  Download,
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
  ResearchReportType,
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

const AGENT_ORDER: string[] = AGENT_GROUPS.flatMap((group) => group.agents.map(([key]) => key));

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

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export function canUseTradingReports(plan: string | undefined) {
  return PLAN_RANK[plan ?? "free"] >= PLAN_RANK.trader;
}

export function reportTypeLabel(type: ResearchReportType) {
  return type === "trading" ? "Trading Report" : "Investment Report";
}

function reportTypeDescription(type: ResearchReportType) {
  return type === "trading"
    ? "Shorter-horizon setup, entry context, invalidation, and trading bias."
    : "Longer-horizon thesis, fundamentals, valuation, portfolio fit, and investment view.";
}

function reportFileLabel(report: EquityResearchReport, run?: EquityResearchRun) {
  if (report.agent_key === "pm" && run?.report_type === "trading") return "final_trading_bias.md";
  if (report.agent_key === "pm") return "final_investment_view.md";
  return REPORT_FILES[report.agent_key] ?? report.title;
}

function finalRecommendationTone(run: EquityResearchRun) {
  const tone = recommendationTone(run.recommendation);
  if (run.report_type === "trading") {
    if (run.recommendation === "buy") return { label: "BULLISH", className: tone.className };
    if (run.recommendation === "sell") return { label: "BEARISH", className: tone.className };
    if (run.recommendation === "hold") return { label: "NEUTRAL", className: tone.className };
    return { label: "INSUFFICIENT DATA", className: tone.className };
  }
  if (run.recommendation === "buy") return { label: "ACCUMULATE", className: tone.className };
  if (run.recommendation === "sell") return { label: "AVOID", className: tone.className };
  if (run.recommendation === "hold") return { label: "WATCHLIST", className: tone.className };
  return { label: "INSUFFICIENT DATA", className: tone.className };
}

export function normalizeResearchTicker(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function ResearchReportTypeSelector({
  value,
  onChange,
  canUseTrading,
  lockedMessage = "Trading reports require the Trader plan.",
}: {
  value: ResearchReportType;
  onChange: (value: ResearchReportType) => void;
  canUseTrading: boolean;
  lockedMessage?: string;
}) {
  const options: Array<{ value: ResearchReportType; label: string }> = [
    { value: "investment", label: "Investment" },
    { value: "trading", label: "Trading" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] p-1">
        {options.map((option) => {
          const locked = option.value === "trading" && !canUseTrading;
          return (
            <button
              key={option.value}
              type="button"
              disabled={locked}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
                value === option.value ? "bg-white/12 text-white" : "text-white/42 hover:bg-white/[0.05]",
                locked && "cursor-not-allowed opacity-35"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-white/38">
        {value === "trading" && !canUseTrading ? lockedMessage : reportTypeDescription(value)}
      </p>
    </div>
  );
}

export function TickerAnalyzeInput({
  source,
  compact = false,
  initialTicker = "",
  reportType = "investment",
  newTab = false,
  onCreated,
  frameClassName,
  inputClassName,
  buttonClassName,
}: {
  source: ResearchSourceSurface;
  compact?: boolean;
  initialTicker?: string;
  reportType?: ResearchReportType;
  newTab?: boolean;
  onCreated?: (run: EquityResearchRun) => void;
  frameClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
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
        window.open(`/research?ticker=${encodeURIComponent(normalized)}&source=${source}&report_type=${reportType}`, "_blank", "noopener,noreferrer");
        return;
      }
      const run = await api.createEquityResearchRun({
        ticker: normalized,
        report_type: reportType,
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
      <div className={cn("flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.20)] focus-within:border-indigo-primary/55", frameClassName)}>
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
          inputClassName={cn("research-ticker-input h-11 rounded-full border-0 bg-transparent pl-10 pr-9 text-base font-semibold text-white placeholder:text-white/30 focus-visible:ring-0", inputClassName)}
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={loading || !ticker.trim()}
          className={cn("on-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-primary text-white transition-colors hover:bg-indigo-primary/90 disabled:cursor-not-allowed disabled:opacity-45", buttonClassName)}
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
    <section id="equity-research-demo" className="research-intro-demo relative mx-auto mt-10 max-w-6xl scroll-mt-24 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#090b12] px-5 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.32)] sm:px-8 sm:py-9">
      <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
            <Radio className="size-3.5" /> Quanfora 2.1 Equity Research Desk
          </div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">What stock would you like to analyze?</h2>
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
        <div className="research-demo-progress rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <ResearchDemoProgressLoop />
        </div>
      </div>
    </section>
  );
}

export function ResearchDemoProgressLoop({ surface = "dark" }: { surface?: "dark" | "light" }) {
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

  const isLight = surface === "light";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={cn("text-xs font-semibold uppercase tracking-widest", isLight ? "text-slate-400" : "text-white/35")}>Workflow</p>
      </div>
      <div className={cn("h-1.5 overflow-hidden rounded-full", isLight ? "bg-slate-200" : "bg-white/[0.06]")}>
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
                isLight
                  ? running
                    ? "bg-indigo-primary/12 text-slate-950"
                    : completed
                      ? "text-slate-500"
                      : "text-slate-300"
                  : running
                    ? "bg-indigo-primary/14 text-white"
                    : completed
                      ? "text-white/38"
                      : "text-white/28"
              )}
            >
              {running ? (
                <CircleDotDashed className={cn("size-4 animate-spin", isLight ? "text-indigo-primary" : "text-indigo-200")} />
              ) : completed ? (
                <CheckCircle2 className="size-4 text-emerald-300" />
              ) : (
                <Circle className="size-4" />
              )}
              <span className="text-sm font-medium">{step}</span>
              {running && <span className={cn("ml-auto text-[10px] uppercase tracking-wider", isLight ? "text-indigo-primary" : "text-indigo-100/70")}>processing</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FinalDecisionCard({ run }: { run: EquityResearchRun }) {
  const tone = finalRecommendationTone(run);
  const isTrading = run.report_type === "trading";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">
            {isTrading ? "Trade Stance" : "Final Investment View"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-xl px-3 py-1.5 text-lg font-bold", tone.className)}>{tone.label}</span>
            <span className="rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm font-semibold text-white/70">
              {Math.round(run.confidence * 100)}% confidence
            </span>
            <span className="rounded-xl border border-indigo-primary/20 bg-indigo-primary/10 px-3 py-1.5 text-sm font-semibold text-indigo-100">
              {reportTypeLabel(run.report_type)}
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
        <DecisionFact icon={<BarChart3 className="size-4" />} label={isTrading ? "Setup upside" : "Main upside"} value={run.main_upside ?? "Pending research output."} />
        <DecisionFact icon={<AlertTriangle className="size-4" />} label={isTrading ? "Invalidation risk" : "Main risk"} value={run.main_risk ?? "Pending risk review."} />
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
  run,
  reports,
  status,
  events = [],
  selectedAgent,
  onSelectAgent,
  compact = false,
}: {
  run?: EquityResearchRun;
  reports: EquityResearchReport[];
  status: ResearchRunStatus;
  events?: EquityResearchEvent[];
  selectedAgent?: string;
  onSelectAgent?: (agentKey: string) => void;
  compact?: boolean;
}) {
  const reportByAgent = useMemo(() => new Map(reports.map((report) => [report.agent_key, report])), [reports]);
  const statusByAgent = useMemo(() => {
    const statuses = new Map<string, string>();
    for (const event of events) {
      if (!event.agent_key) continue;
      const label = event.label.toLowerCase();
      if (event.event_type === "error") statuses.set(event.agent_key, "failed");
      else if (label.includes("skipped")) statuses.set(event.agent_key, "skipped");
      else if (event.event_type === "report" || event.event_type === "final") statuses.set(event.agent_key, "completed");
      else if (event.event_type === "reasoning" || label.includes("started")) statuses.set(event.agent_key, "running");
    }
    return statuses;
  }, [events]);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(AGENT_GROUPS.map((group) => group.title)));
  const runningAgentKey = useMemo(() => {
    if (status !== "running") return null;
    const visibleRunning = [...statusByAgent.entries()].find(([, agentStatus]) => agentStatus === "running");
    if (visibleRunning) return visibleRunning[0];
    for (const group of AGENT_GROUPS) {
      const pending = group.agents.find(([key]) => !reportByAgent.has(key));
      if (pending) return pending[0];
    }
    return null;
  }, [reportByAgent, status, statusByAgent]);

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {AGENT_GROUPS.map((group) => {
        const expanded = expandedGroups.has(group.title);
        return (
          <div key={group.title}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setExpandedGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group.title)) next.delete(group.title);
                  else next.add(group.title);
                  return next;
                });
              }}
              className="mb-2 flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-widest text-indigo-primary transition-colors hover:bg-white/[0.04] hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/40"
            >
              <span>{group.title}</span>
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            {expanded && (
              <div className="space-y-1">
                {group.agents.map(([key, name]) => {
                  const report = reportByAgent.get(key);
                  let agentStatus = statusByAgent.get(key) ?? report?.status ?? "pending";
                  if (!report && runningAgentKey === key) {
                    agentStatus = "running";
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
                      {report && <span className="text-[10px] text-white/30">{reportFileLabel(report, run)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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

function useSequentialEvents(events: EquityResearchEvent[]) {
  const [visibleEvents, setVisibleEvents] = useState<EquityResearchEvent[]>([]);

  useEffect(() => {
    setVisibleEvents((current) => {
      const currentIds = current.map((event) => event.event_id).join("|");
      const nextPrefixIds = events.slice(0, current.length).map((event) => event.event_id).join("|");
      return currentIds === nextPrefixIds ? current : [];
    });
  }, [events]);

  useEffect(() => {
    if (visibleEvents.length >= events.length) return;
    const timer = window.setTimeout(() => {
      setVisibleEvents(events.slice(0, visibleEvents.length + 1));
    }, visibleEvents.length === 0 ? 80 : 520);
    return () => window.clearTimeout(timer);
  }, [events, visibleEvents.length]);

  return visibleEvents;
}

function visibleReportKeys(events: EquityResearchEvent[]) {
  const keys = new Set<string>();
  for (const event of events) {
    if (!event.agent_key) continue;
    const label = event.label.toLowerCase();
    if (event.event_type === "report" || event.event_type === "final" || label.includes("skipped")) {
      keys.add(event.agent_key);
    }
  }
  return keys;
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
          <p className="mt-2 text-sm font-semibold text-indigo-primary">{event.label}</p>
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
      <ConfigRow label="Report Type" value={reportTypeLabel(run.report_type)} locked={isGuest && run.report_type === "investment"} lockText="Sign up for Trader to unlock trading reports." />
      <ConfigRow label="Research Depth" value={run.research_depth} locked={isGuest && run.research_depth === "shallow"} lockText="Sign up to unlock medium and deep research." />
      <ConfigRow label="Quick Thinking" value={run.quick_model} locked={isGuest} lockText="Sign up to choose Quick Thinking models." />
      <ConfigRow label="Deep Thinking" value={run.deep_model} locked={isGuest} lockText="Sign up to choose Deep Thinking models." />
      <ConfigRow label="Analyst Team" value={run.selected_analysts.join(", ")} locked={isGuest} lockText="Sign up to customize analyst team." />
      {isGuest && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs leading-5 text-white/42">
          Public runs use fixed configuration. Sign in to configure future research runs before generation.
        </p>
      )}
    </div>
  );
}

function ConfigRow({ label, value, locked, lockText }: { label: string; value: string; locked?: boolean; lockText?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-primary">{label}</p>
        {locked && <Lock className="size-3.5 text-amber-warning" />}
      </div>
      <p className="mt-1 text-sm font-semibold capitalize text-white/72">{value}</p>
      {locked && <p className="mt-1 text-xs text-white/36">{lockText}</p>}
    </div>
  );
}

export function ReportFileList({
  run,
  reports,
  selectedAgent,
  onSelectAgent,
}: {
  run?: EquityResearchRun;
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
          <span className="flex items-center gap-1.5 font-semibold"><FileText className="size-3.5" />{reportFileLabel(report, run)}</span>
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
  const visibleEvents = useSequentialEvents(events);
  const visibleKeys = useMemo(() => visibleReportKeys(visibleEvents), [visibleEvents]);
  const visibleReports = useMemo(
    () => detail?.reports.filter((report) => visibleKeys.has(report.agent_key)) ?? [],
    [detail?.reports, visibleKeys]
  );

  useEffect(() => {
    let cancelled = false;
    let eventCursor = 0;
    const load = async () => {
      try {
        const next = await api.equityResearchRun(runId);
        if (cancelled) return;
        setDetail(next);
        setEvents((current) => mergeEvents(current, next.latest_events));
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
  }, [runId]);

  useEffect(() => {
    if (selectedAgent && visibleReports.some((report) => report.agent_key === selectedAgent)) return;
    if (visibleReports.length > 0) setSelectedAgent(visibleReports[visibleReports.length - 1].agent_key);
  }, [selectedAgent, visibleReports]);

  if (error) return <div className="rounded-2xl border border-red-negative/30 bg-red-negative/10 p-5 text-red-negative">{error}</div>;
  if (!detail) return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-8 text-white/45">Loading Quanfora 2.1 workspace...</div>;

  const selectedReport = visibleReports.find((report) => report.agent_key === selectedAgent) ?? visibleReports.find((report) => report.agent_key === "pm") ?? visibleReports[0];
  const hasFinalDecision = visibleReports.some((report) => report.agent_key === "pm");

  return (
    <div className="grid min-h-[calc(100vh-5rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <AgentProgressSidebar run={detail.run} reports={visibleReports} events={visibleEvents} status={detail.run.status} selectedAgent={selectedAgent ?? undefined} onSelectAgent={setSelectedAgent} />
      </aside>
      <main className="min-w-0 space-y-4">
        <FinalDecisionCard run={detail.run} />
        <ReportFileList run={detail.run} reports={visibleReports} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
        <article className="min-h-[30rem] rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          {selectedReport ? (
            <>
              <Markdown content={selectedReport.markdown} />
              {selectedReport.agent_key === "pm" && detail.run.status === "completed" && (
                <FinalDecisionDownloadGate detail={detail} />
              )}
            </>
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
            <h3 className="text-sm font-semibold text-indigo-primary">Configuration</h3>
            {detail.run.share_slug ? (
              <Link href={`/r/${detail.run.share_slug}`} className="text-xs text-indigo-200 hover:text-white">Shared</Link>
            ) : <ShareButton run={detail.run} />}
          </div>
          <AnalysisConfigPanel run={detail.run} />
          {detail.run.status === "completed" && hasFinalDecision && (
            <button
              type="button"
              onClick={() => setSelectedAgent("pm")}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-indigo-primary/25 bg-indigo-primary/10 px-3 py-2 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-primary/16 hover:text-white"
            >
              <Download className="size-3.5" /> Download in Final Decision
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <h3 className="mb-3 text-sm font-semibold text-indigo-primary">Messages & Tools</h3>
          <MessagesToolsFeed events={visibleEvents} />
        </div>
      </aside>
    </div>
  );
}

function FinalDecisionDownloadGate({ detail }: { detail: EquityResearchRunDetail }) {
  const { user } = useAuth();
  const disabled = detail.reports.length === 0;
  const next = `/research/${detail.run.run_id}?from=${detail.run.source_surface}`;

  if (user.is_guest) {
    return (
      <div className="mt-6 rounded-2xl border border-indigo-primary/20 bg-indigo-primary/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-primary">Download available after sign in</p>
            <p className="mt-1 text-xs leading-5 text-white/48">
              Create or sign in to an account to download this completed analysis.
            </p>
          </div>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-indigo-primary/30 bg-indigo-primary/16 px-4 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-primary/24 hover:text-white"
          >
            <Lock className="size-3.5" /> Sign in to download
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-indigo-primary/20 bg-indigo-primary/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-primary">Final report is ready</p>
          <p className="mt-1 text-xs leading-5 text-white/48">
            Download the full markdown package with the final decision and all agent reports.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => downloadResearchMarkdown(detail)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-indigo-primary/30 bg-indigo-primary/16 px-4 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-primary/24 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download className="size-3.5" /> Download Analysis
        </button>
      </div>
    </div>
  );
}

function downloadResearchMarkdown(detail: EquityResearchRunDetail) {
  const run = detail.run;
  const orderedReports = [...detail.reports].sort((a, b) => {
    const aIndex = AGENT_ORDER.indexOf(a.agent_key);
    const bIndex = AGENT_ORDER.indexOf(b.agent_key);
    return aIndex - bIndex;
  });
  const content = [
    `# Quanfora 2.1 ${reportTypeLabel(run.report_type)}: ${run.ticker}`,
    "",
    `- Company: ${run.company_name ?? "Unknown"}`,
    `- Exchange: ${run.exchange ?? "Unknown"}`,
    `- Analysis date: ${run.analysis_date}`,
    `- Report type: ${reportTypeLabel(run.report_type)}`,
    `- Final label: ${finalRecommendationTone(run).label}`,
    `- Confidence: ${Math.round(run.confidence * 100)}%`,
    `- Research depth: ${run.research_depth}`,
    "",
    run.final_summary ? `## Final Summary\n\n${run.final_summary}\n` : "",
    "## Agent Reports",
    "",
    ...orderedReports.flatMap((report) => [
      `### ${reportFileLabel(report, run)}`,
      "",
      report.markdown,
      "",
    ]),
    "## Disclaimer",
    "",
    run.disclaimer,
    "",
  ].filter(Boolean).join("\n");

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${run.ticker.toLowerCase()}-quanfora-2.1-${run.report_type}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ShareButton({ run }: { run: EquityResearchRun }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  if (user.is_guest) {
    const next = `/research/${run.run_id}?from=${run.source_surface}`;
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="inline-flex items-center gap-1 text-xs text-indigo-200 hover:text-white">
        <Lock className="size-3" /> Sign in to share
      </Link>
    );
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

export function ResearchRunCompactResult({
  run,
  from,
  showOpenLink = true,
}: {
  run: EquityResearchRun;
  from?: ResearchSourceSurface;
  showOpenLink?: boolean;
}) {
  const tone = finalRecommendationTone(run);
  const fullReportHref = from ? `/research/${run.run_id}?from=${from}` : `/research/${run.run_id}`;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("rounded-lg px-2.5 py-1 text-sm font-bold", tone.className)}>{tone.label}</span>
        <span className="text-xs text-white/45">{reportTypeLabel(run.report_type)} · {Math.round(run.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-3 text-sm text-white/62">{run.final_summary ?? "Final verdict is pending."}</p>
      {showOpenLink && (
        <Link
          href={fullReportHref}
          className="on-accent accent-gradient-surface mt-4 inline-flex h-9 w-full items-center justify-center rounded-full px-3 text-sm font-semibold"
        >
          Open Full Report
        </Link>
      )}
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
