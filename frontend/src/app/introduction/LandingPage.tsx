"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Atom, Brain, Check, Lock, MessageSquare, PieChart, Shield, TrendingUp, X } from "lucide-react";

import { COMPARISON_TABLE, PLANS, type CheckState, type PlanId } from "@/config/plans";
import Markdown from "@/components/ui/markdown";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TestimonialsMinimal } from "@/components/ui/minimal-testimonial";

import { IntroductionFooter, IntroductionNav } from "./components";
import { HeroSection } from "./components/HeroSection";
import { ProductPreview } from "./components/ProductPreview";
import { ResearchJourney } from "./components/ResearchJourney";
import { SectionReveal } from "./components/SectionReveal";
import { trackLandingEvent } from "./components/landing-analytics";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Conversational AI Advisor",
    desc: "Ask anything about markets, stocks, or portfolios. Powered by a LangGraph ReAct agent with real-time tool access.",
    details: [
      "Ask market, portfolio, and research questions in natural language while the workspace keeps the thread tied to the evidence behind each answer.",
      "The advisor is designed for decision support: it can summarize data, surface assumptions, and keep follow-up research attached to the same workflow.",
    ],
  },
  {
    icon: Brain,
    title: "FinBERT Sentiment Analysis",
    desc: "Gauge market mood with state-of-the-art NLP, analyzing news headlines and social signals in seconds.",
    details: [
      "Track whether the narrative around a ticker is improving, deteriorating, or staying neutral across recent headlines and market commentary.",
      "Sentiment is treated as one research signal, not a standalone verdict, so it can be weighed beside fundamentals, risk, and portfolio context.",
    ],
  },
  {
    icon: PieChart,
    title: "Classical Portfolio Optimization",
    desc: "Markowitz mean-variance optimization for allocation, risk budgeting, and efficient frontier analysis.",
    details: [
      "Model allocations with familiar portfolio theory, including expected return, volatility, and risk-adjusted tradeoffs.",
      "Use the output to compare current allocations against cleaner alternatives before committing capital.",
    ],
  },
  {
    icon: Atom,
    title: "Quantum Portfolio Optimization",
    desc: "QAOA-powered combinatorial selection on simulated quantum hardware for next-gen asset allocation.",
    details: [
      "Explore portfolio construction as a combinatorial optimization problem when the asset universe or constraints become harder to inspect manually.",
      "Quantum workflows are presented as research tools, with transparent outputs that can be compared against classical optimization baselines.",
    ],
  },
  {
    icon: TrendingUp,
    title: "ML Stock Prediction",
    desc: "Random Forest and LSTM models for price direction forecasting, trained on real historical data.",
    details: [
      "Forecasting modules help identify directional signals from historical data, then frame those signals with uncertainty and risk context.",
      "Outputs are meant to support a research trail rather than replace trader judgment or portfolio discipline.",
    ],
  },
  {
    icon: Shield,
    title: "RAG-Augmented Memory",
    desc: "Retrieval-augmented generation with Qdrant vector store for grounded, citation-backed financial insights.",
    details: [
      "Keep research grounded in prior notes, saved context, and relevant documents so answers do not float away from the source material.",
      "Memory-backed retrieval helps repeated workflows stay consistent while preserving the ability to inspect what shaped an answer.",
    ],
  },
];

const SAMPLES = [
  {
    id: "market",
    label: "Market analysis",
    messages: [
      { role: "user", text: "Should I add to NVDA here, or wait?" },
      {
        role: "advisor",
        text:
          "Illustrative demo output. Market overall: NVDA is shown with constructive momentum, but the setup is not clean enough to ignore risk.\n\nKey evidence:\n- Price action is above the main trend averages in this sample.\n- AI infrastructure headlines are supportive, but expectations remain high.\n- Valuation risk is the main constraint on position sizing.\n\nDecision frame: constructive watchlist candidate. A staged entry with a defined stop is cleaner than buying a full position at once.",
      },
      { role: "user", text: "How does that compare to AMD and INTC?" },
      {
        role: "advisor",
        text:
          "Illustrative peer view:\n\n| Metric | NVDA | AMD | INTC |\n|--------|------|-----|------|\n| Growth profile | Strong | Moderate | Rebuilding |\n| Margin quality | High | Mid | Pressured |\n| Valuation risk | High | Medium | Lower |\n| Execution risk | Medium | Medium | High |\n\nNVDA leads on quality and growth in this demo, AMD is a secondary AI exposure with less narrative concentration, and INTC screens as a higher-risk turnaround.",
      },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio optimization",
    messages: [
      { role: "user", text: "I have $50K split equally between AAPL, MSFT, GOOGL, AMZN, and TSLA. Can you optimize this?" },
      {
        role: "advisor",
        text:
          "Illustrative demo output. The equal-weight portfolio is concentrated in mega-cap technology, so the first issue is risk balance rather than expected return.\n\nCurrent allocation:\n- Equal 20% weight across five large-cap technology names.\n- High growth-factor exposure.\n- Limited diversification benefit when tech sells off together.\n\nOptimized direction:\n- Raise weights in steadier cash-flow names.\n- Reduce the most volatile sleeve.\n- Keep a small allocation to the highest-beta holding rather than removing it completely.\n\nResult: the sample optimizer improves risk-adjusted balance while preserving tech upside.",
      },
      { role: "user", text: "Can you also run the quantum optimizer on this?" },
      {
        role: "advisor",
        text:
          "Illustrative quantum workflow: QAOA explores allocation combinations under the same constraints, then compares the result against the classical optimizer.\n\nFor a five-stock portfolio, the classical result remains sufficient. The quantum path is more useful when the asset universe and constraints become harder to inspect manually.",
      },
    ],
  },
  {
    id: "sentiment",
    label: "Sentiment check",
    messages: [
      { role: "user", text: "What is the market sentiment for semiconductors?" },
      {
        role: "advisor",
        text:
          "Illustrative demo output. Market overall: semiconductor tone is constructive but crowded.\n\nPositive drivers:\n- AI infrastructure demand remains the dominant narrative.\n- Data-center spending commentary is supportive.\n- Quality leaders continue to receive premium attention.\n\nNegative signals:\n- Export restrictions remain a headline risk.\n- Valuation stretch makes the group sensitive to guidance misses.\n- Memory-cycle concerns can pressure weaker names.\n\nDecision frame: bullish narrative, but avoid treating sector sentiment as a standalone buy signal.",
      },
      { role: "user", text: "What changed from the prior review?" },
      {
        role: "advisor",
        text:
          "The sample report shows sentiment improving from mildly constructive to broadly constructive. The change comes from stronger AI demand commentary and fewer supply-chain concerns.\n\nRisk note: when a sector narrative becomes this consensus, position sizing matters more than headline direction.",
      },
    ],
  },
  {
    id: "risk",
    label: "Risk assessment",
    messages: [
      { role: "user", text: "Can you run a risk analysis on my tech-heavy portfolio?" },
      {
        role: "advisor",
        text:
          "Illustrative demo output. Market overall: the portfolio has strong upside participation, but concentration is the dominant risk.\n\nRisk findings:\n- Sector concentration: technology dominates the portfolio.\n- Factor exposure: growth and momentum drive most of the return path.\n- Drawdown risk: correlations can rise quickly during market stress.\n\nRecommendations:\n- Add two or three non-tech sectors for diversification.\n- Define a maximum drawdown tolerance before adding more exposure.\n- Keep cash or defensive allocation available for volatility.",
      },
    ],
  },
];

function sampleMarkdown(content: string) {
  return content.replace(/^•\s+/gm, "- ");
}

export default function IntroductionPage() {
  return (
    <div className="relative min-h-screen">
      <IntroductionNav />
      <HeroSection />
      <ProductPreview />
      <ResearchJourney />
      <SamplesSection />
      <TestimonialsMinimal />
      <FeaturesSection />
      <PricingSection />
      <IntroductionFooter />
    </div>
  );
}

function SamplesSection() {
  const [activeTab, setActiveTab] = useState(SAMPLES[0].id);
  const activeSample = SAMPLES.find((sample) => sample.id === activeTab)!;

  return (
    <section id="samples" className="landing-samples relative z-10 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionReveal className="mb-10 text-center">
          <span className="inline-flex rounded-full border border-white/[0.10] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
            Illustrative demo
          </span>
          <h2 className="mt-5 font-heading text-4xl font-medium tracking-tight text-white sm:text-5xl">Sample Research</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/42">
            These examples show response structure and product behavior. Values are illustrative, not live market data.
          </p>
        </SectionReveal>

        <nav className="mb-8 flex justify-center" role="tablist" aria-label="Sample tabs">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/[0.08] p-1">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                role="tab"
                aria-selected={activeTab === sample.id}
                data-analytics-id={`landing-sample-tab-${sample.id}`}
                onClick={() => {
                  setActiveTab(sample.id);
                  trackLandingEvent("landing_sample_research_click", {
                    location: "sample_tabs",
                    sample_id: sample.id,
                  });
                }}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  activeTab === sample.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </nav>

        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }} className="flex flex-col gap-1">
          {activeSample.messages.map((message, index) => (
            <div
              key={`${activeSample.id}-${index}`}
              className={`landing-sample-message rounded-lg px-6 py-5 ${
                message.role === "user" ? "landing-sample-user bg-white/[0.04]" : "landing-sample-advisor bg-indigo-500/[0.06]"
              }`}
            >
              <div className="mb-1.5 text-sm font-bold text-white/50">
                {message.role === "user" ? "User" : "Quanfora"}
              </div>
              <Markdown content={sampleMarkdown(message.text)} className="landing-sample-markdown text-sm leading-relaxed text-white/75" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [selectedFeature, setSelectedFeature] = useState<(typeof FEATURES)[number] | null>(null);

  useEffect(() => {
    if (!selectedFeature) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedFeature(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFeature]);

  return (
    <section id="features" className="relative z-10 px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.35fr_0.9fr] lg:items-center">
        <SectionReveal className="text-center lg:order-2 lg:text-right">
          <span className="text-xs font-semibold uppercase tracking-[0.34em] text-indigo-primary">Capabilities</span>
          <h2 className="mt-6 font-heading text-4xl font-medium leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Built for intelligent investing
          </h2>
          <p className="ml-auto mt-8 max-w-md text-lg leading-8 text-white/42">
            Six core modules working together from natural-language chat to quantum optimization, giving you a complete AI-powered financial workspace.
          </p>
        </SectionReveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:order-1">
          {FEATURES.map((feature) => (
            <button
              key={feature.title}
              type="button"
              onClick={() => setSelectedFeature(feature)}
              className="landing-feature-card group relative min-h-[230px] rounded-lg border border-indigo-primary/16 bg-white/[0.02] p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:border-indigo-primary/40 hover:bg-indigo-primary/[0.035] hover:shadow-[0_22px_70px_rgba(99,102,241,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/60"
            >
              <div className="landing-feature-icon mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-primary/18 bg-indigo-primary/[0.12] text-indigo-primary transition-colors group-hover:bg-indigo-primary/[0.18] group-hover:text-indigo-200">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="landing-feature-title text-xl font-semibold leading-tight text-white">{feature.title}</h3>
              <p className="landing-feature-desc mt-5 text-base leading-7 text-white/46">{feature.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedFeature && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedFeature(null)}
          >
            <motion.div
              className="feature-dialog relative max-h-[90vh] w-full max-w-[520px] overflow-hidden rounded-xl border border-indigo-primary/22 bg-[#0b0c10] text-white shadow-[0_30px_90px_rgba(0,0,0,0.58),0_0_0_1px_rgba(99,102,241,0.10)]"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <ScrollArea className="max-h-[90vh]">
                <div className="p-7">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-primary/22 bg-indigo-primary/[0.14] text-indigo-primary">
                    <selectedFeature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-7 text-2xl font-semibold leading-tight text-white">{selectedFeature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-white/54">{selectedFeature.desc}</p>
                  <div className="mt-7 space-y-5 text-sm leading-7 text-white/66">
                    {selectedFeature.details.map((detail) => (
                      <p key={detail}>{detail}</p>
                    ))}
                  </div>
                </div>
              </ScrollArea>
              <button
                type="button"
                aria-label="Close capability details"
                onClick={() => setSelectedFeature(null)}
                className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-white/48 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/60"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function PricingSection() {
  const executionPlan = PLANS.find((plan) => plan.id === "execution")!;

  return (
    <section id="pricing" className="landing-pricing relative z-10 px-4 py-6 sm:px-6">
      <div className="landing-pricing-frame relative mx-auto max-w-[1360px] overflow-hidden rounded-[1.45rem] px-6 py-20 shadow-[0_38px_120px_rgba(0,0,0,0.36)] sm:px-10 sm:py-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pay-background.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pay-background-2.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,11,0.58),rgba(7,8,11,0.80)),radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_42%)]" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl">
          <SectionReveal className="mb-16 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Pricing</span>
            <h2 className="mt-4 font-heading text-4xl font-medium tracking-tight text-white sm:text-5xl">Choose your plan</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/40">
              Research, analytics, backtesting, journaling, and risk-management tools - pick the tier that fits your workflow.
            </p>
          </SectionReveal>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.filter((plan) => plan.id !== "execution").map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>

          <div className="landing-execution-card mx-auto mt-8 max-w-2xl rounded-2xl border border-white/[0.10] bg-[#0f1117] p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              <Lock className="h-3 w-3" /> Invite Only
            </div>
            <h3 className="text-lg font-bold text-white">
              {executionPlan.name} <span className="text-white/40">- {executionPlan.subtitle}</span>
            </h3>
            <p className="mt-2 text-sm text-white/40">{executionPlan.description}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {executionPlan.features.map((feature) => (
                <span key={feature} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50">
                  {feature}
                </span>
              ))}
            </div>
            <button type="button" className="mt-6 inline-flex h-10 items-center rounded-xl border border-white/[0.10] bg-[#171a23] px-6 text-sm font-medium text-white/70 transition-all hover:bg-[#202432] hover:text-white">
              {executionPlan.ctaLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-2 sm:px-4">
        <ComparisonTable />
        <div className="landing-disclaimer mx-auto mt-16 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-center text-xs leading-relaxed text-white/30">
          This platform provides research, analytics, backtesting, journaling, and risk-management tools. It does not provide personalized financial advice, does not guarantee returns, and should not be used as the sole basis for investment decisions.
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: typeof PLANS[number] }) {
  const isRecommended = plan.highlighted;

  return (
    <div
      className={`landing-plan-card relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
        isRecommended
          ? "border-indigo-500/55 bg-[#101225] shadow-[0_0_0_1px_rgba(99,102,241,0.24),0_20px_60px_rgba(99,102,241,0.16)] hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.48),0_28px_82px_rgba(99,102,241,0.28)]"
          : "border-white/[0.10] bg-[#0f1117] shadow-[0_18px_58px_rgba(0,0,0,0.18)] hover:-translate-y-1 hover:border-indigo-primary/45 hover:bg-[#141827] hover:shadow-[0_24px_76px_rgba(0,0,0,0.28),0_0_32px_rgba(99,102,241,0.12)]"
      }`}
    >
      {isRecommended && (
        <div className="on-accent absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]">
          Popular
        </div>
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
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-white/60">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`landing-plan-cta h-11 w-full rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
          isRecommended
            ? "on-accent bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] hover:bg-indigo-400"
            : "border border-white/[0.10] bg-[#171a23] text-white/70 hover:bg-[#202432] hover:text-white"
        }`}
      >
        {plan.ctaLabel}
      </button>
    </div>
  );
}

function ComparisonTable() {
  const planIds: PlanId[] = ["free", "pro", "trader", "quant", "execution"];
  const planLabels = ["Free", "Pro", "Trader", "Quant", "Execution"];

  return (
    <div className="landing-comparison mt-24">
      <h3 className="mb-8 text-center font-heading text-2xl font-bold text-white">Compare plans</h3>
      <HorizontalScroll className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-4 text-left font-medium text-white/50">Feature</th>
              {planLabels.map((label, index) => (
                <th key={label} className={`px-4 py-4 text-center font-semibold ${planIds[index] === "trader" ? "text-indigo-400" : "text-white/70"}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_TABLE.map((row, index) => (
              <tr key={row.feature} className={`border-b border-white/[0.04] ${index % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-5 py-3 text-white/55">{row.feature}</td>
                {planIds.map((planId) => {
                  const value = row[planId] as CheckState;

                  return (
                    <td key={planId} className="px-4 py-3 text-center">
                      {value === true ? (
                        <Check className="mx-auto h-4 w-4 text-indigo-400" />
                      ) : value === false ? (
                        <span className="text-white/15">-</span>
                      ) : (
                        <span className="text-white/50">{value}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScroll>
    </div>
  );
}
