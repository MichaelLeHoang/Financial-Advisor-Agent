"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  BookOpen,
  Code2,
  Layers,
  ShieldCheck,
  Brain,
  BarChart3,
  LineChart,
  Settings,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Menu,
  X,
  Search,
  ArrowUp,
  FlaskConical,
  Cpu,
  Network,
  CircleDollarSign,
  Moon,
  Sun
} from "lucide-react";

/* ───────────────────── Sidebar Navigation Data ───────────────────── */

interface NavSection {
  title: string;
  items: { id: string; label: string; icon?: React.ReactNode }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { id: "introduction", label: "Introduction", icon: <BookOpen className="size-4" /> },
      { id: "quickstart", label: "Quickstart", icon: <Zap className="size-4" /> },
      { id: "architecture", label: "Architecture", icon: <Network className="size-4" /> },
    ],
  },
  {
    title: "Core Concepts",
    items: [
      { id: "agent-modes", label: "Agent Modes", icon: <Brain className="size-4" /> },
      { id: "consensus", label: "Consensus Engine", icon: <Layers className="size-4" /> },
      { id: "specialists", label: "Specialist Agents", icon: <Cpu className="size-4" /> },
    ],
  },
  {
    title: "Tools & Capabilities",
    items: [
      { id: "tools-overview", label: "Tools Overview", icon: <Settings className="size-4" /> },
      { id: "portfolio", label: "Portfolio Optimization", icon: <BarChart3 className="size-4" /> },
      { id: "sentiment", label: "Sentiment Analysis", icon: <LineChart className="size-4" /> },
      { id: "ml-prediction", label: "ML Prediction", icon: <FlaskConical className="size-4" /> },
    ],
  },
  {
    title: "API Reference",
    items: [
      { id: "api-chat", label: "Chat Endpoint", icon: <Code2 className="size-4" /> },
      { id: "api-consensus", label: "Consensus Endpoint", icon: <Code2 className="size-4" /> },
      { id: "api-market", label: "Market Data", icon: <Code2 className="size-4" /> },
      { id: "api-optimize", label: "Optimize", icon: <Code2 className="size-4" /> },
    ],
  },
  {
    title: "Plans & Limits",
    items: [
      { id: "plans", label: "Pricing Plans", icon: <CircleDollarSign className="size-4" /> },
      { id: "rate-limits", label: "Rate Limits", icon: <ShieldCheck className="size-4" /> },
    ],
  },
];

/* ───────────────────── Code Block Component ───────────────────── */

function CodeBlock({ code, language = "json", title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0b12]">
      {title && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 text-xs text-white/40">
          <span>{title}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/20">{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-white/70">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white/30 opacity-0 transition-all hover:bg-white/[0.1] hover:text-white/60 group-hover:opacity-100"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/* ───────────────────── Callout Component ───────────────────── */

function Callout({ type = "info", children }: { type?: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "border-indigo-500/30 bg-indigo-500/[0.06] text-indigo-300",
    warn: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
    tip: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
  };
  const labels = { info: "Note", warn: "Important", tip: "Tip" };
  return (
    <div className={`my-5 rounded-lg border-l-4 p-4 text-sm leading-relaxed ${styles[type]}`}>
      <strong className="mb-1 block text-xs font-semibold uppercase tracking-wider">{labels[type]}</strong>
      <div className="text-white/70">{children}</div>
    </div>
  );
}

/* ───────────────────── Table Component ───────────────────── */

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.04] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-white/70" dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────── Docs Search Modal ───────────────────── */

function DocsSearchModal({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (sectionId: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");

  // All searchable items flattened
  const allItems = React.useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) =>
        section.items.map((item) => ({
          id: item.id,
          label: item.label,
          section: section.title,
          icon: item.icon,
        }))
      ),
    []
  );

  const filtered = React.useMemo(() => {
    if (query.length < 1) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  // Auto-focus when modal opens
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Escape to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-[12vh] z-[110] w-[min(94vw,560px)] -translate-x-1/2 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0a0a0e] shadow-[0_36px_120px_-48px_rgba(0,0,0,0.8),0_0_64px_rgba(99,102,241,0.08)]"
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Close search"
          onClick={() => onOpenChange(false)}
          className="absolute right-5 top-5 z-20 flex size-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:text-white/60"
        >
          <X className="size-[18px]" />
        </button>

        {/* Search input */}
        <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <Search className="size-5 shrink-0 text-white/25" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-transparent text-lg text-white outline-none placeholder:text-white/25"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4 sm:px-6">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">No matching sections found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onNavigate(item.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white/80">{item.label}</div>
                    <div className="truncate text-xs text-white/30">{item.section}</div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-white/15" />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  /* Track which section is in view */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    const sections = document.querySelectorAll("[data-doc-section]");
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileNavOpen(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0c0d14] text-white selection:bg-indigo-500/30">
      {/* ──── Top Bar ──── */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#0c0d14]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link href="/introduction" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white/80">Documentation</span>
          </Link>
          <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-1 py-0.5 text-xs sm:flex">
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 font-medium text-indigo-300">Docs</span>
            <Link href="/introduction" className="px-2.5 py-1 text-white/40 transition-colors hover:text-white/70">Home</Link>
          </div>
          <div className="flex-1" />

          {/* Search Bar */}
          <div className="hidden sm:flex relative group items-center">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-white/60 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              readOnly
              onClick={() => setSearchOpen(true)}
              placeholder="Search docs..."
              className="w-52 md:w-64 cursor-pointer rounded-full border border-white/[0.08] bg-white/[0.03] py-1.5 pl-9 pr-10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all hover:bg-white/[0.06]"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60 pointer-events-none">
              ⌘K
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors ml-2"
            aria-label="Toggle light and dark theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <Link
            href="/introduction"
            className="hidden sm:block text-sm text-white/40 transition-colors hover:text-white/70 ml-2"
          >
            ← Back
          </Link>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] text-white/40 hover:text-white/70 sm:hidden"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* ──── Sidebar ──── */}
        <aside
          className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#0c0d14] px-4 pb-10 pt-6 transition-transform sm:sticky sm:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <nav className="space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                  {section.title}
                </h3>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${activeSection === item.id
                            ? "bg-indigo-500/10 text-indigo-300 font-medium"
                            : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                          }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* ──── Main Content ──── */}
        <main ref={contentRef} className="min-w-0 flex-1 px-6 pb-32 pt-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-3xl">

            {/* ═══════ INTRODUCTION ═══════ */}
            <section id="introduction" data-doc-section className="scroll-mt-20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">Getting Started</div>
              <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Quantum Advisor Documentation</h1>
              <p className="mb-6 text-lg leading-relaxed text-white/60">
                Quantum Advisor (QuanAd) is an AI-powered financial analysis platform that orchestrates multiple specialist LLM agents to deliver institutional-grade investment research. Unlike single-model chatbots, QuanAd's consensus architecture forces agents to independently analyze, debate, and converge on recommendations — reducing hallucination risk and improving signal quality.
              </p>

              <div className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h2 className="mb-3 mt-0 text-base font-semibold text-white/90">Key Takeaways</h2>
                <ul className="space-y-2 text-sm text-white/60">
                  <li className="flex gap-2"><ChevronRight className="mt-0.5 size-4 shrink-0 text-indigo-400" /> <span><strong className="text-white/80">Two operating modes:</strong> Fast single-agent for quick queries, multi-agent consensus for deep investment analysis.</span></li>
                  <li className="flex gap-2"><ChevronRight className="mt-0.5 size-4 shrink-0 text-indigo-400" /> <span><strong className="text-white/80">5 specialist agents</strong> (Quant Researcher, Quant Analyst, Data Scientist, Risk Analyst, Portfolio Analytics) each with dedicated tools.</span></li>
                  <li className="flex gap-2"><ChevronRight className="mt-0.5 size-4 shrink-0 text-indigo-400" /> <span><strong className="text-white/80">Risk-veto system:</strong> The Risk Analyst can override bullish consensus if ≥3 critical risk flags are detected.</span></li>
                  <li className="flex gap-2"><ChevronRight className="mt-0.5 size-4 shrink-0 text-indigo-400" /> <span><strong className="text-white/80">Classical + Quantum optimization:</strong> Markowitz mean-variance and QAOA-based portfolio construction.</span></li>
                  <li className="flex gap-2"><ChevronRight className="mt-0.5 size-4 shrink-0 text-indigo-400" /> <span><strong className="text-white/80">Multi-provider LLM gateway:</strong> Supports Google Gemini, OpenAI, Anthropic, and OpenRouter with automatic fallback.</span></li>
                </ul>
              </div>
            </section>

            {/* ═══════ QUICKSTART ═══════ */}
            <section id="quickstart" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Quickstart</h2>
              <p className="mb-4 text-white/60">Get a response from the Quantum Advisor in under 30 seconds. Here is a minimal cURL example hitting the chat endpoint:</p>

              <CodeBlock
                title="Quick chat — single agent mode"
                language="bash"
                code={`curl -X POST https://your-api.com/api/v1/agent/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "message": "What is the current price of AAPL?",
    "mode": "single"
  }'`}
              />

              <p className="mb-4 text-white/60">For deep investment analysis with all 5 specialists, switch to <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-indigo-300">consensus</code> mode:</p>

              <CodeBlock
                title="Deep analysis — consensus mode"
                language="bash"
                code={`curl -X POST https://your-api.com/api/v1/agent/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "message": "Should I invest in NVDA right now?",
    "mode": "consensus"
  }'`}
              />

              <Callout type="info">
                Consensus mode dispatches your query to 5 specialist agents sequentially. Expect responses in 30–45 seconds. Single-agent mode responds in 3–8 seconds.
              </Callout>
            </section>

            {/* ═══════ ARCHITECTURE ═══════ */}
            <section id="architecture" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Architecture</h2>
              <p className="mb-6 text-white/60">
                The system is composed of three layers: the <strong className="text-white/80">API layer</strong> (FastAPI), the <strong className="text-white/80">Agent layer</strong> (LangGraph ReAct agents + orchestrator), and the <strong className="text-white/80">Data layer</strong> (yfinance, Qdrant vector DB, Supabase).
              </p>

              <div className="my-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                <pre className="text-xs leading-6 text-white/50">{`┌──────────────────────────────────────────────────────┐
│  Frontend  (Next.js)                                 │
│  Chat UI  ·  Market Dashboard  ·  Portfolio View      │
└───────────────────────┬──────────────────────────────┘
                        │ REST / WebSocket
┌───────────────────────┴──────────────────────────────┐
│  API Layer  (FastAPI)                                │
│  /agent/chat  ·  /agent/consensus  ·  /optimize      │
│  /predict  ·  /sentiment  ·  /market/quote            │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│  Agent Layer                                         │
│  ┌─────────────┐   ┌──────────────────────────────┐  │
│  │ Single Agent│   │ QuanAd 2.0 Orchestrator      │  │
│  │ (ReAct)     │   │  → 5 Specialist Agents       │  │
│  │             │   │  → Consensus Engine           │  │
│  │             │   │  → LLM Synthesis              │  │
│  └─────────────┘   └──────────────────────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────┐
│  LLM Gateway                                         │
│  Google Gemini  ·  OpenAI  ·  Anthropic  ·  Router   │
│  Auto-fallback  ·  Plan-based routing  ·  Usage track │
└──────────────────────────────────────────────────────┘`}</pre>
              </div>
            </section>

            {/* ═══════ AGENT MODES ═══════ */}
            <section id="agent-modes" data-doc-section className="mt-16 scroll-mt-20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">Core Concepts</div>
              <h2 className="mb-4 text-2xl font-bold">Agent Modes</h2>
              <p className="mb-6 text-white/60">
                Every request to the advisor operates in one of three modes. The mode determines how many LLM agents are involved and how the response is synthesized.
              </p>

              <DocTable
                headers={["Mode", "Agents", "Latency", "Best For"]}
                rows={[
                  ["<code>single</code>", "1 ReAct agent", "3–8s", "Quick lookups: prices, basic sentiment, portfolio optimization"],
                  ["<code>consensus</code>", "5 specialists + synthesis", "30–45s", "Investment decisions: &ldquo;Should I buy NVDA?&rdquo;"],
                  ["<code>auto</code>", "Auto-detected", "Varies", "Let the system decide based on query keywords"],
                ]}
              />

              <h3 className="mb-3 mt-8 text-lg font-semibold">Auto-Detection Keywords</h3>
              <p className="mb-3 text-sm text-white/60">When <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-indigo-300">mode: "auto"</code>, the system scans for these phrases to route to consensus:</p>
              <div className="flex flex-wrap gap-2">
                {["should i invest", "should i buy", "should i sell", "is it a good time", "investment analysis", "full analysis", "comprehensive analysis", "deep analysis", "consensus", "multi-agent", "risk assessment", "portfolio review"].map((kw) => (
                  <span key={kw} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/50">
                    {kw}
                  </span>
                ))}
              </div>

              <Callout type="tip">
                You can always force consensus mode explicitly with <code>mode: "consensus"</code>, regardless of query phrasing. This is recommended for production integrations where you want deterministic routing.
              </Callout>
            </section>

            {/* ═══════ CONSENSUS ENGINE ═══════ */}
            <section id="consensus" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Consensus Engine</h2>
              <p className="mb-6 text-white/60">
                The Consensus Engine aggregates structured opinions from all 5 specialists into a single weighted recommendation. It handles disagreement detection, risk-veto logic, and confidence calibration.
              </p>

              <h3 className="mb-3 mt-8 text-lg font-semibold">How Scoring Works</h3>
              <p className="mb-4 text-sm text-white/60">
                Each specialist returns a <strong className="text-white/80">verdict</strong> (bullish / bearish / neutral / hold) with a <strong className="text-white/80">confidence</strong> score (0.0–1.0). The engine computes a weighted consensus score:
              </p>
              <CodeBlock
                title="Weighted consensus score formula"
                language="text"
                code={`consensus_score = Σ (verdict_numeric × weight × confidence) / Σ weight

Where:
  bullish  → +1.0
  bearish  → -1.0
  neutral  →  0.0
  hold     →  0.0`}
              />

              <h3 className="mb-3 mt-8 text-lg font-semibold">Agent Weights</h3>
              <DocTable
                headers={["Specialist", "Weight", "Rationale"]}
                rows={[
                  ["Quant Analyst", "<code>0.25</code>", "Highest weight — technical signals are the strongest short-term predictors"],
                  ["Quant Researcher", "<code>0.20</code>", "Market data + sentiment context provides fundamental grounding"],
                  ["Data Scientist", "<code>0.20</code>", "ML predictions add statistical rigor"],
                  ["Risk Analyst", "<code>0.20</code>", "Risk assessment + veto power ensures downside protection"],
                  ["Portfolio Analytics", "<code>0.15</code>", "Portfolio-level view is important but less decisive for individual stocks"],
                ]}
              />

              <h3 className="mb-3 mt-8 text-lg font-semibold">Verdict Thresholds</h3>
              <DocTable
                headers={["Score Range", "Verdict"]}
                rows={[
                  ["score &gt; +0.25", "<strong class='text-emerald-400'>BULLISH</strong>"],
                  ["score &lt; −0.25", "<strong class='text-red-400'>BEARISH</strong>"],
                  ["|score| ≤ 0.10", "<strong class='text-white/50'>NEUTRAL</strong>"],
                  ["0.10 &lt; |score| ≤ 0.25", "<strong class='text-amber-400'>HOLD</strong>"],
                ]}
              />

              <h3 className="mb-3 mt-8 text-lg font-semibold">Risk Veto Mechanism</h3>
              <Callout type="warn">
                If the Risk Analyst (or any combination of agents) surfaces <strong>≥ 3 critical risk flags</strong>, the consensus verdict is automatically downgraded from BULLISH → HOLD. This acts as a circuit breaker to prevent the system from issuing buy recommendations during periods of extreme risk.
              </Callout>
            </section>

            {/* ═══════ SPECIALISTS ═══════ */}
            <section id="specialists" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Specialist Agents</h2>
              <p className="mb-6 text-white/60">
                Each specialist is a LangGraph ReAct agent with a domain-specific system prompt and a curated set of tools. They operate independently and produce structured JSON opinions.
              </p>

              <div className="space-y-4">
                {[
                  {
                    name: "Quant Researcher",
                    color: "text-indigo-400 bg-indigo-500/10",
                    focus: "Market data gathering, fundamental analysis, FinBERT sentiment",
                    tools: ["get_stock_info", "analyze_sentiment"],
                    nuance: "This agent forms the fundamental baseline. It fetches real-time price data and runs FinBERT sentiment analysis on recent headlines. Its opinion tends to reflect current market mood rather than predictive signals.",
                  },
                  {
                    name: "Quant Analyst",
                    color: "text-cyan-400 bg-cyan-500/10",
                    focus: "Technical analysis, momentum signals, strategy backtesting",
                    tools: ["get_stock_info", "rank_market_signals", "run_strategy_backtest"],
                    nuance: "The most quantitatively driven specialist. It computes 20-day and 60-day momentum scores, runs moving-average crossover backtests, and evaluates Sharpe ratios. Its verdict is heavily data-driven, which makes it reliable in trending markets but occasionally late to reversals.",
                  },
                  {
                    name: "Financial Data Scientist",
                    color: "text-emerald-400 bg-emerald-500/10",
                    focus: "ML predictions, statistical profiling, distribution analysis",
                    tools: ["get_stock_info", "predict_stock_price", "compute_statistical_profile"],
                    nuance: "Trains a Random Forest model on 2 years of OHLCV data with technical indicators. Also computes skewness, kurtosis, and Jarque-Bera normality tests. Fat-tailed distributions (kurtosis > 1) are flagged as risk indicators. Note: ML accuracy metrics (MAE, RMSE) should be evaluated relative to stock price — a $2 MAE on a $200 stock is excellent, but poor on a $10 stock.",
                  },
                  {
                    name: "Risk Analyst",
                    color: "text-red-400 bg-red-500/10",
                    focus: "VaR, CVaR, max drawdown, concentration risk, correlation analysis",
                    tools: ["get_stock_info", "assess_stock_risk", "evaluate_portfolio_concentration"],
                    nuance: "The only agent with veto power. It computes Value-at-Risk (95% historical), Expected Shortfall (CVaR), maximum drawdown, and downside deviation. For multi-stock queries, it also evaluates pairwise correlations to flag concentration risk. If it detects ≥3 critical flags, it triggers the risk veto that overrides any bullish consensus.",
                  },
                  {
                    name: "Portfolio Analytics",
                    color: "text-amber-400 bg-amber-500/10",
                    focus: "Markowitz optimization, QAOA quantum optimization, allocation weights",
                    tools: ["get_stock_info", "optimize_portfolio_tool"],
                    nuance: "Thinks in terms of portfolio construction rather than individual stock picks. It runs Classical Markowitz to find optimal weights and can use Quantum QAOA for asset subset selection. Its verdict reflects whether adding/removing a stock improves the portfolio's Sharpe ratio.",
                  },
                ].map((spec) => (
                  <div key={spec.name} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${spec.color}`}>
                        <Cpu className="size-4" />
                      </div>
                      <h3 className="text-base font-semibold">{spec.name}</h3>
                    </div>
                    <p className="mb-2 text-sm text-white/50"><strong className="text-white/70">Focus:</strong> {spec.focus}</p>
                    <p className="mb-3 text-sm text-white/50"><strong className="text-white/70">Tools:</strong> <code className="text-xs text-indigo-300">{spec.tools.join(", ")}</code></p>
                    <p className="text-sm leading-relaxed text-white/60">{spec.nuance}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══════ TOOLS OVERVIEW ═══════ */}
            <section id="tools-overview" data-doc-section className="mt-16 scroll-mt-20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">Tools & Capabilities</div>
              <h2 className="mb-4 text-2xl font-bold">Tools Overview</h2>
              <p className="mb-6 text-white/60">
                The agent's capabilities come from 4 core tools plus specialist-specific tools. Every tool is a LangChain <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-indigo-300">@tool</code> function that the LLM calls autonomously during reasoning.
              </p>

              <DocTable
                headers={["Tool", "Input", "Output", "Used By"]}
                rows={[
                  ["<code>get_stock_info</code>", "ticker: string", "Price, change %, volume, high/low", "All agents"],
                  ["<code>analyze_sentiment</code>", "texts: string[]", "Market mood, bullish score, per-text labels", "Quant Researcher"],
                  ["<code>predict_stock_price</code>", "ticker: string", "ML direction (UP/DOWN), MAE, RMSE", "Data Scientist"],
                  ["<code>optimize_portfolio_tool</code>", "tickers: string[], method, risk_tolerance", "Weights, return, volatility, Sharpe", "Portfolio Analytics"],
                  ["<code>rank_market_signals</code>", "tickers: string[]", "Momentum scores, vol, trend labels", "Quant Analyst"],
                  ["<code>run_strategy_backtest</code>", "tickers, strategy_type, windows", "Return, Sharpe, drawdown, win rate", "Quant Analyst"],
                  ["<code>assess_stock_risk</code>", "ticker: string", "VaR, CVaR, drawdown, downside dev", "Risk Analyst"],
                  ["<code>evaluate_portfolio_concentration</code>", "tickers: string[]", "Correlation matrix, concentration risk", "Risk Analyst"],
                  ["<code>compute_statistical_profile</code>", "ticker: string", "Skewness, kurtosis, autocorrelation", "Data Scientist"],
                ]}
              />
            </section>

            {/* ═══════ PORTFOLIO OPTIMIZATION ═══════ */}
            <section id="portfolio" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Portfolio Optimization</h2>

              <h3 className="mb-3 mt-6 text-lg font-semibold">Classical Markowitz (Mean-Variance)</h3>
              <p className="mb-4 text-sm text-white/60">
                Computes the optimal weight allocation that maximizes the Sharpe Ratio (return per unit of risk). Uses SciPy's SLSQP optimizer with no-short-selling constraints (weights ≥ 0, sum = 1).
              </p>
              <CodeBlock
                title="Optimization objective"
                language="text"
                code={`Minimize:  w^T Σ w  −  risk_tolerance × w^T μ
Subject to:  Σ w_i = 1,   w_i ≥ 0

Where:
  w = weight vector (allocation per stock)
  Σ = annualized covariance matrix (252 trading days)
  μ = annualized mean returns
  risk_tolerance = 1.0 (default, balanced)`}
              />
              <Callout type="warn">
                Markowitz is highly sensitive to recent historical data. If tech stocks surged over the last 12 months, the optimizer will heavily overweight them. This is a known limitation — not a bug. Always cross-reference with the Risk Analyst's output.
              </Callout>

              <h3 className="mb-3 mt-8 text-lg font-semibold">Quantum QAOA Optimization</h3>
              <p className="mb-4 text-sm text-white/60">
                Uses the Quantum Approximate Optimization Algorithm (QAOA) for asset subset selection. Instead of finding continuous weights, it answers: <em>"Which N stocks from this universe should I hold?"</em> This is a combinatorial problem that traditional optimizers struggle with at scale.
              </p>
              <Callout type="tip">
                Quantum optimization is best suited when you have a large universe (10+ stocks) and want to narrow it down to a concentrated portfolio (3-5 holdings). For small portfolios (≤5 stocks), Classical Markowitz is generally sufficient.
              </Callout>
            </section>

            {/* ═══════ SENTIMENT ═══════ */}
            <section id="sentiment" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Sentiment Analysis</h2>
              <p className="mb-4 text-white/60">
                Uses FinBERT, a BERT model fine-tuned on financial text, to classify headlines as positive, negative, or neutral. Returns per-text scores and an aggregate market mood signal.
              </p>
              <CodeBlock
                title="POST /api/v1/sentiment"
                language="json"
                code={`{
  "texts": [
    "Apple beats Q3 earnings expectations by 15%",
    "SEC launches investigation into crypto exchange",
    "Federal Reserve holds interest rates steady"
  ]
}`}
              />
              <CodeBlock
                title="Response"
                language="json"
                code={`{
  "market_mood": {
    "mood": "BULLISH",
    "signal": "buy",
    "bullish_score": 0.4523,
    "breakdown": { "positive": 1, "negative": 1, "neutral": 1 }
  },
  "individual": [
    { "label": "positive", "score": 0.94 },
    { "label": "negative", "score": 0.87 },
    { "label": "neutral",  "score": 0.91 }
  ]
}`}
              />
            </section>

            {/* ═══════ ML PREDICTION ═══════ */}
            <section id="ml-prediction" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">ML Price Prediction</h2>
              <p className="mb-4 text-white/60">
                Trains a Random Forest (200 trees) or LSTM neural network on 2 years of OHLCV data with technical indicators. Returns directional prediction (UP / DOWN) and accuracy metrics.
              </p>
              <CodeBlock
                title="POST /api/v1/predict"
                language="json"
                code={`{
  "ticker": "NVDA",
  "model_type": "random_forest",
  "sequence_length": 5
}`}
              />
              <Callout type="warn">
                ML predictions indicate historical pattern direction, not future price targets. Always interpret MAE/RMSE relative to the stock price. A test MAE of $3.50 means different things for a $15 stock vs. a $900 stock.
              </Callout>
            </section>

            {/* ═══════ API: CHAT ═══════ */}
            <section id="api-chat" data-doc-section className="mt-16 scroll-mt-20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">API Reference</div>
              <h2 className="mb-4 text-2xl font-bold">POST /api/v1/agent/chat</h2>
              <p className="mb-4 text-white/60">
                Primary chat endpoint. Supports single-agent and consensus modes. Maintains per-session conversation history.
              </p>
              <DocTable
                headers={["Parameter", "Type", "Default", "Description"]}
                rows={[
                  ["<code>message</code>", "string", "<em>required</em>", "User's message or query"],
                  ["<code>mode</code>", "string", "<code>\"single\"</code>", "<code>single</code> | <code>consensus</code> | <code>auto</code>"],
                  ["<code>remember</code>", "boolean", "<code>true</code>", "Persist to conversation history"],
                  ["<code>session_id</code>", "string", "<code>\"default\"</code>", "Conversation session identifier"],
                  ["<code>preferred_mode</code>", "string?", "<code>null</code>", "Override LLM routing (e.g., <code>\"performance\"</code>)"],
                ]}
              />
              <CodeBlock
                title="Response"
                language="json"
                code={`{
  "response": "Based on current data for AAPL...",
  "session_id": "default",
  "mode": "single"
}`}
              />
            </section>

            {/* ═══════ API: CONSENSUS ═══════ */}
            <section id="api-consensus" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">POST /api/v1/agent/consensus</h2>
              <p className="mb-4 text-white/60">
                Dedicated endpoint that returns the full consensus analysis with individual specialist opinions and metadata. Use this when you need programmatic access to each agent's verdict.
              </p>
              <CodeBlock
                title="Response structure"
                language="json"
                code={`{
  "response": "QuanAd 2.0 Lead Analyst synthesis...",
  "session_id": "default",
  "mode": "consensus",
  "consensus": {
    "verdict": "bullish",
    "confidence": 0.72,
    "consensus_score": 0.4521,
    "agreement_ratio": 0.8,
    "risk_vetoed": false,
    "risk_flags": ["High 20-day volatility"],
    "dissenting_agents": ["risk_analyst"],
    "opinions": [
      {
        "agent": "quant_researcher",
        "verdict": "bullish",
        "confidence": 0.85,
        "reasoning": "Strong momentum...",
        "data_points": { "price": 198.50 },
        "risk_flags": []
      }
    ]
  }
}`}
              />
            </section>

            {/* ═══════ API: MARKET ═══════ */}
            <section id="api-market" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Market Data Endpoints</h2>

              <h3 className="mb-3 mt-6 text-lg font-semibold">GET /api/v1/market/quote/{"{ticker}"}</h3>
              <p className="mb-4 text-sm text-white/60">Fetch current quote and chart data for any market symbol. Supports <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-indigo-300">period</code> (1d, 5d, 1mo, 3mo, 6mo, 1y) and <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-indigo-300">interval</code> (1m, 5m, 1h, 1d) query params.</p>

              <h3 className="mb-3 mt-6 text-lg font-semibold">GET /api/v1/market/search?q={"{query}"}</h3>
              <p className="mb-4 text-sm text-white/60">Search market symbols with fuzzy matching. Returns ticker, name, exchange, sector, and quote type. Limited to 25 results.</p>
            </section>

            {/* ═══════ API: OPTIMIZE ═══════ */}
            <section id="api-optimize" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">POST /api/v1/optimize</h2>
              <p className="mb-4 text-white/60">Direct portfolio optimization endpoint (bypasses the agent layer).</p>
              <CodeBlock
                title="Request"
                language="json"
                code={`{
  "tickers": ["AAPL", "NVDA", "GOOGL", "TSLA", "AMZN"],
  "method": "classical",
  "risk_tolerance": 1.0,
  "target_assets": 3
}`}
              />
              <DocTable
                headers={["Parameter", "Type", "Default", "Description"]}
                rows={[
                  ["<code>tickers</code>", "string[]", "AAPL, NVDA, GOOGL, TSLA, AMZN", "Stock symbols to optimize"],
                  ["<code>method</code>", "string", "<code>\"classical\"</code>", "<code>classical</code> (Markowitz) or <code>quantum</code> (QAOA)"],
                  ["<code>risk_tolerance</code>", "float", "<code>1.0</code>", "Higher = more aggressive, lower = more conservative"],
                  ["<code>target_assets</code>", "int", "<code>3</code>", "For quantum method: how many stocks to select"],
                ]}
              />
            </section>

            {/* ═══════ PLANS ═══════ */}
            <section id="plans" data-doc-section className="mt-16 scroll-mt-20">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">Plans & Limits</div>
              <h2 className="mb-4 text-2xl font-bold">Pricing Plans</h2>
              <p className="mb-6 text-white/60">Features and limits scale with your subscription plan:</p>
              <DocTable
                headers={["Feature", "Free", "Pro", "Trader", "Quant"]}
                rows={[
                  ["AI Research (chat)", "✅ 10/day", "✅ 100/day", "✅ 250/day", "✅ 750/day"],
                  ["Sentiment Analysis", "✅ 5/day", "✅ 50/day", "✅ 150/day", "✅ 500/day"],
                  ["ML Prediction", "❌", "❌", "✅", "✅"],
                  ["Classical Optimization", "❌", "✅", "✅", "✅"],
                  ["Quantum Optimization", "❌", "❌", "❌", "✅"],
                  ["Backtesting", "❌", "❌", "✅", "✅"],
                  ["Risk Dashboard", "❌", "✅", "✅", "✅"],
                  ["Alerts", "❌", "❌", "✅ 30", "✅ 100"],
                  ["Trade Journal", "❌", "❌", "✅", "✅"],
                  ["Portfolios", "1", "5", "10", "25"],
                  ["Watchlists", "1", "5", "10", "25"],
                ]}
              />
            </section>

            {/* ═══════ RATE LIMITS ═══════ */}
            <section id="rate-limits" data-doc-section className="mt-16 scroll-mt-20">
              <h2 className="mb-4 text-2xl font-bold">Rate Limits & Performance</h2>
              <p className="mb-6 text-white/60">
                Because the consensus system orchestrates 5 agents sequentially (with 5-second delays to respect upstream LLM rate limits), a single consensus query generates 6–10 LLM calls.
              </p>

              <DocTable
                headers={["Metric", "Single Mode", "Consensus Mode"]}
                rows={[
                  ["Latency", "3–8 seconds", "30–45 seconds"],
                  ["LLM calls per query", "1–3", "6–10"],
                  ["Tools invoked", "1–4", "10–15 (across all specialists)"],
                  ["Rate limit sensitivity", "Low", "High (sequential dispatch mitigates)"],
                ]}
              />

              <Callout type="info">
                The system intentionally introduces 5-second delays between specialist dispatches in consensus mode. This is not a bug — it prevents rate-limit exhaustion on the upstream LLM provider (especially on Gemini free-tier, which allows ~15 requests/minute). If you have a paid API key, you can reduce this delay in the orchestrator configuration.
              </Callout>
            </section>

            {/* ──── End spacer ──── */}
            <div className="mt-20 border-t border-white/[0.06] pt-8 text-center text-sm text-white/30">
              <p>Quantum Advisor Documentation · © 2026 Michael Le</p>
              <p className="mt-1">AI-generated analysis only. Not professional financial advice.</p>
            </div>
          </div>
        </main>
      </div>

      {/* ──── Scroll-to-top FAB ──── */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#0c0d14]/90 text-white/40 backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:text-white/70"
        aria-label="Scroll to top"
      >
        <ArrowUp className="size-4" />
      </button>

      <AnimatePresence>
        <DocsSearchModal
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onNavigate={scrollToSection}
        />
      </AnimatePresence>
    </div>
  );
}
