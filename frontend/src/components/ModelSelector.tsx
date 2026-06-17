"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Cpu, FileSearch, Network, Zap } from "lucide-react";

// ─── Model types ───────────────────────────

export type QuanAdVersion = "1.0" | "2.0" | "2.1";

/** Translates the frontend version pick into the API mode field. */
export function apiModeFromVersion(version: Exclude<QuanAdVersion, "2.1">): "single" | "consensus" {
  return version === "2.0" ? "consensus" : "single";
}

// ─── Context ───────────────────────────────

interface ModelContextValue {
  version: QuanAdVersion;
  setVersion: (v: QuanAdVersion) => void;
}

const ModelContext = createContext<ModelContextValue>({
  version: "1.0",
  setVersion: () => {},
});

export function useModel() {
  return useContext(ModelContext);
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState<QuanAdVersion>("1.0");
  return (
    <ModelContext.Provider value={{ version, setVersion }}>
      {children}
    </ModelContext.Provider>
  );
}

// ─── Models data ───────────────────────────

const MODELS: {
  version: QuanAdVersion;
  label: string;
  tagline: string;
  icon: typeof Cpu;
  accentClass: string;
}[] = [
  {
    version: "1.0",
    label: "QuanAd 1.0",
    tagline: "Fast single-agent advisor for market, portfolio, and sentiment work.",
    icon: Zap,
    accentClass: "text-indigo-primary bg-indigo-primary/18 ring-indigo-primary/25",
  },
  {
    version: "2.0",
    label: "QuanAd 2.0",
    tagline: "Multi-agent consensus — 5 specialists analyze independently.",
    icon: Network,
    accentClass: "text-emerald-400 bg-emerald-400/18 ring-emerald-400/25",
  },
  {
    version: "2.1",
    label: "QuanAd 2.1",
    tagline: "Equity Research Desk for ticker-based reports and risk review.",
    icon: FileSearch,
    accentClass: "text-cyan-300 bg-cyan-300/16 ring-cyan-300/25",
  },
];

// ─── Selector component ────────────────────

export default function ModelSelector() {
  const { version, setVersion } = useModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = MODELS.find((m) => m.version === version) ?? MODELS[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--surface-control-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
      >
        <ActiveIcon className={`size-4 ${version === "2.0" ? "text-emerald-400" : version === "2.1" ? "text-cyan-300" : "text-indigo-primary"}`} />
        {active.label}
        <ChevronDown className="size-4 text-[var(--text-subtle)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-12 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]"
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">Models</div>
            {MODELS.map((model) => {
              const Icon = model.icon;
              const isActive = model.version === version;
              const badgeClass = model.version === "2.1"
                ? "bg-cyan-300/12 text-cyan-200 ring-cyan-300/20"
                : "bg-emerald-400/12 text-emerald-400 ring-emerald-400/20";
              return (
                <button
                  key={model.version}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setVersion(model.version);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary-action-hover)] ${
                    isActive
                      ? "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-[var(--shadow-control)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-selected)]/50"
                  }`}
                >
                  <div className={`flex size-9 items-center justify-center rounded-xl ring-1 ${model.accentClass}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {model.label}
                      {model.version !== "1.0" && (
                        <span className={`ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass}`}>
                          {model.version === "2.1" ? "Research" : "New"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{model.tagline}</div>
                  </div>
                  {isActive && <Check className="size-4 shrink-0 text-green-positive" />}
                </button>
              );
            })}

            {/* Info footer */}
            <div className="mt-1.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                <strong className="text-[var(--text-subtle)]">v1.0</strong> — Fast single-agent ReAct advisor.{" "}
                <strong className="text-[var(--text-subtle)]">v2.0</strong> — 5 specialists (Quant Researcher,
                Analyst, Data Scientist, Risk Analyst, Portfolio Analytics) analyze
                independently and form a weighted consensus.{" "}
                <strong className="text-[var(--text-subtle)]">v2.1</strong> — ticker-based equity research desk
                that creates structured reports.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
