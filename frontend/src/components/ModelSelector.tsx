"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Cpu, FileSearch, Network, Sparkles, Zap } from "lucide-react";
import type { AiDeskMode } from "@/lib/api";

// ─── Mode types ────────────────────────────

export type QuanforaVersion = "sabi" | "1.0" | "2.0" | "2.1";

/** Translates the frontend version pick into the API mode field. */
export function apiModeFromVersion(version: Exclude<QuanforaVersion, "2.1">): Exclude<AiDeskMode, "research"> {
  return version === "sabi" ? "sabi" : version === "2.0" ? "consensus" : "single";
}

// ─── Context ───────────────────────────────

interface ModelContextValue {
  version: QuanforaVersion;
  setVersion: (v: QuanforaVersion) => void;
}

const ModelContext = createContext<ModelContextValue>({
  version: "sabi",
  setVersion: () => {},
});

export function useModel() {
  return useContext(ModelContext);
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState<QuanforaVersion>("sabi");
  return (
    <ModelContext.Provider value={{ version, setVersion }}>
      {children}
    </ModelContext.Provider>
  );
}

// ─── Modes data ────────────────────────────

const QUANFORA_MODES: {
  version: QuanforaVersion;
  label: string;
  tagline: string;
  icon: typeof Cpu;
  accentClass: string;
}[] = [
  {
    version: "sabi",
    label: "Sabi",
    tagline: "Automatically chooses the right tools, analysis depth, and approved context.",
    icon: Sparkles,
    accentClass: "text-indigo-primary bg-indigo-primary/18 ring-indigo-primary/25",
  },
  {
    version: "1.0",
    label: "Quick",
    tagline: "Fast market, platform, and portfolio answers.",
    icon: Zap,
    accentClass: "text-indigo-primary bg-indigo-primary/18 ring-indigo-primary/25",
  },
  {
    version: "2.0",
    label: "Consensus",
    tagline: "Independent review from specialist agents.",
    icon: Network,
    accentClass: "text-emerald-400 bg-emerald-400/18 ring-emerald-400/25",
  },
  {
    version: "2.1",
    label: "Research",
    tagline: "Complete investment or trading research.",
    icon: FileSearch,
    accentClass: "text-cyan-300 bg-cyan-300/16 ring-cyan-300/25",
  },
];

// ─── Selector component ────────────────────

export default function ModelSelector({
  placement = "bottom",
  compact = false,
}: {
  placement?: "bottom" | "top";
  compact?: boolean;
}) {
  const { version, setVersion } = useModel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = QUANFORA_MODES.find((m) => m.version === version) ?? QUANFORA_MODES[0];
  const ActiveIcon = active.icon;
  const menuPosition = placement === "top" ? "bottom-12" : "top-12";
  const menuAlignment = compact ? "right-0" : "left-0";

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
        className={`flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--surface-control-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 ${compact ? "px-3" : "px-4"}`}
      >
        <ActiveIcon className={`size-4 ${version === "2.0" ? "text-emerald-400" : version === "2.1" ? "text-cyan-300" : "text-indigo-primary"}`} />
        <span className={compact ? "hidden sm:inline" : undefined}>{active.label}</span>
        <ChevronDown className={`size-4 text-[var(--text-subtle)] transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${menuAlignment} ${menuPosition} z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]`}
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">Modes</div>
            {QUANFORA_MODES.map((model) => {
              const Icon = model.icon;
              const isActive = model.version === version;
              const badgeClass = model.version === "sabi"
                ? "bg-indigo-primary/12 text-indigo-200 ring-indigo-primary/20"
                : model.version === "2.1"
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
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
                      {model.version === "sabi" && (
                        <span className={`ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass}`}>
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{model.tagline}</div>
                  </div>
                  {isActive && <Check className="size-4 shrink-0 text-green-positive" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
