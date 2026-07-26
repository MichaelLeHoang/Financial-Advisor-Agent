"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, RotateCcw, Sidebar, Terminal } from "lucide-react";
import {
  animate as motionAnimate,
  motion,
  useDragControls,
  useMotionValue,
  useScroll,
  useTransform,
} from "motion/react";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";

const INITIAL_TERMINAL_X = 320;
const INITIAL_TERMINAL_Y = 170;

export function ProductPreview() {
  const reduceMotion = useHydratedReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const containerRevealRef = useRef<HTMLDivElement>(null);
  const dragBoundsRef = useRef<HTMLDivElement>(null);
  const mainControls = useDragControls();
  const terminalControls = useDragControls();
  const mainX = useMotionValue(0);
  const mainY = useMotionValue(0);
  const terminalX = useMotionValue(INITIAL_TERMINAL_X);
  const terminalY = useMotionValue(INITIAL_TERMINAL_Y);
  const [activeWindow, setActiveWindow] = useState<"main" | "terminal">("terminal");
  const [terminalPrompt, setTerminalPrompt] = useState("");
  const { scrollYProgress: sectionProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const { scrollYProgress: containerProgress } = useScroll({
    target: containerRevealRef,
    offset: ["start 0.9", "center 0.6"],
  });
  const backgroundY = useTransform(sectionProgress, [0, 1], reduceMotion ? [0, 0] : [-42, 42]);
  const backgroundScale = useTransform(sectionProgress, [0, 1], reduceMotion ? [1, 1] : [1.08, 1.02]);
  const revealClipPath = useTransform(
    containerProgress,
    [0, 1],
    reduceMotion
      ? ["inset(0% 0% 0% 0% round 1.45rem)", "inset(0% 0% 0% 0% round 1.45rem)"]
      : ["inset(0% 47% 0% 47% round 1.45rem)", "inset(0% 0% 0% 0% round 1.45rem)"],
  );
  const revealScale = useTransform(containerProgress, [0, 1], reduceMotion ? [1, 1] : [0.98, 1]);
  const revealY = useTransform(containerProgress, [0, 1], reduceMotion ? [0, 0] : [8, 0]);

  const resetWindows = () => {
    if (reduceMotion) {
      mainX.set(0);
      mainY.set(0);
      terminalX.set(INITIAL_TERMINAL_X);
      terminalY.set(INITIAL_TERMINAL_Y);
    } else {
      const transition = { type: "spring" as const, stiffness: 320, damping: 32 };
      motionAnimate(mainX, 0, transition);
      motionAnimate(mainY, 0, transition);
      motionAnimate(terminalX, INITIAL_TERMINAL_X, transition);
      motionAnimate(terminalY, INITIAL_TERMINAL_Y, transition);
    }
    setActiveWindow("terminal");
  };

  return (
    <section ref={sectionRef} className="landing-fixed-demo relative z-10 p-4 sm:p-6">
      <div className="mx-auto max-w-[1360px]">
        <motion.div
          ref={containerRevealRef}
          className="landing-product-preview-reveal relative isolate h-[390px] overflow-hidden rounded-[1.45rem] bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.54),transparent_28%),linear-gradient(135deg,#d7d0c4,#aaa08f_48%,#d6cab8)] shadow-[0_38px_120px_rgba(0,0,0,0.42)] sm:h-[650px] lg:h-[730px]"
          style={{ clipPath: revealClipPath, scale: revealScale, y: revealY }}
        >
          <div className="sr-only" aria-live="polite">
            Interactive demo showing draggable Quanfora desktop and terminal windows over a fixed macOS-style background.
          </div>
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 hidden sm:block"
            style={{
              y: backgroundY,
              scale: backgroundScale,
              backgroundImage: "url('/art-background.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.52),transparent_26%),linear-gradient(180deg,rgba(20,18,12,0.05),rgba(20,18,12,0.18))]" aria-hidden="true" />
          <div ref={dragBoundsRef} className="pointer-events-none absolute inset-5 sm:inset-8" aria-hidden="true" />

          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:hidden">
            <figure className="w-full overflow-hidden rounded-2xl bg-[#050609] text-white shadow-[0_24px_60px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)]">
              <div className="relative flex h-10 items-center justify-center border-b border-white/10 bg-[#171719] px-4">
                <div className="absolute left-4 flex items-center gap-2" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs font-medium text-white/65">Quanfora workspace</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cover-screenshot.png"
                alt="Quanfora research workspace showing an AI-assisted portfolio analysis"
                width={2908}
                height={1702}
                loading="lazy"
                decoding="async"
                className="aspect-[2908/1702] h-auto w-full object-cover object-top"
                draggable={false}
              />
              <figcaption className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-white/65">
                Research, portfolio risk, and documented decisions in one workspace.
              </figcaption>
            </figure>
          </div>

          <div className={`pointer-events-none absolute inset-0 hidden items-center justify-center px-8 pb-10 pt-8 sm:flex ${activeWindow === "main" ? "z-50" : "z-20"}`}>
            <motion.div
              role="group"
              aria-label="Draggable Quanfora app preview window"
              drag
              dragControls={mainControls}
              dragConstraints={dragBoundsRef}
              dragElastic={0.025}
              dragListener={false}
              dragMomentum={false}
              style={{ x: mainX, y: mainY }}
              onPointerDown={() => setActiveWindow("main")}
              className={`pointer-events-auto relative flex w-[min(960px,calc(100vw-3rem))] select-none flex-col overflow-hidden rounded-[1.35rem] bg-[#050609] text-[#ffffff] shadow-[0_28px_70px_rgba(0,0,0,0.22),0_14px_32px_rgba(0,0,0,0.16),0_0_0_1px_rgba(255,255,255,0.08)] ${
                activeWindow === "main" ? "z-40" : "z-20"
              }`}
            >
              <div
                className="relative flex h-9 cursor-grab items-center justify-between border-b border-[#ffffff14] px-8 active:cursor-grabbing"
                onPointerDown={(event) => {
                  setActiveWindow("main");
                  mainControls.start(event);
                }}
              >
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className={`size-3 rounded-full ${activeWindow === "main" ? "bg-[#ff5f57]" : "bg-[#3b3a34]"}`} />
                  <span className={`size-3 rounded-full ${activeWindow === "main" ? "bg-[#febc2e]" : "bg-[#3b3a34]"}`} />
                  <span className={`size-3 rounded-full ${activeWindow === "main" ? "bg-[#28c840]" : "bg-[#3b3a34]"}`} />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[56%] -translate-x-1/2 -translate-y-1/2 truncate text-sm font-normal text-[#ffffff6b]">
                  Quanfora Desktop
                </div>
                <div className="text-sm font-normal text-[#ffffff57]">Demo</div>
              </div>

              <div className="flex h-9 items-center gap-1.5 border-b border-[#d7d7d7]/14 bg-[#1b1b1d] px-3">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62">
                  <ArrowLeft className="size-4" />
                </span>
                <span aria-hidden="true" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62">
                  <ArrowRight className="size-4" />
                </span>
                <span aria-hidden="true" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62">
                  <RefreshCw className="size-4" />
                </span>
                <div className="ml-2 flex h-6 min-w-0 flex-1 items-center rounded-md bg-[#d7d7d7]/10 px-3 text-sm text-[#d7d7d7]/78">
                  http://localhost:3000/session
                </div>
                <span aria-hidden="true" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62">
                  <Sidebar className="size-4" />
                </span>
              </div>

              <div className="relative h-[clamp(280px,39vw,500px)] overflow-hidden bg-[#07080b]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cover-screenshot.png"
                  alt="Quanfora application screenshot inside a macOS-style preview window"
                  width={2908}
                  height={1702}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#ffffff0a]" aria-hidden="true" />
              </div>
            </motion.div>
          </div>

          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${activeWindow === "terminal" ? "z-50" : "z-30"}`}>
            <motion.div
              role="group"
              aria-label="Draggable Quanfora CLI preview window"
              drag
              dragControls={terminalControls}
              dragConstraints={dragBoundsRef}
              dragElastic={0.03}
              dragListener={false}
              dragMomentum={false}
              style={{ x: terminalX, y: terminalY }}
              onPointerDown={() => setActiveWindow("terminal")}
              className="pointer-events-auto hidden h-[280px] w-[min(460px,40vw)] select-none flex-col overflow-hidden rounded-[1.35rem] bg-[#050609] text-[#ffffff] shadow-[0_28px_70px_rgba(0,0,0,0.24),0_14px_32px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.08)] md:flex lg:h-[300px]"
            >
              <div
                className="relative flex h-9 cursor-grab items-center justify-between border-b border-[#ffffff14] px-8 active:cursor-grabbing"
                onPointerDown={(event) => {
                  setActiveWindow("terminal");
                  terminalControls.start(event);
                }}
              >
                <div className="flex items-center gap-3">
                  <span className={`size-3 rounded-full ${activeWindow === "terminal" ? "bg-[#ff5f57]" : "bg-[#3b3a34]"}`} />
                  <span className={`size-3 rounded-full ${activeWindow === "terminal" ? "bg-[#febc2e]" : "bg-[#3b3a34]"}`} />
                  <span className={`size-3 rounded-full ${activeWindow === "terminal" ? "bg-[#28c840]" : "bg-[#3b3a34]"}`} />
                </div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 truncate text-sm font-normal text-[#ffffff6b]">
                  <Terminal className="size-3.5" />
                  Quanfora CLI
                </div>
                <div className="text-sm font-normal text-[#ffffff57]">Live</div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden bg-[#101012] p-5 font-mono text-[13px] leading-6">
                <div className="border border-[#d7d7d724] bg-[#d7d7d714] px-3 py-2 text-left text-[#d7d7d7c2]">
                  Review NVDA exposure and rebalance risk.
                </div>
                <div className="text-[#d7d7d7d1]">Computed allocation drift and sector concentration.</div>
                <div className="border border-[#d7d7d724] bg-[#d7d7d714] px-3 py-2 text-left">
                  <span className="font-medium">risk_report.py</span>
                  <span className="ml-2 text-emerald-400">+42</span>
                  <span className="ml-1 text-red-400">-0</span>
                </div>
                <div className="text-[#d7d7d7d1]">Suggested staged rebalance with VaR guardrails.</div>
                <form className="flex items-center gap-2 border border-[#d7d7d761] px-3 py-2 text-[#d7d7d799] transition-colors focus-within:border-[#d7d7d7b3]" onSubmit={(event) => event.preventDefault()}>
                  <span>→</span>
                  <input
                    value={terminalPrompt}
                    aria-label="Quanfora CLI follow-up prompt"
                    onChange={(event) => setTerminalPrompt(event.target.value)}
                    onFocus={() => setActiveWindow("terminal")}
                    placeholder="Add a follow-up"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#d7d7d780]"
                  />
                </form>
              </div>
            </motion.div>
          </div>

          <button
            type="button"
            onClick={resetWindows}
            aria-label="Reset demo windows"
            className="absolute bottom-4 right-4 z-40 hidden size-11 place-items-center rounded-full bg-[#15130f] text-[#edecec]/78 shadow-[0_14px_34px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:bg-[#211f18] hover:text-[#edecec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edecec]/70 sm:grid"
          >
            <RotateCcw className="size-5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
