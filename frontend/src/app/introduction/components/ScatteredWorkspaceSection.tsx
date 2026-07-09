"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BellRing,
  BrainCircuit,
  ChartCandlestick,
  FileSearch,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  PieChart,
  ShieldAlert,
} from "lucide-react";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";

import { WorkflowCard, type WorkflowCardData } from "./WorkflowCard";
import { trackLandingEvent } from "./landing-analytics";

const CARD_WIDTH = 192;
const CARD_HEIGHT = 88;

const copySlides = [
  {
    eyebrow: "One connected workspace",
    heading: "From scattered market inputs",
    accent: "to one disciplined decision.",
    body: "Bring research, evidence, risk, portfolio context, and decision records into one structured workflow.",
    label: "Research · Risk · Portfolio · Journal",
  },
  {
    eyebrow: "Evidence stays attached",
    heading: "Turn fragmented research",
    accent: "into auditable context.",
    body: "Keep sources, assumptions, and caveats visible before risk checks or portfolio action.",
    label: "Sources · Assumptions · Caveats · Thesis",
  },
  {
    eyebrow: "Risk before action",
    heading: "Move from market noise",
    accent: "to controlled execution.",
    body: "Compare exposure, backtests, alerts, and decision notes before committing capital.",
    label: "Exposure · Backtests · Alerts · Records",
  },
];

const workflowCards: WorkflowCardData[] = [
  {
    id: "market-data",
    label: "Market data",
    detail: "Quotes, fundamentals, and price context",
    icon: ChartCandlestick,
  },
  {
    id: "news",
    label: "News",
    detail: "Relevant market developments",
    icon: Newspaper,
  },
  {
    id: "sentiment",
    label: "Sentiment",
    detail: "Narrative and headline signals",
    icon: MessagesSquare,
  },
  {
    id: "evidence",
    label: "Evidence",
    detail: "Sources, assumptions, and caveats",
    icon: FileSearch,
  },
  {
    id: "backtests",
    label: "Backtests",
    detail: "Historical strategy validation",
    icon: Activity,
  },
  {
    id: "risk-flags",
    label: "Risk flags",
    detail: "Drawdown and concentration checks",
    icon: ShieldAlert,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    detail: "Allocation and exposure context",
    icon: PieChart,
  },
  {
    id: "consensus",
    label: "AI consensus",
    detail: "Independent specialist views",
    icon: BrainCircuit,
  },
  {
    id: "journal",
    label: "Trade journal",
    detail: "Document the decision process",
    icon: NotebookPen,
  },
  {
    id: "alerts",
    label: "Watchlist alerts",
    detail: "Track meaningful market changes",
    icon: BellRing,
  },
];

const cardPositions = [
  { id: "market-data", x: -0.47, y: -0.36, swirl: 0.72 },
  { id: "news", x: -0.16, y: -0.44, swirl: 0.56 },
  { id: "sentiment", x: 0.43, y: -0.35, swirl: 0.66 },
  { id: "evidence", x: 0.49, y: -0.06, swirl: 0.5 },
  { id: "backtests", x: 0.42, y: 0.34, swirl: 0.74 },
  { id: "risk-flags", x: 0.1, y: 0.45, swirl: 0.58 },
  { id: "portfolio", x: -0.36, y: 0.38, swirl: 0.68 },
  { id: "consensus", x: -0.49, y: 0.12, swirl: 0.54 },
  { id: "journal", x: -0.38, y: -0.09, swirl: 0.78 },
  { id: "alerts", x: 0.36, y: 0.12, swirl: 0.62 },
];

const launchOrder = [
  "market-data",
  "consensus",
  "journal",
  "portfolio",
  "risk-flags",
  "backtests",
  "evidence",
  "alerts",
  "sentiment",
  "news",
];

type SceneSize = {
  width: number;
  height: number;
};

type PositionedWorkflowCard = {
  card: WorkflowCardData;
  index: number;
  launchIndex: number;
  targetX: number;
  targetY: number;
  floatX: number;
  floatY: number;
  swirl: number;
};

export function ScatteredWorkspaceSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);
  const reduceMotion = useReducedMotion();
  const inView = useInView(sectionRef, { once: true, amount: 0.28 });
  const isSectionActive = useInView(sectionRef, { amount: 0.12 });
  const [sceneSize, setSceneSize] = useState<SceneSize>({ width: 0, height: 0 });
  const [activeCopyIndex, setActiveCopyIndex] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (reduceMotion) return;
    const nextIndex = latest < 0.42 ? 0 : latest < 0.63 ? 1 : 2;
    setActiveCopyIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSceneSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackLandingEvent("landing_scattered_workspace_view", { location: "scattered_workspace" });
  }, [inView]);

  const positionedCards = useMemo(() => getPositionedCards(sceneSize), [sceneSize]);
  const copyInitial = reduceMotion ? false : { opacity: 0, y: 18 };
  const copyAnimate = inView || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 };

  return (
    <section ref={sectionRef} className="landing-scattered-workspace relative z-10 px-6 py-16 sm:py-20 lg:h-[240vh] lg:px-6 lg:py-0">
      <div className="lg:hidden">
        <motion.div
          initial={copyInitial}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <SectionCopy slide={copySlides[0]} reduceMotion={Boolean(reduceMotion)} />
        </motion.div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-9 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {workflowCards.map((card) => (
            <WorkflowCard key={card.id} card={card} />
          ))}
        </motion.div>
      </div>

      <div ref={sceneRef} className="mx-auto hidden max-w-7xl lg:sticky lg:top-0 lg:block lg:min-h-[100svh]">
        <motion.div
          className="absolute inset-0 grid place-items-center px-8 text-center"
          initial={copyInitial}
          animate={copyAnimate}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative z-20 mx-auto max-w-xl">
            <SectionCopy slide={copySlides[activeCopyIndex]} reduceMotion={Boolean(reduceMotion)} />
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {positionedCards.map((item) => (
            <ScatteredWorkflowCard
              key={item.card.id}
              item={item}
              entered={inView}
              floating={isSectionActive && inView}
              reduceMotion={Boolean(reduceMotion)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionCopy({ slide, reduceMotion }: { slide: (typeof copySlides)[number]; reduceMotion: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={slide.heading}
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.99 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/30">{slide.eyebrow}</p>
        <h2 className="mx-auto mt-5 max-w-3xl font-heading text-4xl font-normal leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {slide.heading}
          <br />
          <span className="scattered-heading-accent text-white/48">{slide.accent}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/45">{slide.body}</p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200/72">{slide.label}</p>
      </motion.div>
    </AnimatePresence>
  );
}

function ScatteredWorkflowCard({
  item,
  entered,
  floating,
  reduceMotion,
}: {
  item: PositionedWorkflowCard;
  entered: boolean;
  floating: boolean;
  reduceMotion: boolean;
}) {
  const launchDelay = reduceMotion ? 0 : item.launchIndex * 0.075;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 z-10 w-48"
      style={{ marginLeft: -CARD_WIDTH / 2, marginTop: -CARD_HEIGHT / 2 }}
      initial={reduceMotion ? false : { x: 0, y: 0, opacity: 0, scale: 0.56, rotate: -1.5 }}
      animate={
        reduceMotion
          ? { x: item.targetX, y: item.targetY, opacity: 1, scale: 1, rotate: 0 }
          : entered
            ? {
                x: item.targetX,
                y: item.targetY,
                opacity: 1,
                scale: 1,
                rotate: 0,
              }
            : { x: 0, y: 0, opacity: 0, scale: 0.56, rotate: -1.5 }
      }
      transition={{
        duration: 0.9,
        delay: launchDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.div
        animate={
          !reduceMotion && floating
            ? {
                x: [0, item.floatX, -item.floatX * 0.45, 0],
                y: [0, item.floatY, -item.floatY * 0.4, 0],
                scale: [1, 1.006, 0.998, 1],
              }
            : { x: 0, y: 0, scale: 1 }
        }
        transition={{
          duration: 5.2 + (item.index % 4) * 0.55,
          delay: floating ? launchDelay + 0.95 : 0,
          ease: "easeInOut",
          repeat: floating && !reduceMotion ? Infinity : 0,
        }}
      >
        <WorkflowCard card={item.card} />
      </motion.div>
    </motion.div>
  );
}

function getPositionedCards(sceneSize: SceneSize): PositionedWorkflowCard[] {
  const width = Math.max(sceneSize.width, 1024);
  const height = Math.max(sceneSize.height, 720);
  const coordinateWidth = Math.min(width * 1.02, 1280);
  const coordinateHeight = Math.min(height * 0.82, 780);
  const edgeX = Math.max(width / 2 - CARD_WIDTH / 2 - 28, 360);
  const edgeY = Math.max(height / 2 - CARD_HEIGHT - 36, 260);

  return workflowCards.map((card, index) => {
    const position = cardPositions.find((item) => item.id === card.id) ?? cardPositions[index];
    const rawX = position.x * coordinateWidth;
    const rawY = position.y * coordinateHeight;
    const protectedX = Math.abs(rawY) < 145 && Math.abs(rawX) < 330 ? Math.sign(rawX || 1) * 330 : rawX;
    const targetX = clamp(protectedX, -edgeX, edgeX);
    const targetY = clamp(rawY, -edgeY, edgeY);
    const floatMagnitude = 7 + (index % 4) * 2;
    const targetRadius = Math.max(Math.hypot(targetX, targetY), 1);
    const direction = index % 2 === 0 ? 1 : -1;

    return {
      card,
      index,
      launchIndex: launchOrder.indexOf(card.id) >= 0 ? launchOrder.indexOf(card.id) : index,
      targetX,
      targetY,
      floatX: (-targetY / targetRadius) * floatMagnitude * direction,
      floatY: (targetX / targetRadius) * (floatMagnitude + 4) * direction,
      swirl: position.swirl,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
