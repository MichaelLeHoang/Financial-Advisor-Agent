"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUp,
  Atom,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Menu,
  MessageSquare,
  Moon,
  Network,
  PieChart,
  Pin,
  Search,
  ShieldCheck,
  Signal,
  Sparkles,
  Sun,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { COMPARISON_TABLE, PLANS } from "@/config/plans";

type DocsView = "guide" | "reference";
type DocsTheme = "dark" | "light";

type NavItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

type NavSection = {
  title: string;
  view: DocsView;
  items: NavItem[];
};

const SETTINGS_STORAGE_KEY = "financial-advisor.settings";

function themeFromAppTheme(themeName: unknown): DocsTheme {
  return themeName === "White" ? "light" : "dark";
}

function getStoredDocsTheme(): DocsTheme {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return "dark";
    const parsed = JSON.parse(stored) as { theme?: unknown };
    return themeFromAppTheme(parsed.theme);
  } catch {
    return "dark";
  }
}

function updateStoredAppTheme(theme: DocsTheme) {
  const nextThemeName = theme === "light" ? "White" : "Deep Space";
  let nextSettings: Record<string, unknown> = { theme: nextThemeName };

  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) nextSettings = { ...JSON.parse(stored), theme: nextThemeName };
  } catch {
    nextSettings = { theme: nextThemeName };
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent("financial-advisor:theme-change", { detail: nextThemeName }));
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Start Here",
    view: "guide",
    items: [
      { id: "overview", label: "Overview", icon: <BookOpen className="size-4" /> },
      { id: "workspace-map", label: "Workspace Map", icon: <Network className="size-4" /> },
      { id: "core-workflows", label: "Core Workflows", icon: <Activity className="size-4" /> },
    ],
  },
  {
    title: "Workspace Screens",
    view: "guide",
    items: [
      { id: "dashboard-guide", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
      { id: "advisor-guide", label: "AI Advisor", icon: <MessageSquare className="size-4" /> },
      { id: "market-guide", label: "Market", icon: <TrendingUp className="size-4" /> },
      { id: "sentiment-guide", label: "Sentiment", icon: <Brain className="size-4" /> },
      { id: "watchlist-guide", label: "Watchlist", icon: <Pin className="size-4" /> },
      { id: "portfolio-guide", label: "Portfolio", icon: <PieChart className="size-4" /> },
      { id: "risk-guide", label: "Risk", icon: <ShieldCheck className="size-4" /> },
    ],
  },
  {
    title: "Advanced Tools",
    view: "guide",
    items: [
      { id: "backtest-guide", label: "Backtest Lab", icon: <FlaskConical className="size-4" /> },
      { id: "journal-guide", label: "Journal", icon: <BookMarked className="size-4" /> },
      { id: "quantum-guide", label: "Quantum", icon: <Atom className="size-4" /> },
      { id: "validation-guide", label: "Validation", icon: <BarChart3 className="size-4" /> },
      { id: "signals-guide", label: "Signals", icon: <Signal className="size-4" /> },
      { id: "research-guide", label: "Research Reports", icon: <BookMarked className="size-4" /> },
      { id: "export-guide", label: "Export", icon: <Download className="size-4" /> },
      { id: "plans-guide", label: "Plans & Access", icon: <Wallet className="size-4" /> },
    ],
  },
  {
    title: "Technical Reference",
    view: "reference",
    items: [
      { id: "architecture", label: "Architecture", icon: <Network className="size-4" /> },
      { id: "agent-modes", label: "Agent Modes", icon: <Brain className="size-4" /> },
      { id: "consensus", label: "Consensus Engine", icon: <Sparkles className="size-4" /> },
      { id: "api-chat", label: "Chat Endpoint", icon: <Code2 className="size-4" /> },
      { id: "api-research", label: "Equity Research", icon: <BookMarked className="size-4" /> },
      { id: "api-market", label: "Market Data", icon: <TrendingUp className="size-4" /> },
      { id: "api-portfolio", label: "Portfolio APIs", icon: <PieChart className="size-4" /> },
      { id: "api-backtest", label: "Backtesting API", icon: <FlaskConical className="size-4" /> },
      { id: "rate-limits", label: "Rate Limits", icon: <ShieldCheck className="size-4" /> },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.title, view: section.view }))
);

const WORKSPACE_GROUPS = [
  {
    title: "Research",
    tone: "indigo",
    items: ["Market", "Sentiment", "AI Advisor", "Research reports"],
  },
  {
    title: "Decision",
    tone: "cyan",
    items: ["Dashboard", "Watchlist", "Portfolio", "Saved sessions"],
  },
  {
    title: "Risk",
    tone: "emerald",
    items: ["Risk dashboard", "Concentration", "Correlation", "Drawdown"],
  },
  {
    title: "Discipline",
    tone: "amber",
    items: ["Backtests", "Journal", "Alerts", "Signals"],
  },
  {
    title: "Quant",
    tone: "rose",
    items: ["Quantum", "Strategy Compare", "Validation", "Export"],
  },
];

const FLOW_GROUPS = [
  {
    title: "Research a ticker",
    description: "Start here when a symbol looks interesting and you need enough evidence to decide whether it deserves more work.",
    steps: ["Market", "Sentiment", "AI Advisor", "Watchlist"],
  },
  {
    title: "Review a portfolio",
    description: "Use this path when positions already exist and the real question is allocation, exposure, downside, or follow-through.",
    steps: ["Portfolio", "Risk", "AI Advisor", "Journal"],
  },
  {
    title: "Test a strategy",
    description: "Use this before treating a rule as repeatable. Simulate it, compare it, and validate the assumptions before monitoring signals.",
    steps: ["Backtest Lab", "Strategy Compare", "Validation", "Signals"],
  },
  {
    title: "Create a research report",
    description: "Use this when a ticker needs a durable analyst-style writeup with evidence, events, and a shareable report.",
    steps: ["Research", "Analyst reports", "Share link", "Journal"],
  },
];

function CodeBlock({ code, language = "json", title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-lg border border-white/[0.08] bg-[var(--docs-code-bg)]">
      {title ? (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
          <span className="text-xs font-medium text-white/55">{title}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/25">{language}</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-white/68">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white/35 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white/75 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function Callout({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warn" | "tip";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: "border-indigo-400/35 bg-indigo-500/[0.07] text-indigo-200",
    warn: "border-amber-400/35 bg-amber-500/[0.08] text-amber-200",
    tip: "border-emerald-400/35 bg-emerald-500/[0.07] text-emerald-200",
  };
  const labels = { info: "Note", warn: "Important", tip: "Tip" };

  return (
    <div className={`my-5 rounded-lg border-l-4 p-4 text-sm leading-6 ${styles[type]}`}>
      <strong className="mb-1 block text-xs font-semibold uppercase tracking-wider">{title ?? labels[type]}</strong>
      <div className="text-white/72">{children}</div>
    </div>
  );
}

function DocTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.035]">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/45">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/[0.05] last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top leading-6 text-white/66">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs font-medium text-white/58">
      {children}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">{eyebrow}</div> : null}
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-white/62">{children}</div>
    </div>
  );
}

function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="my-5 space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3 text-sm leading-6 text-white/62">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/12 font-mono text-xs text-indigo-300">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ScreenAnatomy({
  title,
  description,
  regions,
}: {
  title: string;
  description: string;
  regions: { label: string; detail: string; icon: ReactNode }[];
}) {
  return (
    <div className="my-6 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white/88">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-white/50">{description}</p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-white/28">Screen anatomy</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {regions.map((region, index) => (
          <div key={region.label} className="rounded-lg border border-white/[0.07] bg-[var(--docs-panel-strong)] p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-indigo-500/12 text-indigo-300">
                {region.icon}
              </span>
              <span className="font-mono text-xs text-white/28">0{index + 1}</span>
            </div>
            <div className="text-sm font-semibold text-white/82">{region.label}</div>
            <p className="mt-2 text-sm leading-6 text-white/50">{region.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceMap() {
  return (
    <div className="my-6 grid gap-3 lg:grid-cols-5">
      {WORKSPACE_GROUPS.map((group) => (
        <div key={group.title} className="docs-map-card rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
          <div className={`docs-tone-bar mb-4 h-2 w-16 rounded-full ${toneClass(group.tone)}`} />
          <h3 className="text-sm font-semibold text-white/84">{group.title}</h3>
          <div className="mt-4 space-y-2">
            {group.items.map((item) => (
              <div key={item} className="docs-map-item rounded-md border border-white/[0.06] bg-[var(--docs-panel-strong)] px-3 py-2 text-xs text-white/55">
                {item}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-400",
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
  };
  return tones[tone] ?? "bg-indigo-400";
}

function WorkflowDiagram({ title, description, steps }: { title: string; description: string; steps: string[] }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
      <h3 className="text-sm font-semibold text-white/86">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-white/[0.08] bg-[var(--docs-panel-strong)] px-3 text-center text-xs font-semibold text-white/70">
              {step}
            </div>
            {index < steps.length - 1 ? <ChevronRight className="hidden size-4 shrink-0 text-white/22 sm:block" /> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function PlanAccessMatrix() {
  const visibleRows = COMPARISON_TABLE.filter((row) =>
    [
      "AI market research",
      "Watchlists",
      "Portfolios",
      "Classical optimization",
      "Risk dashboard",
      "Backtesting",
      "Trade journal",
      "Quantum optimization",
      "Strategy comparison",
      "Monte Carlo validation",
      "Export center",
      "Premium LLM routing",
      "Paper trading",
    ].includes(row.feature)
  );

  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.035]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/45">Feature</th>
            {PLANS.map((plan) => (
              <th key={plan.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/45">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.feature} className="border-b border-white/[0.05] last:border-0">
              <td className="px-4 py-3 font-medium text-white/76">{row.feature}</td>
              <td className="px-4 py-3 text-white/62">{formatAccess(row.free)}</td>
              <td className="px-4 py-3 text-white/62">{formatAccess(row.pro)}</td>
              <td className="px-4 py-3 text-white/62">{formatAccess(row.trader)}</td>
              <td className="px-4 py-3 text-white/62">{formatAccess(row.quant)}</td>
              <td className="px-4 py-3 text-white/62">{formatAccess(row.execution)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAccess(value: boolean | string) {
  if (value === true) return <span className="text-emerald-300">Included</span>;
  if (value === false) return <span className="text-white/24">-</span>;
  return value;
}

function DocsSearchModal({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (sectionId: string, view: DocsView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter((item) =>
      [item.label, item.section, item.view].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close search"
        className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed left-1/2 top-[12vh] z-[110] w-[min(94vw,560px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--docs-modal-bg)] shadow-[0_36px_120px_-48px_rgba(0,0,0,0.9)]">
        <button
          type="button"
          aria-label="Close search"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/75"
        >
          <X className="size-4" />
        </button>
        <div className="border-b border-white/[0.06] px-5 py-5">
          <div className="flex items-center gap-3">
            <Search className="size-5 shrink-0 text-white/30" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documentation..."
              className="w-full bg-transparent pr-8 text-lg text-white outline-none placeholder:text-white/28"
            />
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-4 py-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/35">No matching sections found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => (
                <button
                  type="button"
                  key={`${item.view}-${item.id}`}
                  onClick={() => {
                    onOpenChange(false);
                    onNavigate(item.id, item.view);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.045] text-white/42">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white/80">{item.label}</span>
                    <span className="block truncate text-xs text-white/32">{item.section}</span>
                  </span>
                  <span className="rounded-md bg-white/[0.045] px-2 py-1 text-[10px] uppercase tracking-wider text-white/32">
                    {item.view}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DocsPage() {
  const [activeView, setActiveView] = useState<DocsView>("guide");
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<DocsTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return getStoredDocsTheme();
  });

  const visibleSections = NAV_SECTIONS.filter((section) => section.view === activeView);
  const docsThemeStyle = {
    "--docs-bg": theme === "light" ? "#f7f5f2" : "oklch(15% 0.018 265)",
    "--docs-text": theme === "light" ? "#121a2c" : "oklch(96% 0.006 265)",
    "--docs-text-secondary": theme === "light" ? "#344054" : "oklch(84% 0.01 265)",
    "--docs-text-muted": theme === "light" ? "#667085" : "oklch(70% 0.012 265)",
    "--docs-text-subtle": theme === "light" ? "#98a2b3" : "oklch(55% 0.012 265)",
    "--docs-text-faint": theme === "light" ? "#b6bdc9" : "oklch(42% 0.012 265)",
    "--docs-header": theme === "light" ? "rgba(247,245,242,0.88)" : "oklch(15% 0.018 265 / 0.92)",
    "--docs-sidebar": theme === "light" ? "#fbfaf8" : "oklch(15% 0.018 265)",
    "--docs-border": theme === "light" ? "#e3e1dc" : "oklch(100% 0.006 265 / 0.08)",
    "--docs-border-soft": theme === "light" ? "#ebe8e1" : "oklch(100% 0.006 265 / 0.06)",
    "--docs-control": theme === "light" ? "#fbfaf8" : "oklch(100% 0.006 265 / 0.035)",
    "--docs-control-hover": theme === "light" ? "#f2f0ec" : "oklch(100% 0.006 265 / 0.06)",
    "--docs-control-active": theme === "light" ? "#eeedff" : "oklch(100% 0.006 265 / 0.1)",
    "--docs-control-active-text": theme === "light" ? "#3730a3" : "oklch(87% 0.06 268)",
    "--docs-panel": theme === "light" ? "#fbfaf8" : "oklch(100% 0.006 265 / 0.025)",
    "--docs-panel-strong": theme === "light" ? "#f2f0ec" : "oklch(20% 0.02 265)",
    "--docs-code-bg": theme === "light" ? "#f2f0ec" : "oklch(13% 0.018 265)",
    "--docs-modal-bg": theme === "light" ? "#fbfaf8" : "oklch(14% 0.018 265)",
    "--docs-accent": theme === "light" ? "#4f46e5" : "oklch(78% 0.11 268)",
    "--docs-accent-hover": theme === "light" ? "#4338ca" : "oklch(84% 0.1 268)",
    "--docs-accent-soft": theme === "light" ? "#eeedff" : "oklch(56% 0.16 268 / 0.14)",
    "--docs-info": theme === "light" ? "#0369a1" : "oklch(80% 0.1 225)",
    "--docs-info-soft": theme === "light" ? "#e0f2fe" : "oklch(58% 0.12 225 / 0.14)",
    "--docs-success": theme === "light" ? "#047857" : "oklch(78% 0.13 154)",
    "--docs-success-soft": theme === "light" ? "#dcfce7" : "oklch(64% 0.13 154 / 0.14)",
    "--docs-warning": theme === "light" ? "#b45309" : "oklch(82% 0.13 76)",
    "--docs-warning-soft": theme === "light" ? "#fef3c7" : "oklch(70% 0.13 76 / 0.14)",
    "--docs-rose": theme === "light" ? "#be123c" : "oklch(79% 0.12 18)",
    "--docs-rose-soft": theme === "light" ? "#ffe4e6" : "oklch(65% 0.13 18 / 0.14)",
    "--docs-shadow": theme === "light" ? "0 14px 34px rgba(18,26,44,0.08)" : "none",
  } as React.CSSProperties;

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const item = ALL_NAV_ITEMS.find((candidate) => candidate.id === hash);
    if (!item) return;
    setActiveView(item.view);
    window.setTimeout(() => scrollToSection(item.id, item.view, false), 80);
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextTheme = themeFromAppTheme((event as CustomEvent<string>).detail);
      setTheme(nextTheme);
    };

    window.addEventListener("financial-advisor:theme-change", handleThemeChange);
    return () => window.removeEventListener("financial-advisor:theme-change", handleThemeChange);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-90px 0px -62% 0px", threshold: 0.08 }
    );
    const sections = document.querySelectorAll("[data-doc-section]");
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [activeView]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    updateStoredAppTheme(next);
    setTheme(next);
  };

  const scrollToSection = (id: string, view = activeView, updateHash = true) => {
    if (view !== activeView) setActiveView(view);
    window.setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      setMobileNavOpen(false);
      if (updateHash) window.history.replaceState(null, "", `#${id}`);
    }, view === activeView ? 0 : 70);
  };

  return (
    <div
      data-docs-theme={theme}
      style={docsThemeStyle}
      className="relative min-h-screen bg-[var(--docs-bg)] text-[var(--docs-text)] selection:bg-indigo-500/30"
    >
      <style>{`
        [data-docs-theme="light"] {
          color-scheme: light;
        }

        [data-docs-theme="light"] [class~="text-white"] {
          color: var(--docs-text) !important;
        }

        [data-docs-theme="light"] .docs-logo-icon {
          color: oklch(98% 0.01 265) !important;
        }

        [data-docs-theme="light"] .docs-map-card {
          background: var(--docs-panel) !important;
          border-color: var(--docs-border) !important;
          box-shadow: var(--docs-shadow);
        }

        [data-docs-theme="light"] .docs-map-item {
          background: var(--docs-control-hover) !important;
          border-color: #d8d5ce !important;
          color: var(--docs-text-muted) !important;
        }

        [data-docs-theme="light"] .docs-tone-bar.bg-indigo-400 {
          background: #4f46e5 !important;
        }

        [data-docs-theme="light"] .docs-tone-bar.bg-cyan-400 {
          background: #0891b2 !important;
        }

        [data-docs-theme="light"] .docs-tone-bar.bg-emerald-400 {
          background: #047857 !important;
        }

        [data-docs-theme="light"] .docs-tone-bar.bg-amber-400 {
          background: #b45309 !important;
        }

        [data-docs-theme="light"] .docs-tone-bar.bg-rose-400 {
          background: #be123c !important;
        }

        [data-docs-theme="light"] a:hover,
        [data-docs-theme="light"] button:hover {
          border-color: var(--docs-border) !important;
        }

        [data-docs-theme="light"] button:hover:not(:disabled) {
          background-color: var(--docs-control-hover);
        }

        [data-docs-theme="light"] [aria-pressed="true"],
        [data-docs-theme="light"] [data-active="true"] {
          background-color: var(--docs-control-active) !important;
          color: var(--docs-control-active-text) !important;
        }

        [data-docs-theme="light"] [class~="text-white/95"],
        [data-docs-theme="light"] [class~="text-white/90"],
        [data-docs-theme="light"] [class~="text-white/88"],
        [data-docs-theme="light"] [class~="text-white/86"],
        [data-docs-theme="light"] [class~="text-white/84"],
        [data-docs-theme="light"] [class~="text-white/82"],
        [data-docs-theme="light"] [class~="text-white/80"],
        [data-docs-theme="light"] [class~="text-white/78"],
        [data-docs-theme="light"] [class~="text-white/76"],
        [data-docs-theme="light"] [class~="text-white/75"],
        [data-docs-theme="light"] [class~="text-white/72"],
        [data-docs-theme="light"] [class~="text-white/70"] {
          color: var(--docs-text-secondary) !important;
        }

        [data-docs-theme="light"] [class~="text-white/68"],
        [data-docs-theme="light"] [class~="text-white/66"],
        [data-docs-theme="light"] [class~="text-white/62"],
        [data-docs-theme="light"] [class~="text-white/60"],
        [data-docs-theme="light"] [class~="text-white/58"],
        [data-docs-theme="light"] [class~="text-white/55"],
        [data-docs-theme="light"] [class~="text-white/50"],
        [data-docs-theme="light"] [class~="text-white/48"],
        [data-docs-theme="light"] [class~="text-white/46"],
        [data-docs-theme="light"] [class~="text-white/45"],
        [data-docs-theme="light"] [class~="text-white/42"],
        [data-docs-theme="light"] [class~="text-white/40"] {
          color: var(--docs-text-muted) !important;
        }

        [data-docs-theme="light"] [class~="text-white/38"],
        [data-docs-theme="light"] [class~="text-white/35"],
        [data-docs-theme="light"] [class~="text-white/34"],
        [data-docs-theme="light"] [class~="text-white/32"],
        [data-docs-theme="light"] [class~="text-white/30"],
        [data-docs-theme="light"] [class~="text-white/28"],
        [data-docs-theme="light"] [class~="text-white/25"],
        [data-docs-theme="light"] [class~="text-white/24"],
        [data-docs-theme="light"] [class~="text-white/22"],
        [data-docs-theme="light"] [class~="text-white/20"] {
          color: var(--docs-text-subtle) !important;
        }

        [data-docs-theme="light"] [class*="border-white"] {
          border-color: var(--docs-border-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-white/[0.025]"],
        [data-docs-theme="light"] [class~="bg-white/[0.035]"],
        [data-docs-theme="light"] [class~="bg-white/[0.04]"],
        [data-docs-theme="light"] [class~="bg-white/[0.045]"] {
          background-color: var(--docs-panel) !important;
        }

        [data-docs-theme="light"] [class~="bg-white/[0.1]"],
        [data-docs-theme="light"] [class~="bg-white/10"] {
          background-color: var(--docs-control-active) !important;
        }

        [data-docs-theme="light"] [class~="placeholder:text-white/28"]::placeholder {
          color: var(--docs-text-faint) !important;
        }

        [data-docs-theme="light"] [class*="text-indigo-"] {
          color: var(--docs-accent) !important;
        }

        [data-docs-theme="light"] [class*="text-cyan-"] {
          color: var(--docs-info) !important;
        }

        [data-docs-theme="light"] [class*="text-emerald-"] {
          color: var(--docs-success) !important;
        }

        [data-docs-theme="light"] [class*="text-amber-"] {
          color: var(--docs-warning) !important;
        }

        [data-docs-theme="light"] [class*="text-rose-"],
        [data-docs-theme="light"] [class*="text-red-"] {
          color: var(--docs-rose) !important;
        }

        [data-docs-theme="light"] [class~="bg-indigo-500/12"],
        [data-docs-theme="light"] [class~="bg-indigo-500/[0.07]"],
        [data-docs-theme="light"] [class~="bg-indigo-500/[0.06]"] {
          background-color: var(--docs-accent-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-cyan-500/[0.07]"],
        [data-docs-theme="light"] [class~="bg-cyan-500/[0.06]"] {
          background-color: var(--docs-info-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-emerald-500/[0.07]"],
        [data-docs-theme="light"] [class~="bg-emerald-500/[0.06]"] {
          background-color: var(--docs-success-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-amber-500/[0.08]"],
        [data-docs-theme="light"] [class~="bg-amber-500/[0.07]"],
        [data-docs-theme="light"] [class~="bg-amber-500/[0.06]"] {
          background-color: var(--docs-warning-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-rose-500/[0.07]"],
        [data-docs-theme="light"] [class~="bg-red-500/[0.07]"] {
          background-color: var(--docs-rose-soft) !important;
        }

        [data-docs-theme="light"] [class~="bg-indigo-400"] {
          background-color: var(--docs-accent) !important;
        }

        [data-docs-theme="light"] [class~="bg-cyan-400"] {
          background-color: var(--docs-info) !important;
        }

        [data-docs-theme="light"] [class~="bg-emerald-400"] {
          background-color: var(--docs-success) !important;
        }

        [data-docs-theme="light"] [class~="bg-amber-400"] {
          background-color: var(--docs-warning) !important;
        }

        [data-docs-theme="light"] [class~="bg-rose-400"] {
          background-color: var(--docs-rose) !important;
        }

        [data-docs-theme="light"] [class*="border-indigo-"] {
          border-color: var(--docs-accent) !important;
        }

        [data-docs-theme="light"] [class*="border-cyan-"] {
          border-color: var(--docs-info) !important;
        }

        [data-docs-theme="light"] [class*="border-emerald-"] {
          border-color: var(--docs-success) !important;
        }

        [data-docs-theme="light"] [class*="border-amber-"] {
          border-color: var(--docs-warning) !important;
        }
      `}</style>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--docs-border)] bg-[var(--docs-header)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="docs-logo-mark flex size-7 items-center justify-center rounded-lg border border-[var(--docs-border)] bg-[var(--docs-control)] shadow-[var(--docs-shadow)]">
              <img src="/logo.svg" alt="" className="size-5 object-contain" />
            </span>
            <span className="text-sm font-semibold text-[var(--docs-text)]">Documentation</span>
          </Link>

          <div className="hidden rounded-full border border-[var(--docs-border)] bg-[var(--docs-control)] p-1 sm:flex">
            {(["guide", "reference"] as DocsView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setActiveView(view);
                  setActiveSection(view === "guide" ? "overview" : "architecture");
                  window.history.replaceState(null, "", view === "guide" ? "#overview" : "#architecture");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeView === view
                    ? "bg-[var(--docs-control-active)] text-[var(--docs-control-active-text)]"
                    : "text-[var(--docs-text-muted)] hover:bg-[var(--docs-control-hover)] hover:text-[var(--docs-text-secondary)]"
                }`}
              >
                {view === "guide" ? "User Guide" : "Technical Reference"}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-full border border-[var(--docs-border)] bg-[var(--docs-control)] px-3 text-left text-sm text-[var(--docs-text-muted)] shadow-[var(--docs-shadow)] transition-colors hover:bg-[var(--docs-control-hover)] hover:text-[var(--docs-text-secondary)] sm:flex"
          >
            <Search className="size-4" />
            <span className="flex-1">Search docs...</span>
            <span className="rounded-full bg-[var(--docs-control-active)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--docs-control-active-text)]">Cmd + K</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-full border border-[var(--docs-border)] bg-[var(--docs-control)] text-[var(--docs-text-muted)] shadow-[var(--docs-shadow)] transition-colors hover:bg-[var(--docs-control-hover)] hover:text-[var(--docs-text-secondary)]"
            aria-label="Toggle light and dark theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <Link href="/" className="hidden text-sm text-[var(--docs-text-muted)] transition-colors hover:text-[var(--docs-text-secondary)] sm:block">
            Back
          </Link>

          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--docs-border)] bg-[var(--docs-control)] text-[var(--docs-text-muted)] sm:hidden"
            aria-label="Toggle documentation navigation"
          >
            {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside
          className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-[var(--docs-border)] bg-[var(--docs-sidebar)] px-4 pb-10 pt-5 transition-transform sm:sticky sm:translate-x-0 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-[var(--docs-border)] bg-[var(--docs-control)] p-1 shadow-[var(--docs-shadow)] sm:hidden">
            {(["guide", "reference"] as DocsView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  setActiveView(view);
                  setMobileNavOpen(false);
                }}
                className={`rounded-full px-2 py-2 text-xs font-semibold ${
                  activeView === view
                    ? "bg-[var(--docs-control-active)] text-[var(--docs-control-active-text)]"
                    : "text-[var(--docs-text-muted)]"
                }`}
              >
                {view === "guide" ? "Guide" : "Reference"}
              </button>
            ))}
          </div>

          <nav className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.title}>
                <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--docs-text-subtle)]">
                  {section.title}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(item.id, section.view)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${
                          activeSection === item.id
                            ? "bg-[var(--docs-control-active)] font-medium text-[var(--docs-control-active-text)]"
                            : "text-[var(--docs-text-muted)] hover:bg-[var(--docs-control-hover)] hover:text-[var(--docs-text-secondary)]"
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-6 pb-28 pt-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-4xl">
            {activeView === "guide" ? <UserGuide /> : <TechnicalReference />}

            <footer className="mt-20 border-t border-[var(--docs-border-soft)] pt-8 text-sm text-[var(--docs-text-subtle)]">
              <p>Quanfora Documentation</p>
              <p className="mt-1">Research support only. Not professional financial, legal, or tax advice.</p>
            </footer>
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full border border-[var(--docs-border)] bg-[var(--docs-control)] text-[var(--docs-text-muted)] shadow-[var(--docs-shadow)] backdrop-blur-sm transition-all hover:bg-[var(--docs-control-hover)] hover:text-[var(--docs-text-secondary)]"
        aria-label="Scroll to top"
      >
        <ArrowUp className="size-4" />
      </button>

      <DocsSearchModal open={searchOpen} onOpenChange={setSearchOpen} onNavigate={scrollToSection} />
    </div>
  );
}

function UserGuide() {
  return (
    <>
      <section id="overview" data-doc-section className="scroll-mt-24">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">Start Here</div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Make each research decision traceable</h1>
        <p className="mt-5 text-lg leading-8 text-white/62">
          Quanfora is a financial research workspace for turning market data, sentiment, portfolio context, and
          advisor conversations into one reviewable decision trail.
        </p>
        <p className="mt-4 text-[15px] leading-7 text-white/58">
          The practical flow is simple: get current market context, ask a focused question, check the risk, then save the
          result where it can be revisited. Use Dashboard for orientation, Market and Sentiment for evidence, AI Advisor
          for synthesis, Research Reports for durable analyst-style work, and Watchlist, Portfolio, Backtest Lab, or
          Journal for follow-through.
        </p>

        <Callout type="warn" title="Financial safety">
          The app helps with research, organization, and scenario review. It does not guarantee outcomes or replace a
          qualified financial advisor. Treat AI responses, model predictions, and backtests as decision support.
        </Callout>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <Sparkles className="mb-4 size-5 text-indigo-300" />
            <h3 className="text-sm font-semibold text-white/84">Establish context</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">Use Dashboard, Market, and Sentiment to see what changed before requesting analysis.</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <MessageSquare className="mb-4 size-5 text-cyan-300" />
            <h3 className="text-sm font-semibold text-white/84">Ask decision-grade questions</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">Include ticker, timeframe, holdings, objective, and the risk you want the advisor to test.</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
            <ShieldCheck className="mb-4 size-5 text-emerald-300" />
            <h3 className="text-sm font-semibold text-white/84">Preserve the rationale</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">Move useful conclusions into watchlists, portfolios, backtests, alerts, or journal notes.</p>
          </div>
        </div>
      </section>

      <section id="workspace-map" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader eyebrow="Navigation" title="Workspace map">
          <p>
            The left sidebar follows the shape of a research process: discover an idea, evaluate the evidence, measure
            risk, then track, test, or document the decision. Some advanced modules are plan-gated, so the visible
            workspace may vary by account.
          </p>
        </SectionHeader>
        <WorkspaceMap />
      </section>

      <section id="core-workflows" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader eyebrow="Recommended Flow" title="Core workflows">
          <p>
            Each screen can stand alone, but the product is strongest when the screens are chained together. Use these
            paths as starting points for the most common research jobs.
          </p>
        </SectionHeader>
        <div className="grid gap-4">
          {FLOW_GROUPS.map((flow) => (
            <WorkflowDiagram key={flow.title} title={flow.title} description={flow.description} steps={flow.steps} />
          ))}
        </div>
      </section>

      <section id="dashboard-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader eyebrow="Workspace Screens" title="Dashboard">
          <p>
            Dashboard is the workspace starting point. It shows account scope, key workspace counts, and action cards that
            help you resume the next useful task without hunting through every page.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Dashboard anatomy"
          description="Use this page when you are deciding where to resume work."
          regions={[
            { label: "Account scope", detail: "Shows your current plan and top-level workspace state.", icon: <Wallet className="size-4" /> },
            { label: "Metrics", detail: "Summarizes portfolio count, watchlist count, and protected account scope.", icon: <BarChart3 className="size-4" /> },
            { label: "Workflow cards", detail: "Jump into market research, portfolio review, narrative checks, or watchlist staging.", icon: <Activity className="size-4" /> },
            { label: "Next-step prompt", detail: "Highlights missing follow-through such as alerts, journal notes, or risk review.", icon: <Bell className="size-4" /> },
          ]}
        />
        <StepList
          steps={[
            <>Open <strong className="text-white/80">Market</strong> when you need broad price context or a ticker lookup.</>,
            <>Open <strong className="text-white/80">Portfolio</strong> when an idea has become a position or allocation question.</>,
            <>Open <strong className="text-white/80">Sentiment</strong> when the trade depends on recent headlines or narrative change.</>,
            <>Use <strong className="text-white/80">Watchlist</strong> as the staging area for symbols you may revisit later.</>,
          ]}
        />
      </section>

      <section id="advisor-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="AI Advisor">
          <p>
            AI Advisor is the synthesis layer. Use it after collecting market, sentiment, portfolio, or risk context so
            the answer can explain tradeoffs instead of guessing from an isolated prompt. Longer requests can be routed
            through the Redis-backed job queue so the UI remains responsive while the worker completes the analysis.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Advisor anatomy"
          description="Use this page when you need synthesis across data, risk, sentiment, and portfolio context."
          regions={[
            { label: "Prompt composer", detail: "Ask a focused question. Include tickers, timeframe, current holdings, and the decision you are considering.", icon: <MessageSquare className="size-4" /> },
            { label: "Model selector", detail: "Switch between faster research and deeper consensus-style analysis where available.", icon: <Brain className="size-4" /> },
            { label: "Suggestion cards", detail: "Start common workflows such as market pulse, sentiment brief, or portfolio review.", icon: <Sparkles className="size-4" /> },
            { label: "Session history", detail: "Return to prior research threads from the sidebar instead of restarting context.", icon: <BookOpen className="size-4" /> },
          ]}
        />
        <DocTable
          headers={["Good prompt pattern", "Example"]}
          rows={[
            ["Ticker + decision", "Should I add NVDA this week, and what risks would invalidate the thesis?"],
            ["Holdings + objective", "Review AAPL, MSFT, and GOOGL for concentration risk and lower-volatility allocation ideas."],
            ["Narrative + timeframe", "Analyze AAPL sentiment from recent headlines and explain what could move the stock next month."],
            ["Strategy + validation", "Compare a 20/50 moving average crossover against buy-and-hold for AAPL and MSFT."],
          ]}
        />
        <Callout type="tip">
          Ask for the output format you want. For example: "Give me a thesis, risks, data points to verify, and next
          action." Structured prompts make the advisor easier to audit.
        </Callout>
      </section>

      <section id="market-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Market">
          <p>
            Market is the live price and instrument research surface. Use it to confirm the symbol, inspect movement, and
            collect quote context before asking for interpretation.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Market anatomy"
          description="Use this page when you need facts before analysis."
          regions={[
            { label: "Search and add ticker", detail: "Find stocks or symbols and add them to the market board.", icon: <Search className="size-4" /> },
            { label: "Quote cards", detail: "Scan price, percent change, volume, range, and quick removal actions.", icon: <TrendingUp className="size-4" /> },
            { label: "Chart detail", detail: "Open a full chart with period and interval controls for the selected instrument.", icon: <LineChart className="size-4" /> },
            { label: "Fundamental panels", detail: "Review details, earnings, and quarterly financials where market data is available.", icon: <BarChart3 className="size-4" /> },
          ]}
        />
        <StepList
          steps={[
            <>Search for a ticker or company name in the market search input.</>,
            <>Open the chart detail to inspect recent movement and time range.</>,
            <>Review earnings and quarterly financials before forming a thesis.</>,
            <>Move the symbol to Watchlist or ask the AI Advisor for a written interpretation.</>,
          ]}
        />
      </section>

      <section id="sentiment-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Sentiment">
          <p>
            Sentiment Analysis scores financial language so you can see whether current headlines support, weaken, or
            contradict a thesis. It is most useful when paired with price action and portfolio exposure.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Use it for", "How to work with it"]}
          rows={[
            ["Single headline", "Paste one financial headline to see positive, neutral, or negative classification."],
            ["Batch review", "Enter multiple headlines when you want an aggregate mood signal."],
            ["Narrative checks", "Compare the score with price action before asking the advisor for next-step analysis."],
            ["Risk review", "Look for negative sentiment shifts that may not yet show up in portfolio metrics."],
          ]}
        />
        <Callout type="warn">
          Sentiment can change quickly and may be noisy around earnings, macro events, and rumors. Treat it as context, not
          a standalone signal.
        </Callout>
      </section>

      <section id="watchlist-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Watchlist">
          <p>
            Watchlist is the staging area for symbols that deserve attention but are not yet holdings. Use it to monitor
            market sections, upcoming earnings, chart comparisons, and deeper quote detail from one page.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Watchlist anatomy"
          description="Use this page to keep candidate ideas organized."
          regions={[
            { label: "Saved lists", detail: "Create named lists and add symbols to each list.", icon: <Pin className="size-4" /> },
            { label: "Market sections", detail: "Browse instruments across Americas, crypto, futures, and other grouped markets.", icon: <TrendingUp className="size-4" /> },
            { label: "Earnings", detail: "Check upcoming earnings events before adding a symbol to a research queue.", icon: <Bell className="size-4" /> },
            { label: "Compare assets", detail: "Compare selected instruments before escalating to portfolio or advisor analysis.", icon: <LineChart className="size-4" /> },
          ]}
        />
      </section>

      <section id="portfolio-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Portfolio">
          <p>
            Portfolio is for positions you own or want to model as real allocations. Add holdings with quantity and
            average cost, review currency-aware value and P&L, then run optimization once there are at least two symbols.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Portfolio anatomy"
          description="Use this page when a research idea becomes an allocation question."
          regions={[
            { label: "Portfolio list", detail: "Create, switch, and delete portfolios.", icon: <Wallet className="size-4" /> },
            { label: "Holdings table", detail: "Manage symbols, quantity, average cost, converted value, weight, P&L, and position-level actions.", icon: <PieChart className="size-4" /> },
            { label: "Add holding", detail: "Search for a symbol, enter quantity and average cost, then add it to the selected portfolio.", icon: <Search className="size-4" /> },
            { label: "Optimizer", detail: "Run classical or quantum optimization and review weights, return, volatility, and Sharpe ratio.", icon: <Atom className="size-4" /> },
          ]}
        />
        <DocTable
          headers={["Method", "Best for", "Output"]}
          rows={[
            ["Classical", "Precise allocation across existing holdings", "Continuous percentage weights and risk-return metrics"],
            ["Quantum", "Selecting a smaller subset from a larger candidate universe", "Chosen assets and simulated QAOA state probabilities"],
          ]}
        />
      </section>

      <section id="risk-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Risk">
          <p>
            Risk is available on Pro and higher plans. It turns an existing portfolio into downside, allocation,
            asset-class, and correlation views so concentration is visible before it becomes a surprise.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Metric", "What it helps answer"]}
          rows={[
            ["Risk score", "How concentrated or volatile the selected portfolio appears."],
            ["Total value", "Current portfolio value based on holdings and available quotes."],
            ["Volatility", "How wide the portfolio's return distribution may be over a year."],
            ["Max drawdown", "The estimated peak-to-trough downside in stressed conditions."],
            ["Correlation matrix", "Whether holdings are actually diversified or moving together."],
          ]}
        />
        <Callout type="warn">
          Historical risk metrics are backward-looking. They can understate risk when market structure changes or a new
          event has no close historical comparison.
        </Callout>
      </section>

      <section id="backtest-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader eyebrow="Advanced Tools" title="Backtest Lab">
          <p>
            Backtest Lab is available on Trader and higher plans. It tests strategy rules against historical data with
            configurable symbols, dates, capital, fees, slippage, and sizing assumptions.
          </p>
        </SectionHeader>
        <StepList
          steps={[
            <>Select a built-in strategy such as buy-and-hold, moving average crossover, or RSI mean reversion.</>,
            <>Enter symbols, start and end dates, initial capital, fees, slippage, and position size.</>,
            <>Run the backtest and review total return, max drawdown, Sharpe ratio, win rate, trade count, and fees.</>,
            <>Compare results against buy-and-hold before treating a strategy as useful.</>,
          ]}
        />
        <Callout type="warn">
          A backtest can overfit the past. Strong historical returns do not prove the strategy will work in live markets.
        </Callout>
      </section>

      <section id="journal-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Journal">
          <p>
            Journal is the discipline layer for Trader plans. Record the thesis, setup, entry, exit, outcome, and lesson
            while the reasoning is still fresh so future reviews are based on evidence, not memory.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Log this", "Why it matters"]}
          rows={[
            ["Original thesis", "Preserves the reason for entering before the result biases your memory."],
            ["Invalidation condition", "Clarifies what would prove the trade wrong."],
            ["Position size", "Shows whether risk was controlled relative to conviction."],
            ["Post-trade review", "Turns outcomes into repeatable process improvements."],
          ]}
        />
      </section>

      <section id="quantum-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Quantum">
          <p>
            Quantum optimization is available on Quant plans. It uses QAOA-style simulated quantum optimization to select
            a target number of assets from a candidate universe. Treat it as an exploratory complement to classical
            allocation rather than a standalone recommendation.
          </p>
        </SectionHeader>
        <StepList
          steps={[
            <>Add a universe of tickers that you are willing to consider.</>,
            <>Choose the number of target assets to select.</>,
            <>Run the optimizer and review the top simulated quantum states.</>,
            <>Compare the chosen subset against classical portfolio optimization before acting.</>,
          ]}
        />
      </section>

      <section id="validation-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Strategy Compare and Validation">
          <p>
            Strategy Compare and Validation are Quant tools for checking robustness. Use them after a backtest looks
            promising, not before. The goal is to see whether a strategy survives alternate assumptions, simulations, and
            out-of-sample style review.
          </p>
        </SectionHeader>
        <WorkflowDiagram
          title="Validation loop"
          description="A strategy should move through comparison and validation before it becomes an alert or execution idea."
          steps={["Backtest", "Compare", "Monte Carlo", "Walk-forward", "Signals"]}
        />
      </section>

      <section id="signals-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Signals">
          <p>
            Signals is for monitoring strategy or model conditions after research is complete. Use it to rank or surface
            opportunities, then return to the advisor or journal before making a decision.
          </p>
        </SectionHeader>
        <Callout type="info">
          Signals should be interpreted with market context, portfolio exposure, and risk constraints. They are not
          automatic trade instructions.
        </Callout>
      </section>

      <section id="research-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader eyebrow="Advanced Tools" title="Research Reports">
          <p>
            Quanfora 2.1 Research Reports turn a ticker into a durable analyst-style run. The workflow captures a shared
            market snapshot, streams agent events, stores individual analyst reports, and can publish a shareable report
            link when you need to hand off the work.
          </p>
        </SectionHeader>
        <ScreenAnatomy
          title="Quanfora 2.1 research report anatomy"
          description="Use this page when the output needs to survive beyond a chat answer."
          regions={[
            { label: "Run setup", detail: "Choose ticker, analysis date, depth, analyst coverage, and model preferences.", icon: <Search className="size-4" /> },
            { label: "Live events", detail: "Follow reasoning, tool use, status updates, and final report events as the run progresses.", icon: <Activity className="size-4" /> },
            { label: "Analyst reports", detail: "Review market, social, news, and fundamentals sections with evidence and confidence.", icon: <BookMarked className="size-4" /> },
            { label: "Share controls", detail: "Create a public report link when a completed run should be shared outside the workspace.", icon: <Network className="size-4" /> },
          ]}
        />
        <WorkflowDiagram
          title="Quanfora 2.1 workflow"
          description="A 2.1 run is a ticker-based research workflow, not a normal chat response. It starts from AI Advisor, Market, or the Research page and ends with a saved report."
          steps={["Ticker + depth", "Shared snapshot", "Research agents", "PM verdict", "Share report"]}
        />
      </section>

      <section id="export-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Export">
          <p>
            Export is a Quant plan tool for moving reports, trades, and research data out of the app. Use it when you need
            offline review, compliance records, or handoff to another analysis workflow.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Use case", "What to export"]}
          rows={[
            ["Investment committee review", "Advisor summaries, portfolio analysis, and risk notes."],
            ["Personal audit trail", "Journal entries, backtest settings, and strategy results."],
            ["External modeling", "Portfolio holdings, watchlist symbols, and exported data tables."],
          ]}
        />
      </section>

      <section id="plans-guide" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Plans and feature access">
          <p>
            Feature access is plan-based. Free covers the basic research loop; Pro adds deeper portfolio and risk work;
            Trader adds strategy workflows; Quant adds optimization, validation, export, and premium model routing;
            Execution is an invite-only add-on for broker-connected workflows.
          </p>
        </SectionHeader>
        <PlanAccessMatrix />
      </section>
    </>
  );
}

function TechnicalReference() {
  return (
    <>
      <section id="architecture" data-doc-section className="scroll-mt-24">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">Technical Reference</div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">API and system reference</h1>
        <p className="mt-5 text-lg leading-8 text-white/62">
          This section is for implementation work: backend integration, agent debugging, API behavior, and review of how
          recommendations are routed and produced.
        </p>
        <CodeBlock
          title="System shape"
          language="text"
          code={`Next.js frontend
  -> FastAPI backend
  -> LangGraph agent orchestration + Redis-backed LLM worker
  -> market, sentiment, prediction, research reports, optimization, backtesting, risk, and storage services
  -> Supabase, Stripe, Redis, Qdrant, yfinance, LLM providers, and plan-based feature gates`}
        />
      </section>

      <section id="agent-modes" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Agent modes">
          <p>
            Quanfora currently has three user-facing architectures. These are the choices exposed in AI Advisor's model
            selector: a fast single-agent advisor, a multi-agent consensus system, and the Equity Research Desk for
            ticker-based reports.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Architecture", "Behavior", "Best for"]}
          rows={[
            ["Quanfora 1.0", "A lightweight single advisor agent uses tools and conversation context to answer quickly.", "Quotes, simple research questions, portfolio explanations, and fast follow-ups."],
            ["Quanfora 2.0", "A five-specialist consensus system forms independent opinions before synthesis.", "High-consequence investment reviews, disagreement checks, and risk-heavy questions."],
            ["Quanfora 2.1", "An Equity Research Desk creates a ticker-based run with a shared snapshot, ordered analyst reports, event timeline, and final PM-style verdict.", "Durable stock research reports that need evidence, caveats, and downloadable output."],
          ]}
        />
        <Callout type="info">
          <strong>Implementation note:</strong> queued jobs and automatic API routing are scalability mechanics, not
          additional user-facing agent architectures. They belong in the API reference, while this section describes the
          three product modes users can intentionally choose.
        </Callout>
      </section>

      <section id="single-agent" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Quanfora 1.0 single advisor">
          <p>
            Quanfora 1.0 is the default AI Advisor mode. It is optimized for speed and conversational continuity: one
            tool-using advisor interprets the request, calls the relevant market or portfolio tools, and returns a concise
            answer.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Capability", "How it works"]}
          rows={[
            ["Fast routing", "The advisor chooses the smallest useful tool path instead of launching a full research workflow."],
            ["Tool-backed answers", "It can use quotes, market research, sentiment, prediction, optimization, and portfolio context when needed."],
            ["Session continuity", "Chat history and session context help follow-up questions stay connected to the previous answer."],
            ["Best default", "It remains the default model because most advisor questions do not need multi-agent debate or report generation."],
          ]}
        />
        <CodeBlock
          title="Quanfora 1.0 flow"
          language="text"
          code={`User question
  -> single advisor reasoning
  -> relevant tool calls
  -> concise answer with caveats`}
        />
      </section>

      <section id="consensus" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Consensus engine">
          <p>
            Consensus analysis combines independent specialist opinions into a final recommendation. It is designed to
            expose disagreement, confidence, and risk flags instead of returning a single unsupported answer.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Specialist", "Focus"]}
          rows={[
            ["Quant Researcher", "Market data, fundamental context, and sentiment."],
            ["Quant Analyst", "Technical analysis, momentum, and strategy behavior."],
            ["Financial Data Scientist", "Prediction, statistical profiling, and model interpretation."],
            ["Risk Analyst", "VaR, drawdown, concentration, correlation, and veto-style risk flags."],
            ["Portfolio Analytics", "Allocation, Sharpe ratio, classical optimization, and quantum subset selection."],
          ]}
        />
        <CodeBlock
          title="Weighted consensus sketch"
          language="text"
          code={`consensus_score = sum(verdict_numeric * weight * confidence) / sum(weight)

bullish = +1
bearish = -1
neutral or hold = 0

Risk flags can downgrade an otherwise bullish result when downside evidence is strong.`}
        />
      </section>

      <section id="research-desk" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Quanfora 2.1 Equity Research Desk">
          <p>
            Quanfora 2.1 is not a normal chat response. It turns a ticker into a structured research run with visible
            progress, report files, event logs, risk review, and a final portfolio-manager-style verdict.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Stage", "Focus"]}
          rows={[
            ["Shared snapshot", "Resolves the ticker once, then captures price, fundamentals, technical indicators, news, sentiment, and risk context."],
            ["Analyst team", "Market, social sentiment, news, and fundamentals analysts write focused evidence-based reports."],
            ["Research debate", "Bull and bear researchers stress-test the thesis before the evaluator synthesizes agreement and disagreement."],
            ["Trading desk", "The trader proposes entry considerations, invalidation conditions, horizon, and sizing caveats without implying execution."],
            ["Risk review and PM verdict", "Risk analysts evaluate upside/downside controls, then the portfolio manager issues the final recommendation and confidence."],
          ]}
        />
        <CodeBlock
          title="Quanfora 2.1 workflow"
          language="text"
          code={`Ticker + depth
  -> shared data snapshot
  -> analyst reports
  -> bull / bear debate
  -> trader plan
  -> risk review
  -> final PM verdict
  -> downloadable report and optional share link`}
        />
      </section>

      <section id="api-chat" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Chat endpoint">
          <p>
            Use the chat endpoint for programmatic advisor access. The endpoint supports session persistence and explicit
            routing through single, consensus, or auto mode. The queued job endpoints are a scalability path for longer
            requests: they submit work to Redis and poll the worker instead of blocking the browser.
          </p>
        </SectionHeader>
        <CodeBlock
          title="POST /api/v1/agent/chat"
          language="bash"
          code={`curl -X POST https://your-api.com/api/v1/agent/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "message": "Review NVDA risk before earnings.",
    "mode": "consensus",
    "session_id": "research-nvda"
  }'`}
        />
        <DocTable
          headers={["Field", "Type", "Description"]}
          rows={[
            ["message", "string", "The user question or instruction."],
            ["mode", "single | consensus | auto", "Controls how much agent orchestration is used."],
            ["session_id", "string", "Conversation identifier for history and continuity."],
            ["remember", "boolean", "Whether to persist the exchange in chat history."],
          ]}
        />
        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["POST /api/v1/agent/chat/jobs", "Queue a chat request for the Redis-backed worker."],
            ["GET /api/v1/agent/chat/jobs/{job_id}", "Poll queued job status, result, and error state."],
            ["WS /ws/agent/chat/{session_id}", "Stream chat updates over WebSocket for a session."],
          ]}
        />
      </section>

      <section id="api-research" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Equity research APIs">
          <p>
            Equity research endpoints power analyst-style runs, event streams, saved reports, and public report sharing.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["POST /api/v1/equity-research/runs", "Start a research run for a ticker."],
            ["GET /api/v1/equity-research/runs/{run_id}", "Load run detail, snapshot, reports, and latest events."],
            ["GET /api/v1/equity-research/runs/{run_id}/reports", "Load analyst reports for a run."],
            ["GET /api/v1/equity-research/runs/{run_id}/events/list", "Load event history with cursor support."],
            ["GET /api/v1/equity-research/runs/{run_id}/events", "Stream run events."],
            ["PATCH /api/v1/equity-research/runs/{run_id}/share", "Create or update public sharing."],
            ["GET /api/v1/equity-research/shared/{share_slug}", "Read a public shared report."],
          ]}
        />
      </section>

      <section id="api-market" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Market and sentiment APIs">
          <p>
            These endpoints power quote lookup, market search, chart views, news, and headline sentiment workflows.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["GET /api/v1/market/search?q=AAPL", "Search symbols and companies for picker-style interfaces."],
            ["GET /api/v1/market/quote/{ticker}", "Fetch quote, chart, and detail data for a ticker."],
            ["GET /api/v1/news/categories", "Fetch news category metadata."],
            ["GET /api/v1/news", "Fetch authenticated news feeds with category and ticker filters."],
            ["POST /api/v1/sentiment", "Classify one or more financial headlines and return aggregate mood."],
            ["POST /api/v1/predict", "Run directional ML prediction where available."],
          ]}
        />
        <CodeBlock
          title="POST /api/v1/sentiment"
          language="json"
          code={`{
  "texts": [
    "Apple beats earnings expectations",
    "Chip stocks fall after export restriction report"
  ]
}`}
        />
      </section>

      <section id="api-portfolio" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Portfolio, risk, and optimization APIs">
          <p>
            Portfolio endpoints manage user portfolios and holdings. Optimization and risk endpoints then analyze those
            holdings or an explicit symbol universe.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["GET /api/v1/portfolios", "List portfolios for the current user."],
            ["POST /api/v1/portfolios", "Create a portfolio with name and currency."],
            ["GET /api/v1/portfolios/{id}/holdings", "Load holdings for a selected portfolio."],
            ["POST /api/v1/portfolios/{id}/holdings", "Add a holding to a portfolio."],
            ["PATCH /api/v1/portfolios/{id}/holdings/{holding_id}", "Update quantity, average cost, or holding metadata."],
            ["GET /api/v1/watchlists", "List watchlists for the current user."],
            ["GET /api/v1/watchlists/{id}/assets", "Load assets for a watchlist."],
            ["POST /api/v1/watchlists/{id}/assets", "Add an asset to a watchlist."],
            ["POST /api/v1/optimize", "Run classical or quantum optimization for a ticker universe."],
            ["GET /api/v1/risk/portfolios/{id}", "Return risk snapshot, allocation, and correlation data."],
          ]}
        />
        <CodeBlock
          title="POST /api/v1/optimize"
          language="json"
          code={`{
  "tickers": ["AAPL", "MSFT", "GOOGL", "AMZN"],
  "method": "classical",
  "risk_tolerance": 1.0,
  "target_assets": 3
}`}
        />
      </section>

      <section id="api-backtest" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Backtesting API">
          <p>
            Backtesting APIs run strategy simulations and return metrics, equity curves, and trades. They are intended
            for strategy research, saved run review, market-data replay, and validation workflows, not live execution.
          </p>
        </SectionHeader>
        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["GET /api/v1/backtests/strategies/options", "List available strategy templates."],
            ["POST /api/v1/backtests/run", "Run a strategy simulation."],
            ["GET /api/v1/backtests/runs", "List saved backtest runs."],
            ["GET /api/v1/backtests/market-data/candles", "Fetch candle data for charting and replay."],
            ["POST /api/v1/backtests/replay-sessions", "Create a replay session."],
            ["PATCH /api/v1/backtests/replay-sessions/{session_id}", "Update replay state and notes."],
          ]}
        />
        <CodeBlock
          title="POST /api/v1/backtests/run"
          language="json"
          code={`{
  "strategy_type": "moving_average_crossover",
  "strategy_name": "My SMA Strategy",
  "symbols": ["AAPL", "MSFT"],
  "parameters": { "short_window": 20, "long_window": 50 },
  "start_date": "2024-01-01",
  "end_date": "2026-01-01",
  "initial_capital": 100000,
  "fees_bps": 10,
  "slippage_bps": 5,
  "position_size": 0.5
}`}
        />
      </section>

      <section id="rate-limits" data-doc-section className="mt-16 scroll-mt-24">
        <SectionHeader title="Rate limits and plan gates">
          <p>
            Usage depends on the current plan and upstream provider limits. Consensus mode is intentionally heavier than
            single-agent mode because it runs multiple specialist passes and a final synthesis.
          </p>
        </SectionHeader>
        <PlanAccessMatrix />
        <Callout type="info">
          If a feature returns an upgrade prompt in the UI, the route is available but the operation is plan-gated. Upgrade
          prompts are expected behavior, not frontend errors.
        </Callout>
      </section>
    </>
  );
}
