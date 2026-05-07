"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight, Brain, Atom, TrendingUp, PieChart, MessageSquare,
  Shield, Zap, ExternalLink, ChevronDown, Check, Lock,
} from "lucide-react";
import { PLANS, COMPARISON_TABLE, type PlanId, type CheckState } from "@/config/plans";

/* ───── data ───── */

const FEATURES = [
  { icon: MessageSquare, title: "Conversational AI Advisor", desc: "Ask anything about markets, stocks, or portfolios. Powered by a LangGraph ReAct agent with real-time tool access." },
  { icon: Brain, title: "FinBERT Sentiment Analysis", desc: "Gauge market mood with state-of-the-art NLP, analyzing news headlines and social signals in seconds." },
  { icon: PieChart, title: "Classical Portfolio Optimization", desc: "Markowitz mean-variance optimization for allocation, risk budgeting, and efficient frontier analysis." },
  { icon: Atom, title: "Quantum Portfolio Optimization", desc: "QAOA-powered combinatorial selection on simulated quantum hardware for next-gen asset allocation." },
  { icon: TrendingUp, title: "ML Stock Prediction", desc: "Random Forest and LSTM models for price direction forecasting, trained on real historical data." },
  { icon: Shield, title: "RAG-Augmented Memory", desc: "Retrieval-augmented generation with Qdrant vector store for grounded, citation-backed financial insights." },
];

const TECH_STACK = [
  "Next.js", "React 19", "Tailwind CSS", "shadcn/ui", "Framer Motion",
  "Python", "FastAPI", "LangChain", "LangGraph", "Gemini AI",
  "FinBERT", "PyTorch", "Qiskit", "Qdrant", "Supabase", "Stripe",
];

/* ───── page ───── */

export default function IntroductionPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="relative min-h-screen">
      {/* ambient bg */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-indigo-600/[0.07] blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[600px] w-[600px] translate-x-1/3 rounded-full bg-cyan-500/[0.05] blur-[100px]" />
      </div>

      <Nav />

      {/* hero */}
      <section ref={heroRef} className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur-md">
              <Zap className="h-3.5 w-3.5 text-indigo-400" /> AI + Quantum Finance
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent">Quantum Financial</span><br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">Advisor</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/50 sm:text-xl">
            An intelligent financial advisor that combines quantum-inspired optimization, real-time sentiment analysis, and conversational AI to deliver data-driven market insights.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="/" className="group inline-flex h-12 items-center gap-2.5 rounded-xl bg-indigo-500 px-7 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_8px_28px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:bg-indigo-400 active:scale-[0.98]">
              Launch App <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="https://github.com/MichaelLeHoang/Financial-Advisor-Agent" target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-7 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:bg-white/[0.08] hover:text-white">
              View on GitHub <ExternalLink className="h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute bottom-10 flex flex-col items-center gap-2 text-white/25">
          <span className="text-[11px] uppercase tracking-widest">Scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </motion.div>
      </section>

      <ProductShowcase />
      <FeaturesSection />
      <PricingSection />
      <TechSection />
      <Footer />
    </div>
  );
}

/* ── Nav ── */
function Nav() {
  return (
    <motion.nav initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="fixed left-0 right-0 top-0 z-50 px-6 py-4 sm:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-2.5 backdrop-blur-xl">
        <a href="/introduction" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_6px_16px_rgba(99,102,241,0.25)]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white/80">Quantum Advisor</span>
        </a>
        <div className="hidden items-center gap-6 sm:flex">
          <a href="#features" className="text-sm text-white/40 transition-colors hover:text-white">Features</a>
          <a href="#pricing" className="text-sm text-white/40 transition-colors hover:text-white">Pricing</a>
          <a href="#tech" className="text-sm text-white/40 transition-colors hover:text-white">Stack</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block">Log in</a>
          <a href="/" className="inline-flex h-9 items-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_4px_12px_rgba(99,102,241,0.25)] transition-all hover:bg-indigo-400">
            Open App
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

/* ── Product Showcase ── */
function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.88, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [60, 0]);
  return (
    <section ref={ref} className="relative z-10 px-6 pb-32">
      <motion.div style={{ scale, y }} className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_40px_100px_rgba(0,0,0,0.5),0_0_80px_rgba(99,102,241,0.08)]">
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[#0c0d14] via-[#111225] to-[#0a0b10]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cover-screenshot.png" alt="Dashboard preview" className="h-full w-full object-cover object-top opacity-90" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement!.classList.add("placeholder-active"); }} />
          <div className="placeholder-overlay absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/20">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]"><Zap className="h-10 w-10" /></div>
            <div className="text-center"><p className="text-sm font-medium text-white/30">Product Screenshot</p><p className="mt-1 text-xs text-white/15">Place your image at /public/cover-screenshot.png</p></div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050507] to-transparent" />
        </div>
      </motion.div>
      <style jsx>{`div:not(.placeholder-active) > .placeholder-overlay { display: none; } .placeholder-active > .placeholder-overlay { display: flex; }`}</style>
    </section>
  );
}

/* ── Features ── */
function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="mb-16 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Capabilities</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">Built for intelligent investing</h2>
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
    <section id="pricing" className="relative z-10 px-6 py-32">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-16 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Pricing</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">Choose your plan</h2>
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
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 text-center">
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
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mx-auto mt-16 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-center text-xs leading-relaxed text-white/30">
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
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isRecommended
          ? "border-indigo-500/40 bg-gradient-to-b from-indigo-500/[0.08] to-transparent shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_20px_60px_rgba(99,102,241,0.12)] hover:shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_24px_70px_rgba(99,102,241,0.16)]"
          : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.1] hover:bg-white/[0.04]"
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]">Popular</div>
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
      <button type="button" className={`h-11 w-full rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
        isRecommended
          ? "bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] hover:bg-indigo-400"
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
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-24">
      <h3 className="mb-8 text-center text-2xl font-bold text-white">Compare plans</h3>
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

/* ── Tech Stack ── */
function TechSection() {
  return (
    <section id="tech" className="relative z-10 px-6 py-32">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Technology</span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">Modern full-stack architecture</h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/40">Built with production-grade tools across frontend, backend, AI/ML, and infrastructure.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }} className="mt-12 flex flex-wrap justify-center gap-3">
          {TECH_STACK.map((tech, i) => (
            <motion.span key={tech} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.05 * i }} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/55 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80">{tech}</motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400"><Zap className="h-3.5 w-3.5 text-white" /></div>
          <span className="text-sm text-white/40">Quantum Financial Advisor</span>
        </div>
        <p className="text-xs text-white/25">AI-generated analysis only. Not professional financial advice. © 2026 Michael Le.</p>
      </div>
    </footer>
  );
}
