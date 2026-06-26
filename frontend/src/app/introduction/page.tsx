"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, Brain, Atom, TrendingUp, PieChart, MessageSquare,
  Shield, ExternalLink, Check, Lock, Search, Radio, Circle,
  CircleDotDashed, CheckCircle2, FileText,
} from "lucide-react";
import { PLANS, COMPARISON_TABLE, type PlanId, type CheckState } from "@/config/plans";
import { IntroductionFooter, IntroductionNav } from "./components";
import Markdown from "@/components/ui/markdown";

/* ───── data ───── */

const FEATURES = [
  { icon: MessageSquare, title: "Conversational AI Advisor", desc: "Ask anything about markets, stocks, or portfolios. Powered by a LangGraph ReAct agent with real-time tool access." },
  { icon: Brain, title: "FinBERT Sentiment Analysis", desc: "Gauge market mood with state-of-the-art NLP, analyzing news headlines and social signals in seconds." },
  { icon: PieChart, title: "Classical Portfolio Optimization", desc: "Markowitz mean-variance optimization for allocation, risk budgeting, and efficient frontier analysis." },
  { icon: Atom, title: "Quantum Portfolio Optimization", desc: "QAOA-powered combinatorial selection on simulated quantum hardware for next-gen asset allocation." },
  { icon: TrendingUp, title: "ML Stock Prediction", desc: "Random Forest and LSTM models for price direction forecasting, trained on real historical data." },
  { icon: Shield, title: "RAG-Augmented Memory", desc: "Retrieval-augmented generation with Qdrant vector store for grounded, citation-backed financial insights." },
];

const SAMPLES = [
  {
    id: "market",
    label: "Market analysis",
    messages: [
      { role: "user", text: "What's happening with NVIDIA right now? Should I be worried about my position?" },
      { role: "advisor", text: "NVDA is currently trading at $924.52, up 2.3% today. The stock is trading above its 50-day and 200-day moving averages, which is a bullish signal.\n\nKey data points:\n• P/E ratio: 64.2 (elevated but in line with AI sector peers)\n• Revenue growth: +122% YoY last quarter\n• Analyst consensus: Strong Buy (avg. target $1,050)\n\nSentiment from recent news headlines is strongly positive, driven by new data center partnerships. However, I'd flag that RSI is at 71 — slightly overbought territory. Consider setting a trailing stop if you want to protect gains." },
      { role: "user", text: "What about compared to AMD and INTC?" },
      { role: "advisor", text: "Here's a quick peer comparison:\n\n| Metric | NVDA | AMD | INTC |\n|--------|------|-----|------|\n| YTD Return | +89% | +12% | -28% |\n| P/E Ratio | 64.2 | 47.8 | N/A (neg.) |\n| Revenue Growth | +122% | +4% | -10% |\n| Gross Margin | 76% | 50% | 41% |\n\nNVDA clearly leads on growth and margins. AMD is a secondary play on AI but with lower valuation risk. INTC is in a restructuring phase — higher risk, potential value play for patient investors." },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio optimization",
    messages: [
      { role: "user", text: "I have $50K split equally between AAPL, MSFT, GOOGL, AMZN, and TSLA. Can you optimize this?" },
      { role: "advisor", text: "I ran a Markowitz mean-variance optimization on your 5-stock portfolio using 2 years of daily returns. Here are the results:\n\nCurrent allocation (equal weight 20% each):\n• Expected annual return: 18.4%\n• Portfolio volatility: 24.1%\n• Sharpe ratio: 0.62\n\nOptimized allocation (max Sharpe):\n• AAPL: 28% → lower beta, stable cash flows\n• MSFT: 32% → best risk-adjusted returns\n• GOOGL: 22% → strong momentum\n• AMZN: 14% → higher volatility drag\n• TSLA: 4% → high vol, low correlation benefit\n\nOptimized portfolio metrics:\n• Expected annual return: 19.1%\n• Portfolio volatility: 19.8%\n• Sharpe ratio: 0.81\n\nThis improves your Sharpe ratio by 31% while slightly increasing expected returns." },
      { role: "user", text: "Can you also run the quantum optimizer on this?" },
      { role: "advisor", text: "Running QAOA on a simulated 11-qubit IonQ backend…\n\nThe quantum optimizer explored 2,048 portfolio combinations and converged after 14 variational iterations. Results are consistent with the classical solution but found a slightly different local optimum:\n\n• AAPL: 26% | MSFT: 30% | GOOGL: 24% | AMZN: 16% | TSLA: 4%\n• Sharpe: 0.79 (vs. 0.81 classical)\n\nThe quantum approach is most valuable with larger asset universes (20+), where classical solvers face combinatorial explosion. For a 5-stock portfolio, classical optimization is sufficient." },
    ],
  },
  {
    id: "sentiment",
    label: "Sentiment check",
    messages: [
      { role: "user", text: "What's the current market sentiment for the semiconductor sector?" },
      { role: "advisor", text: "I analyzed 247 recent news articles and social posts about the semiconductor sector using FinBERT. Here's the breakdown:\n\nOverall sentiment: Bullish (score: 0.72/1.0)\n\nPositive drivers (68% of coverage):\n• AI infrastructure spending acceleration\n• TSMC capacity expansion announcements\n• Strong earnings beats across the sector\n\nNegative signals (18% of coverage):\n• China export restriction concerns\n• Memory chip inventory glut fears\n• Some valuation stretch warnings\n\nNeutral (14% of coverage):\n• Regulatory reviews and policy discussions\n\nNotable shift: Sentiment improved +0.15 over the past 7 days, largely driven by positive datacenter capex guidance from hyperscalers." },
      { role: "user", text: "How does that compare to 3 months ago?" },
      { role: "advisor", text: "Three months ago, semiconductor sentiment was at 0.54 (Mildly Bullish), compared to today's 0.72 (Bullish). That's a +33% improvement.\n\nThe shift was driven by:\n1. Q1 earnings season → most semis beat estimates by 8-15%\n2. AI narrative strengthening → new model training demand\n3. Supply chain normalization → lead times shortening\n\nHistorically, when sector sentiment crosses above 0.70, the SOX index has gained an average of 6.2% over the following 60 days (based on 8 prior instances since 2020). However, readings above 0.80 have preceded 3-5% pullbacks 60% of the time." },
    ],
  },
  {
    id: "risk",
    label: "Risk assessment",
    messages: [
      { role: "user", text: "Can you run a risk analysis on my tech-heavy portfolio?" },
      { role: "advisor", text: "I analyzed your portfolio's risk profile. Here are the key findings:\n\nPortfolio Risk Metrics:\n• Value at Risk (95%, 1-day): -$1,247 (-2.49%)\n• Maximum Drawdown (1Y): -18.3%\n• Beta to S&P 500: 1.34\n• Sector concentration: 100% Technology\n\n⚠️ Key Risks Identified:\n\n1. Concentration risk: All 5 holdings are mega-cap tech. Your portfolio has 0.92 correlation to QQQ — essentially no diversification benefit.\n\n2. Factor exposure: Heavy tilt toward momentum and growth factors. In a factor rotation (growth → value), expect amplified drawdowns.\n\n3. Interest rate sensitivity: High-duration growth stocks are vulnerable to rising rate environments.\n\nRecommendations:\n• Add 2-3 non-tech sectors (Healthcare, Energy, Financials)\n• Consider a 10-15% allocation to bonds or gold for drawdown protection\n• Your current portfolio assumes a permanently bullish tech environment" },
    ],
  },
];

function sampleMarkdown(content: string) {
  return content.replace(/^•\s+/gm, "- ");
}

/* ───── page ───── */

export default function IntroductionPage() {
  return (
    <div className="relative min-h-screen">
      <IntroductionNav />

      {/* hero */}
      <section className="relative z-10 flex min-h-[72dvh] items-center justify-center px-6 pb-8 pt-24 text-center sm:px-8 sm:pb-12 sm:pt-28">
        <div className="mx-auto w-full max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center rounded-full border border-white/[0.12] px-4 py-1.5 text-xs font-medium text-white/55">
              AI + Quantum Finance
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 font-heading text-[2.5rem] font-normal leading-none text-white sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Quantum Financial
            <br />
            Advisor Platform
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/50 sm:text-lg"
          >
            Advanced, high-speed AI agents. Dynamically optimize your portfolio.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <button
              type="button"
              onClick={() => { window.localStorage.setItem("financial-advisor.coverSeen", "true"); window.location.href = "/session"; }}
              className="intro-primary-action group inline-flex h-12 items-center gap-2.5 rounded-full px-7 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Launch App <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="https://github.com/MichaelLeHoang/Financial-Advisor-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/[0.14] px-7 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              View on GitHub <ExternalLink className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </section>

      <ResearchWorkflowShowcase />
      <SamplesSection />
      <FeaturesSection />
      <PricingSection />
      <IntroductionFooter />
    </div>
  );
}

/* ── Research Workflow Showcase ── */
type DemoPhase = "search" | "workflow" | "analysis";

const DEMO_TICKERS = [
  { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
  { ticker: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ" },
  { ticker: "NVDA", name: "NVIDIA Corp.", exchange: "NASDAQ" },
  { ticker: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ" },
  { ticker: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ" },
  { ticker: "GOOGL", name: "Alphabet Inc.", exchange: "NASDAQ" },
  { ticker: "COST", name: "Costco Wholesale", exchange: "NASDAQ" },
];

const DEMO_WORKFLOW_STEPS = [
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

function ResearchWorkflowShowcase() {
  const tabs = ["Research", "Risk", "Narrative"];

  return (
    <section id="equity-research-demo" className="relative z-10 px-4 py-12 sm:px-6 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center"
      >
        <div>
          <p className="text-sm font-semibold text-white/34">For research desks</p>
          <h2 className="mt-5 font-heading text-4xl font-normal leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
            One research workflow.
            <br />
            <span className="text-white/45">Every market signal.</span>
          </h2>
          <p className="mt-7 max-w-xl text-base leading-8 text-white/44">
            Run structured equity research across live market data, news, sentiment,
            fundamentals, bull and bear cases, risk review, and final decision support.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("financial-advisor.coverSeen", "true");
                window.location.href = "/session";
              }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080b]"
            >
              Launch App
            </button>
            <a
              href="/research?source=introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 text-sm font-semibold text-white/78 transition-colors hover:border-white/26 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080b]"
            >
              Open full demo
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-8 text-sm">
            <div>
              <p className="font-semibold tabular-nums text-white/72">9</p>
              <p className="mt-1 text-white/30">agent workflow</p>
            </div>
            <div>
              <p className="font-semibold tabular-nums text-white/72">2 modes</p>
              <p className="mt-1 text-white/30">shallow or deep</p>
            </div>
            <div>
              <p className="font-semibold tabular-nums text-white/72">Risk first</p>
              <p className="mt-1 text-white/30">reviewed verdicts</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="relative rounded-[1.8rem] bg-[radial-gradient(circle_at_32%_10%,rgba(255,255,255,0.18),transparent_23%),radial-gradient(circle_at_85%_70%,rgba(255,255,255,0.20),transparent_30%),linear-gradient(145deg,#2d3036_0%,#0b0c10_52%,#3a3b3f_100%)] p-5 shadow-[0_34px_90px_rgba(0,0,0,0.38)] sm:p-7">
            <div className="pointer-events-none absolute inset-0 rounded-[1.8rem] opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.5)_0.5px,transparent_0.5px)] [background-size:3px_3px]" aria-hidden="true" />
            <span className="absolute -left-px top-0 h-6 w-6 bg-[var(--background)]" aria-hidden="true" />
            <span className="absolute -right-px bottom-0 h-6 w-6 bg-[var(--background)]" aria-hidden="true" />
            <span className="absolute bottom-6 right-6 h-6 w-6 bg-[var(--background)]" aria-hidden="true" />
            <ResearchWindowDemo />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  index === 0
                    ? "bg-white/[0.08] text-white"
                    : "text-white/36 hover:text-white/70"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function ResearchWindowDemo() {
  const [phase, setPhase] = useState<DemoPhase>("search");
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTicker, setSelectedTicker] = useState(DEMO_TICKERS[0]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return DEMO_TICKERS;

    return DEMO_TICKERS.filter((item) =>
      item.ticker.toLowerCase().includes(normalized) ||
      item.name.toLowerCase().includes(normalized)
    );
  }, [query]);

  useEffect(() => {
    if (phase !== "workflow") return;

    if (activeStep >= DEMO_WORKFLOW_STEPS.length - 1) {
      const doneTimer = window.setTimeout(() => setPhase("analysis"), 780);
      return () => window.clearTimeout(doneTimer);
    }

    const stepTimer = window.setTimeout(() => {
      setActiveStep((current) => Math.min(current + 1, DEMO_WORKFLOW_STEPS.length - 1));
    }, 580);

    return () => window.clearTimeout(stepTimer);
  }, [activeStep, phase]);

  const startWorkflow = (ticker = selectedTicker) => {
    setSelectedTicker(ticker);
    setQuery(ticker.ticker);
    setShowSuggestions(false);
    setActiveStep(0);
    setPhase("workflow");
  };

  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-[#050609] text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-5 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
        <span className="ml-auto text-xs font-medium text-white/38">QuanAd Live</span>
      </div>

      <div className="relative h-[378px] overflow-hidden sm:h-[398px]">
        <AnimatePresence mode="wait">
          {phase === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="h-full px-5 py-5 sm:px-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-primary/35 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
                <Radio className="h-3.5 w-3.5" />
                QuanAd 2.1 Equity Research Desk
              </div>
              <h3 className="mt-5 max-w-xl font-heading text-3xl font-normal leading-tight tracking-tight text-white sm:text-4xl">
                What stock would you like to analyze?
              </h3>

              <form
                className="mt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  startWorkflow(matches[0] ?? DEMO_TICKERS[0]);
                }}
              >
                <div className="flex h-14 items-center gap-3 rounded-full border border-white/[0.14] bg-white px-4 text-slate-950 shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
                  <Search className="h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Enter a ticker: AAPL, MSFT, NVDA..."
                    aria-label="Ticker symbol"
                  />
                  <button
                    type="submit"
                    aria-label="Analyze ticker"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-primary text-white transition-colors hover:bg-indigo-primary/90"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </form>

              <AnimatePresence>
                {showSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="mt-3 max-h-36 overflow-y-auto rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1.5"
                  >
                    {(matches.length ? matches : DEMO_TICKERS).slice(0, 7).map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => startWorkflow(item)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.07]"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-indigo-primary/25 bg-indigo-primary/15 text-xs font-bold text-indigo-200">
                          {item.ticker.slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-white">{item.ticker}</span>
                            <span className="rounded-full border border-white/[0.10] px-2 py-0.5 text-[10px] font-medium text-white/38">
                              {item.exchange}
                            </span>
                          </span>
                          <span className="block truncate text-sm text-white/45">{item.name}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-white/28" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {phase === "workflow" && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="h-full px-5 py-5 sm:px-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/36">Workflow</p>
                  <p className="mt-1 text-sm font-semibold text-white">{selectedTicker.ticker} research run</p>
                </div>
                <span className="rounded-full border border-indigo-primary/30 bg-indigo-primary/10 px-3 py-1 text-xs font-semibold text-indigo-200">
                  live
                </span>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.10]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-primary via-sky-400 to-emerald-300"
                  animate={{ width: `${((activeStep + 1) / DEMO_WORKFLOW_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>

              <div className="mt-3 space-y-1">
                {DEMO_WORKFLOW_STEPS.map((step, index) => {
                  const done = index < activeStep;
                  const active = index === activeStep;
                  const future = index > activeStep;

                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-3 rounded-xl px-3 py-1.5 transition-colors ${
                        active ? "bg-indigo-primary/13 text-white" : future ? "text-white/24" : "text-white/55"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : active ? (
                        <CircleDotDashed className="h-4 w-4 shrink-0 animate-spin text-indigo-200" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-white/22" />
                      )}
                      <span className="flex-1 text-[13px] font-semibold">{step}</span>
                      {active && <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">processing</span>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {phase === "analysis" && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="h-full px-5 py-5 sm:px-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Analysis complete
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("search");
                    setShowSuggestions(true);
                  }}
                  className="text-xs font-semibold text-white/40 transition-colors hover:text-white"
                >
                  New run
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-primary/18 text-indigo-100">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/34">Final report</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      {selectedTicker.ticker}: constructive, risk-aware
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/52">
                      Momentum and earnings quality remain supportive, while valuation and headline risk
                      call for disciplined sizing. The workflow favors a staged entry with a defined risk limit.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {["Positive news tone", "Quality trend intact", "Risk review passed"].map((item) => (
                    <div key={item} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-xs font-medium text-white/58">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-white/42">Portfolio action</span>
                  <span className="font-semibold text-indigo-200">Watchlist + staged entry</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.10]">
                  <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-indigo-primary to-emerald-300" />
                </div>
                <p className="mt-3 text-xs leading-5 text-white/34">
                  Demo output only. Not investment advice.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Samples ── */
function SamplesSection() {
  const [activeTab, setActiveTab] = useState(SAMPLES[0].id);
  const activeSample = SAMPLES.find((s) => s.id === activeTab)!;

  return (
    <section id="samples" className="landing-samples relative z-10 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h2 className="font-heading text-4xl font-medium tracking-tight text-white sm:text-5xl">Samples</h2>
        </motion.div>

        {/* Pill tabs */}
        <motion.nav
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 flex justify-center"
          role="tablist"
          aria-label="Sample tabs"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] p-1">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeTab === s.id}
                onClick={() => setActiveTab(s.id)}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  activeTab === s.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </motion.nav>

        {/* Conversation */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-1"
        >
          {activeSample.messages.map((msg, i) => (
            <div
              key={i}
              className={`landing-sample-message rounded-lg px-6 py-5 ${
                msg.role === "user"
                  ? "landing-sample-user bg-white/[0.04]"
                  : "landing-sample-advisor bg-indigo-500/[0.06]"
              }`}
            >
              <div className="mb-1.5 text-sm font-bold text-white/50">
                {msg.role === "user" ? "User" : "Quantum Advisor"}
              </div>
              <Markdown
                content={sampleMarkdown(msg.text)}
                className="landing-sample-markdown text-sm leading-relaxed text-white/75"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ── Features ── */
function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="mb-16 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Capabilities</span>
          <h2 className="mt-4 font-heading text-4xl font-medium tracking-tight text-white sm:text-5xl">Built for intelligent investing</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/40">Six core modules working together — from natural-language chat to quantum optimization — giving you a complete AI-powered financial workspace.</p>
        </motion.div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.07 }} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04]">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-indigo-400 transition-colors group-hover:bg-indigo-500/10 group-hover:text-indigo-300"><f.icon className="h-5 w-5" /></div>
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/40">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ── */
function PricingSection() {
  return (
    <section id="pricing" className="landing-pricing relative z-10 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-16 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Pricing</span>
          <h2 className="mt-4 font-heading text-4xl font-medium tracking-tight text-white sm:text-5xl">Choose your plan</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/40">Research, analytics, backtesting, journaling, and risk-management tools — pick the tier that fits your workflow.</p>
        </motion.div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.filter((p) => p.id !== "execution").map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>

        {/* Execution add-on */}
        {(() => { const exec = PLANS.find((p) => p.id === "execution")!; return (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} className="landing-execution-card mx-auto mt-8 max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 text-center">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400"><Lock className="h-3 w-3" /> Invite Only</div>
            <h3 className="text-lg font-bold text-white">{exec.name} <span className="text-white/40">— {exec.subtitle}</span></h3>
            <p className="mt-2 text-sm text-white/40">{exec.description}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">{exec.features.map((f) => (<span key={f} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50">{f}</span>))}</div>
            <button type="button" className="mt-6 inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.08] hover:text-white">{exec.ctaLabel}</button>
          </motion.div>
        ); })()}

        {/* Comparison table */}
        <ComparisonTable />

        {/* Disclaimer */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="landing-disclaimer mx-auto mt-16 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-center text-xs leading-relaxed text-white/30">
          This platform provides research, analytics, backtesting, journaling, and risk-management tools. It does not provide personalized financial advice, does not guarantee returns, and should not be used as the sole basis for investment decisions.
        </motion.div>
      </div>
    </section>
  );
}

function PlanCard({ plan, index }: { plan: typeof PLANS[number]; index: number }) {
  const isRecommended = plan.highlighted;
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`landing-plan-card relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isRecommended
          ? "border-indigo-500/40 bg-gradient-to-b from-indigo-500/[0.08] to-transparent shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_20px_60px_rgba(99,102,241,0.12)] hover:shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_24px_70px_rgba(99,102,241,0.16)]"
          : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.1] hover:bg-white/[0.04]"
      }`}
    >
      {isRecommended && (
        <div className="on-accent absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]">Popular</div>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        <p className="text-sm text-white/40">{plan.subtitle}</p>
      </div>
      <div className="mb-4">
        <span className="text-4xl font-bold text-white">{plan.priceLabel}</span>
        {plan.priceNote && <span className="ml-2 text-sm text-white/35">{plan.priceNote}</span>}
      </div>
      <p className="mb-6 text-sm leading-relaxed text-white/40">{plan.description}</p>
      <ul className="mb-8 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> {f}
          </li>
        ))}
      </ul>
      <button type="button" className={`landing-plan-cta h-11 w-full rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
        isRecommended
          ? "on-accent bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] hover:bg-indigo-400"
          : "border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
      }`}>{plan.ctaLabel}</button>
    </motion.div>
  );
}

/* ── Comparison Table ── */
function ComparisonTable() {
  const planIds: PlanId[] = ["free", "pro", "trader", "quant", "execution"];
  const planLabels = ["Free", "Pro", "Trader", "Quant", "Execution"];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="landing-comparison mt-24">
      <h3 className="mb-8 text-center font-heading text-2xl font-bold text-white">Compare plans</h3>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-4 text-left font-medium text-white/50">Feature</th>
              {planLabels.map((label, i) => (
                <th key={label} className={`px-4 py-4 text-center font-semibold ${planIds[i] === "trader" ? "text-indigo-400" : "text-white/70"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_TABLE.map((row, i) => (
              <tr key={row.feature} className={`border-b border-white/[0.04] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-5 py-3 text-white/55">{row.feature}</td>
                {planIds.map((pid) => { const val = row[pid] as CheckState; return (
                  <td key={pid} className="px-4 py-3 text-center">
                    {val === true ? <Check className="mx-auto h-4 w-4 text-indigo-400" /> : val === false ? <span className="text-white/15">—</span> : <span className="text-white/50">{val}</span>}
                  </td>
                ); })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
