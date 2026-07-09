"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, FileText, Search, Shield, TrendingUp } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

import { trackLandingEvent } from "./landing-analytics";

const JOURNEY_STEPS = [
  {
    id: "ask",
    label: "Ask",
    title: "Start with the decision, not a dashboard.",
    body: "Ask whether a ticker, position, or portfolio action deserves attention. Quanfora keeps the prompt tied to a research run instead of scattering context across tools.",
    icon: Search,
    frameTitle: "Should I add NVDA here?",
    frameBody: "Ticker recognized. Position context attached. Research depth set to Overall.",
    bullets: ["Ticker and intent detected", "Portfolio context optional", "No trade framed without evidence"],
  },
  {
    id: "evidence",
    label: "Evidence",
    title: "Pull market, news, sentiment, and model signals into one view.",
    body: "The workspace explains what changed, where the evidence came from, and which parts are supportive, neutral, or conflicting.",
    icon: FileText,
    frameTitle: "Evidence board",
    frameBody: "Price action, headlines, valuation context, and model direction are grouped before any conclusion appears.",
    bullets: ["Market overall first", "Sources and assumptions visible", "Illustrative demo data clearly labeled"],
  },
  {
    id: "risk",
    label: "Risk",
    title: "Make risk visible before action.",
    body: "Risk checks sit between the evidence and the final signal, so momentum, concentration, valuation, and portfolio exposure do not get buried.",
    icon: Shield,
    frameTitle: "Risk review",
    frameBody: "Concentration, volatility, and downside scenarios are checked before the recommendation summary is shown.",
    bullets: ["Position sizing guardrails", "Concentration warnings", "Bear case remains visible"],
  },
  {
    id: "decision",
    label: "Decision",
    title: "End with a documented decision trail.",
    body: "Quanfora returns a scannable answer for quick decisions and enough structure for deeper review, while leaving final judgment with the user.",
    icon: TrendingUp,
    frameTitle: "Decision summary",
    frameBody: "Overall signal, rationale, and follow-up actions are packaged into a research note you can revisit.",
    bullets: ["Final signal summarized", "Follow-up questions preserved", "Not professional financial advice"],
  },
] as const;

type JourneyStep = (typeof JOURNEY_STEPS)[number];

export function ResearchJourney() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedSteps = useRef(new Set<string>());

  const handleStepVisible = useCallback((index: number) => {
    const step = JOURNEY_STEPS[index];
    setActiveIndex(index);

    if (trackedSteps.current.has(step.id)) return;
    trackedSteps.current.add(step.id);
    trackLandingEvent("landing_journey_step_view", {
      step_id: step.id,
      step_label: step.label,
      step_index: index,
    });
  }, []);

  const activeStep = JOURNEY_STEPS[activeIndex];

  return (
    <section id="equity-research-demo" className="research-intro-demo relative z-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-semibold uppercase text-white/34">Research journey</p>
            <h2 className="mt-5 font-heading text-4xl font-normal leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ask. Evidence. Risk.
              <br />
              <span className="text-white/45">Decision.</span>
            </h2>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/44">
              One disciplined path from market question to evidence-backed conclusion. No second workflow, no ornamental motion, no unsupported live-data claims.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                data-analytics-id="landing-journey-launch-app"
                onClick={() => {
                  trackLandingEvent("landing_launch_app_click", { location: "journey_cta" });
                  window.localStorage.setItem("financial-advisor.coverSeen", "true");
                  window.location.href = "/session";
                }}
                className="intro-primary-action inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080b]"
              >
                Launch App <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#samples"
                data-analytics-id="landing-journey-view-samples"
                onClick={() => trackLandingEvent("landing_sample_research_click", { location: "journey_secondary" })}
                className="research-docs-link inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080b]"
              >
                View sample research
              </a>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.74fr_1fr] lg:items-start">
            <div className="relative order-2 grid gap-4 lg:order-1 lg:pb-[18vh]">
              <div className="absolute bottom-8 left-5 top-8 hidden w-px bg-white/[0.08] lg:block" aria-hidden="true">
                <motion.div
                  className="h-full origin-top bg-indigo-primary"
                  animate={{ scaleY: (activeIndex + 1) / JOURNEY_STEPS.length }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
                />
              </div>
              {JOURNEY_STEPS.map((step, index) => (
                <JourneyStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  active={index === activeIndex}
                  onVisible={handleStepVisible}
                />
              ))}
            </div>

            <div className="order-1 lg:sticky lg:top-28 lg:order-2 lg:self-start">
              <ResearchJourneyFrame step={activeStep} reduceMotion={Boolean(reduceMotion)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function JourneyStepCard({
  step,
  index,
  active,
  onVisible,
}: {
  step: JourneyStep;
  index: number;
  active: boolean;
  onVisible: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-42% 0px -42% 0px" });
  const Icon = step.icon;

  useEffect(() => {
    if (inView) onVisible(index);
  }, [inView, index, onVisible]);

  return (
    <div
      ref={ref}
      data-analytics-id={`landing-journey-step-${step.id}`}
      className={`research-journey-step relative rounded-2xl border p-5 transition-colors duration-200 lg:ml-10 ${
        active
          ? "border-indigo-primary/34 bg-indigo-primary/[0.08]"
          : "border-white/[0.08] bg-white/[0.025]"
      }`}
    >
      <div className="absolute -left-[2.35rem] top-5 hidden size-10 place-items-center rounded-full border border-white/[0.10] bg-[#07080b] text-white/50 lg:grid">
        <Icon className={`h-4 w-4 ${active ? "text-indigo-200" : ""}`} />
      </div>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.10] bg-white/[0.04] text-white/60 lg:hidden">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-200">{step.label}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-white">{step.title}</h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/50">{step.body}</p>
    </div>
  );
}

function ResearchJourneyFrame({ step, reduceMotion }: { step: JourneyStep; reduceMotion: boolean }) {
  const Icon = step.icon;

  return (
    <div className="research-window-demo relative overflow-hidden rounded-[1.35rem] bg-[#050609] text-[#ffffff] shadow-[0_24px_70px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="relative flex h-11 items-center justify-between border-b border-[#ffffff14] px-8">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="pointer-events-none absolute left-1/2 top-1/2 max-w-[56%] -translate-x-1/2 -translate-y-1/2 truncate text-sm font-normal text-[#ffffff6b]">
          Quanfora Research
        </span>
        <span className="text-sm font-normal text-[#ffffff57]">Overall</span>
      </div>

      <div className="min-h-[440px] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {JOURNEY_STEPS.map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.id === step.id
                  ? "bg-indigo-primary/18 text-indigo-100"
                  : "border border-white/[0.08] text-white/34"
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-primary/18 text-indigo-100">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/34">{step.label}</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">{step.frameTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/52">{step.frameBody}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {step.bullets.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-sm text-white/58">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/42">Market overall</span>
                <span className="font-semibold text-indigo-200">Evidence before signal</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.10]">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-indigo-primary to-emerald-300"
                  initial={reduceMotion ? false : { scaleX: 0.2 }}
                  animate={{ scaleX: step.id === "decision" ? 0.92 : step.id === "risk" ? 0.74 : step.id === "evidence" ? 0.56 : 0.34 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/34">
                Illustrative demo only. Quanfora provides AI-generated research, not professional financial advice.
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
