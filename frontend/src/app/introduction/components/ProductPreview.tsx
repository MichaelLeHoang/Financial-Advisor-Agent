"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, RotateCcw, Sidebar, Terminal } from "lucide-react";
import { animate as motionAnimate, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";

const INITIAL_TERMINAL_X = 320;
const INITIAL_TERMINAL_Y = 170;

export function ProductPreview() {
  const reduceMotion = useReducedMotion();
  const dragBoundsRef = useRef<HTMLDivElement>(null);
  const mainControls = useDragControls();
  const terminalControls = useDragControls();
  const mainX = useMotionValue(0);
  const mainY = useMotionValue(0);
  const terminalX = useMotionValue(INITIAL_TERMINAL_X);
  const terminalY = useMotionValue(INITIAL_TERMINAL_Y);
  const [activeWindow, setActiveWindow] = useState<"main" | "terminal">("terminal");
  const [terminalPrompt, setTerminalPrompt] = useState("");

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
    <section className="landing-fixed-demo relative z-10 p-4 sm:p-6">
      <div className="mx-auto max-w-[1360px]">
        <div className="relative isolate h-[550px] overflow-hidden rounded-[1.45rem] bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.54),transparent_28%),linear-gradient(135deg,#d7d0c4,#aaa08f_48%,#d6cab8)] shadow-[0_38px_120px_rgba(0,0,0,0.42)] sm:h-[650px] sm:bg-[url('/art-background.webp')] sm:bg-cover sm:bg-center lg:h-[730px]">
          <div className="sr-only" aria-live="polite">
            Interactive demo showing draggable Quanfora desktop and terminal windows over a fixed macOS-style background.
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.52),transparent_26%),linear-gradient(180deg,rgba(20,18,12,0.05),rgba(20,18,12,0.18))]" aria-hidden="true" />
          <div ref={dragBoundsRef} className="pointer-events-none absolute inset-5 sm:inset-8" aria-hidden="true" />

          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center px-3 pb-10 pt-8 sm:px-8 ${activeWindow === "main" ? "z-50" : "z-20"}`}>
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
                <button type="button" aria-label="Back" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62 transition-colors hover:bg-[#d7d7d7]/10 hover:text-[#eeeeee]">
                  <ArrowLeft className="size-4" />
                </button>
                <button type="button" aria-label="Forward" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62 transition-colors hover:bg-[#d7d7d7]/10 hover:text-[#eeeeee]">
                  <ArrowRight className="size-4" />
                </button>
                <button type="button" aria-label="Refresh" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62 transition-colors hover:bg-[#d7d7d7]/10 hover:text-[#eeeeee]">
                  <RefreshCw className="size-4" />
                </button>
                <div className="ml-2 flex h-6 min-w-0 flex-1 items-center rounded-md bg-[#d7d7d7]/10 px-3 text-sm text-[#d7d7d7]/78">
                  http://localhost:3000/session
                </div>
                <button type="button" aria-label="Toggle sidebar" className="grid size-7 place-items-center rounded text-[#d7d7d7]/62 transition-colors hover:bg-[#d7d7d7]/10 hover:text-[#eeeeee]">
                  <Sidebar className="size-4" />
                </button>
              </div>

              <div className="relative h-[clamp(280px,39vw,500px)] overflow-hidden bg-[#07080b]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cover-screenshot.png"
                  alt="Quanfora application screenshot inside a macOS-style preview window"
                  loading="eager"
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
                <button type="button" className="border border-[#d7d7d724] bg-[#d7d7d714] px-3 py-2 text-left text-[#d7d7d7c2] transition-colors hover:border-[#d7d7d742] hover:bg-[#d7d7d71f]">
                  Review NVDA exposure and rebalance risk.
                </button>
                <div className="text-[#d7d7d7d1]">Computed allocation drift and sector concentration.</div>
                <button type="button" className="border border-[#d7d7d724] bg-[#d7d7d714] px-3 py-2 text-left transition-colors hover:border-[#d7d7d742] hover:bg-[#d7d7d71f]">
                  <span className="font-medium">risk_report.py</span>
                  <span className="ml-2 text-emerald-400">+42</span>
                  <span className="ml-1 text-red-400">-0</span>
                </button>
                <div className="text-[#d7d7d7d1]">Suggested staged rebalance with VaR guardrails.</div>
                <form className="flex items-center gap-2 border border-[#d7d7d761] px-3 py-2 text-[#d7d7d799] transition-colors focus-within:border-[#d7d7d7b3]" onSubmit={(event) => event.preventDefault()}>
                  <span>→</span>
                  <input
                    value={terminalPrompt}
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
            className="absolute bottom-4 right-4 z-40 grid size-11 place-items-center rounded-full bg-[#15130f] text-[#edecec]/78 shadow-[0_14px_34px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:bg-[#211f18] hover:text-[#edecec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edecec]/70"
          >
            <RotateCcw className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
