"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { trackLandingEvent } from "./landing-analytics";

const heroMorphingPhrases = [
  "structured AI research",
  "evidence-first analysis",
  "measured portfolio risk",
  "disciplined market decisions",
];

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const entranceInitial = reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 };
  const entranceAnimate = { opacity: 1, y: 0, scale: 1 };
  const entranceTransition = { duration: 0.58, ease: [0.16, 1, 0.3, 1] as const };

  const handleLaunchApp = () => {
    trackLandingEvent("landing_launch_app_click", { location: "hero_primary" });
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    window.location.href = "/session";
  };

  return (
    <section className="relative z-10 flex min-h-[70dvh] items-center justify-center px-6 pb-2 pt-24 text-center sm:min-h-[58dvh] sm:px-8 sm:pb-4 sm:pt-28">
      <div className="mx-auto w-full max-w-5xl">
        <motion.div initial={entranceInitial} animate={entranceAnimate} transition={entranceTransition}>
          <span className="inline-flex items-center rounded-full border border-white/[0.12] px-4 py-1.5 text-xs font-medium text-white/55">
            AI + Quantum Finance
          </span>
        </motion.div>
        <motion.h1
          initial={entranceInitial}
          animate={entranceAnimate}
          transition={{ ...entranceTransition, delay: reduceMotion ? 0 : 0.08 }}
          className="mt-6 font-heading text-[2.5rem] font-normal leading-none text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Quantum Financial Advisor Platform
        </motion.h1>
        <motion.div initial={entranceInitial} animate={entranceAnimate} transition={{ ...entranceTransition, delay: reduceMotion ? 0 : 0.16 }}>
          <HeroMorphingStatement />
        </motion.div>
        <motion.div
          initial={entranceInitial}
          animate={entranceAnimate}
          transition={{ ...entranceTransition, delay: reduceMotion ? 0 : 0.24 }}
          className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <button
            type="button"
            onClick={handleLaunchApp}
            data-analytics-id="landing-hero-launch-app"
            className="intro-primary-action inline-flex h-12 items-center rounded-full px-7 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Launch App
          </button>
          <a
            href="/pricing"
            data-analytics-id="landing-hero-see-plans"
            onClick={() => trackLandingEvent("landing_pricing_click", { location: "hero_secondary" })}
            className="group inline-flex h-12 items-center gap-2 rounded-full border border-white/[0.14] px-6 text-sm font-medium text-white/66 transition-colors hover:border-white/28 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            See our plan
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function HeroMorphingStatement() {
  const reduceMotion = useReducedMotion();

  return (
    <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/50 sm:text-lg">
      <span className="sr-only">The art of disciplined market decisions.</span>
      <span
        aria-hidden="true"
        className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 text-left sm:min-h-[1.75rem] sm:flex-row sm:gap-1.5"
      >
        <span className="shrink-0">The art of</span>
        <span className="hero-morphing-highlight relative inline-grid max-w-full justify-items-start text-indigo-200">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
            disciplined market decisions
          </span>
          <span className="col-start-1 row-start-1 whitespace-nowrap text-left">
            {reduceMotion ? "disciplined market decisions" : <MorphingText phrases={heroMorphingPhrases} />}
          </span>
        </span>
      </span>
    </p>
  );
}

function MorphingText({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIndex((current) => (current + 1) % phrases.length);
    }, index === 0 ? 2200 : 2100);

    return () => window.clearTimeout(timeout);
  }, [index, phrases.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={phrases[index]}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="block"
      >
        {phrases[index]}
      </motion.span>
    </AnimatePresence>
  );
}
