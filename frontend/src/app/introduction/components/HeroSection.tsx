"use client";

import { ArrowRight, FileText } from "lucide-react";

import { trackLandingEvent } from "./landing-analytics";

export function HeroSection() {
  const handleLaunchApp = () => {
    trackLandingEvent("landing_launch_app_click", { location: "hero_primary" });
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    window.location.href = "/session";
  };

  return (
    <section className="relative z-10 flex min-h-[70dvh] items-center justify-center px-6 pb-2 pt-24 text-center sm:min-h-[58dvh] sm:px-8 sm:pb-4 sm:pt-28">
      <div className="mx-auto w-full max-w-5xl">
        <div>
          <span className="inline-flex items-center rounded-full border border-white/[0.12] px-4 py-1.5 text-xs font-medium text-white/55">
            AI + Quantum Finance
          </span>
        </div>
        <h1 className="mt-6 font-heading text-[2.5rem] font-normal leading-none text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Quantum Financial Advisor Platform
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-white/50 sm:text-lg">
          The art of structured AI research, risk analysis, and portfolio workflows for disciplined market decisions.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleLaunchApp}
            data-analytics-id="landing-hero-launch-app"
            className="intro-primary-action group inline-flex h-12 items-center gap-2.5 rounded-full px-7 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Launch App <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <a
            href="#samples"
            data-analytics-id="landing-hero-sample-research"
            onClick={() => trackLandingEvent("landing_sample_research_click", { location: "hero_secondary" })}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/[0.14] px-6 text-sm font-medium text-white/66 transition-colors hover:border-white/28 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <FileText className="h-4 w-4" />
            View Sample Research
          </a>
        </div>
      </div>
    </section>
  );
}
