"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  CircleDot,
  Database,
  FlaskConical,
  PieChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { motion, useMotionValue, useTransform } from "motion/react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { loginHref } from "@/lib/workspace-routing";
import {
  PLATFORM_SPECIALISTS,
  PLATFORM_STORY_PHASES,
  resolvePlatformStoryState,
  type PlatformStoryState,
  type SpecialistStatus,
} from "@/lib/platform-story";

import { IntroductionFooter, IntroductionNav } from "../introduction/components";
import { trackLandingEvent } from "../introduction/components/landing-analytics";
import styles from "./platform-overview.module.css";

const SPECIALIST_DETAILS = [
  { icon: FlaskConical, short: "Research", color: "#c084fc", result: "Structural AI demand remains constructive." },
  { icon: BarChart3, short: "Quant", color: "#60a5fa", result: "Momentum is positive, but entry timing is stretched." },
  { icon: Database, short: "Data", color: "#2dd4bf", result: "Evidence quality is moderate with scenario uncertainty." },
  { icon: ShieldCheck, short: "Risk", color: "#fb7185", result: "Full-reserve concentration breaches risk guardrails." },
  { icon: PieChart, short: "Portfolio", color: "#fbbf24", result: "A single position would dominate liquidity and exposure." },
] as const;

const PHASE_DESCRIPTIONS = [
  "Sabi recognizes a high-stakes allocation question and selects the consensus capability.",
  "Five domain specialists inspect the same question independently in a rate-limit-safe sequence.",
  "Structured opinions are weighted, disagreement is preserved, and critical risk flags can change the verdict.",
  "Quanfora turns the result into one readable answer while keeping the evidence and dissent available.",
] as const;

const FINAL_STORY_STATE = resolvePlatformStoryState(1);

function storyStateSignature(state: PlatformStoryState) {
  return `${state.phaseId}:${state.activeSpecialistIndex ?? "none"}`;
}

export function PlatformOverviewPage() {
  const { user, loading } = useAuth();
  const reduceMotion = useHydratedReducedMotion();
  const [compactStory, setCompactStory] = useState(false);
  const appHref = !loading && !user.is_guest ? "/home" : loginHref("/home");

  useEffect(() => {
    const previousTheme = document.body.dataset.theme;
    document.body.dataset.theme = "Deep Space";
    return () => {
      if (previousTheme) document.body.dataset.theme = previousTheme;
      else delete document.body.dataset.theme;
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px), (hover: none) and (pointer: coarse)");
    const update = () => setCompactStory(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    trackLandingEvent("platform_overview_view", { location: "platform_page" });
  }, []);

  const handleLaunch = () => {
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    trackLandingEvent("platform_cta_click", { location: "platform_page", target: "launch_app" });
  };

  return (
    <div className={`${styles.page} dark`} data-theme="Deep Space">
      <IntroductionNav staticFull forceTheme="Deep Space" />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroContent}>
            <div className={styles.kicker}><BrainCircuit aria-hidden="true" /> Quanfora 2.0</div>
            <h1>
              Five perspectives.
              <span>One decision you can audit.</span>
            </h1>
            <p>
              Quanfora routes complex investment questions through specialist agents, preserves disagreement,
              applies risk controls, and synthesizes one evidence-aware answer.
            </p>
            <div className={styles.heroActions}>
              <Link href={appHref} onClick={handleLaunch} className={styles.primaryAction}>
                Launch App <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                href="/#samples"
                onClick={() => trackLandingEvent("platform_cta_click", { location: "platform_page", target: "sample_research" })}
                className={styles.secondaryAction}
              >
                View sample research
              </Link>
            </div>
          </div>
          <div className={styles.scrollPrompt} aria-hidden="true"><ArrowDown /> See the system work</div>
        </section>

        {reduceMotion || compactStory ? (
          <StaticMultiAgentStory />
        ) : (
          <ScrollMultiAgentStory />
        )}

        <section className={styles.closing}>
          <p>Multi-agent consensus is available for questions that deserve more than one point of view.</p>
          <h2>Research the upside. Keep the dissent. Respect the risk.</h2>
          <Link href={appHref} onClick={handleLaunch} className={styles.primaryAction}>
            Open Quanfora <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </main>
      <IntroductionFooter />
    </div>
  );
}

function ScrollMultiAgentStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackedPhases = useRef(new Set<string>());
  const [storyState, setStoryState] = useState(() => resolvePlatformStoryState(0));
  const scrollYProgress = useMotionValue(0);
  const panelX = useTransform(scrollYProgress, [0, 0.12], [48, 0]);
  const panelScale = useTransform(scrollYProgress, [0, 0.12], [0.985, 1]);
  const panelOpacity = useTransform(scrollYProgress, [0, 0.08], [0.46, 1]);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;

      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const scrollDistance = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, (window.scrollY - sectionTop) / scrollDistance));
      scrollYProgress.set(progress);

      const next = resolvePlatformStoryState(progress);
      setStoryState((current) => storyStateSignature(current) === storyStateSignature(next) ? current : next);
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [scrollYProgress]);

  useEffect(() => {
    if (trackedPhases.current.has(storyState.phaseId)) return;
    trackedPhases.current.add(storyState.phaseId);
    trackLandingEvent("platform_multi_agent_phase_view", {
      phase_id: storyState.phaseId,
      phase_index: storyState.phaseIndex,
    });
  }, [storyState.phaseId, storyState.phaseIndex]);

  return (
    <section ref={sectionRef} className={styles.story} data-testid="platform-multi-agent-story">
      <div className={styles.stickyViewport}>
        <div className={styles.storyGrid}>
          <StoryCopy activePhase={storyState.phaseIndex} />
          <motion.div className={styles.panelWrap} style={{ x: panelX, scale: panelScale, opacity: panelOpacity }}>
            <MultiAgentPanel state={storyState} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StaticMultiAgentStory() {
  return (
    <section className={styles.staticStory} data-testid="platform-multi-agent-story">
      <div className={styles.staticIntro}>
        <StoryHeading />
      </div>
      <ol className={styles.staticPhases}>
        {PLATFORM_STORY_PHASES.map((phase, index) => (
          <li key={phase.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{phase.label}</h3><p>{PHASE_DESCRIPTIONS[index]}</p></div>
          </li>
        ))}
      </ol>
      <div className={styles.staticPanelWrap}>
        <MultiAgentPanel state={FINAL_STORY_STATE} staticView />
      </div>
    </section>
  );
}

function StoryCopy({ activePhase }: { activePhase: number }) {
  return (
    <div className={styles.storyCopy}>
      <StoryHeading />
      <ul className={styles.benefits}>
        <li><Check aria-hidden="true" /> Five domain specialists use distinct tools and prompts</li>
        <li><Check aria-hidden="true" /> Confidence, disagreement, and missing evidence stay visible</li>
        <li><Check aria-hidden="true" /> Risk flags can downgrade an otherwise bullish verdict</li>
      </ul>
      <ol className={styles.phaseRail} aria-label="Multi-agent workflow progress">
        {PLATFORM_STORY_PHASES.map((phase, index) => (
          <li key={phase.id} className={index === activePhase ? styles.phaseActive : undefined} aria-current={index === activePhase ? "step" : undefined}>
            <i aria-hidden="true" />
            <span>{phase.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StoryHeading() {
  return (
    <>
      <div className={styles.storyEyebrow}><BrainCircuit aria-hidden="true" /> Multi-agent consensus</div>
      <h2>Independent analysis, then one disciplined answer.</h2>
      <p>
        Quanfora does not hide disagreement behind a single model response. Each specialist forms a structured opinion before the consensus engine weighs the result.
      </p>
    </>
  );
}

function MultiAgentPanel({ state, staticView = false }: { state: PlatformStoryState; staticView?: boolean }) {
  const resolutionVisible = state.phaseIndex >= 2 || staticView;
  const answerVisible = state.phaseIndex >= 3 || staticView;
  const activeSpecialist = state.activeSpecialistIndex === null ? null : PLATFORM_SPECIALISTS[state.activeSpecialistIndex];

  return (
    <section className={styles.demoPanel} aria-label="Illustrative Quanfora multi-agent consensus interface" data-phase={state.phaseId}>
      <header className={styles.demoHeader}>
        <div className={styles.windowDots} aria-hidden="true"><i /><i /><i /></div>
        <span>Quanfora Consensus</span>
        <span className={styles.demoBadge}>Illustrative</span>
      </header>

      <div className={styles.demoBody}>
        <div className={styles.promptBubble}>
          <span>Research question</span>
          <p>Should I put my entire cash reserve into one AI stock?</p>
        </div>

        <div className={styles.agentHeading}>
          <div className={styles.agentCluster} aria-hidden="true">
            {SPECIALIST_DETAILS.map((specialist) => <i key={specialist.short} style={{ "--agent-color": specialist.color } as CSSProperties} />)}
          </div>
          <span>{state.phaseIndex === 0 ? "Routing question" : activeSpecialist ? `${activeSpecialist} working` : "Specialist review complete"}</span>
          <span className={styles.runtimeLabel}>Sequential runtime</span>
        </div>

        <ol className={styles.agentList} aria-label="Specialist agent statuses">
          {SPECIALIST_DETAILS.map((specialist, index) => {
            const status = staticView ? "complete" : state.specialistStatuses[index];
            const Icon = specialist.icon;
            return (
              <li key={specialist.short} className={styles[`agent${capitalize(status)}`]} style={{ "--agent-color": specialist.color } as CSSProperties}>
                <span className={styles.agentIcon}><Icon aria-hidden="true" /></span>
                <div><strong>{PLATFORM_SPECIALISTS[index]}</strong><small>{status === "complete" ? specialist.result : status === "active" ? "Reviewing the shared evidence snapshot…" : "Waiting for the previous specialist"}</small></div>
                <StatusMark status={status} />
              </li>
            );
          })}
        </ol>

        <div className={styles.resolutionArea}>
          <motion.div
            className={styles.resolutionPlaceholder}
            animate={{ opacity: resolutionVisible ? 0 : 1, y: resolutionVisible ? -6 : 0 }}
            transition={{ duration: staticView ? 0 : 0.16 }}
            aria-hidden={resolutionVisible}
          >
            <CircleDot aria-hidden="true" />
            <span>Structured opinions will merge here after every specialist reports.</span>
          </motion.div>

          <motion.section
            className={styles.consensusCard}
            animate={{ opacity: resolutionVisible && !answerVisible ? 1 : 0, y: resolutionVisible && !answerVisible ? 0 : 10, scale: resolutionVisible && !answerVisible ? 1 : 0.985 }}
            transition={{ duration: staticView ? 0 : 0.18, ease: "easeOut" }}
            aria-hidden={!resolutionVisible || answerVisible}
          >
            <div><span>Weighted consensus</span><strong>HOLD / WAIT</strong></div>
            <div className={styles.consensusMeter}><i /><i /><i /><i /><i /></div>
            <footer><span>Moderate agreement</span><span className={styles.riskFlag}>3 risk flags · guardrail applied</span></footer>
          </motion.section>

          <motion.section
            className={styles.answerCard}
            animate={{ opacity: answerVisible ? 1 : 0, y: answerVisible ? 0 : 10, scale: answerVisible ? 1 : 0.985 }}
            transition={{ duration: staticView ? 0 : 0.18, ease: "easeOut" }}
            aria-hidden={!answerVisible}
          >
            <div className={styles.answerTitle}><Sparkles aria-hidden="true" /><strong>Hold / Wait</strong><span>Guardrail applied</span></div>
            <p>Do not concentrate your full cash reserve in one position. The upside thesis remains constructive, but liquidity and concentration risk override it.</p>
            <div><span>Evidence attached</span><span>Dissent preserved</span><span>Risk visible</span></div>
          </motion.section>
        </div>
      </div>

      <footer className={styles.demoFooter}>
        <span>Illustrative product walkthrough · not live market data or financial advice</span>
        <BrainCircuit aria-hidden="true" />
      </footer>
    </section>
  );
}

function StatusMark({ status }: { status: SpecialistStatus }) {
  if (status === "complete") return <span className={styles.statusComplete}><Check aria-hidden="true" /> Complete</span>;
  if (status === "active") return <span className={styles.statusActive}><i aria-hidden="true" /> Working</span>;
  return <span className={styles.statusQueued}>Queued</span>;
}

function capitalize(value: SpecialistStatus) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
