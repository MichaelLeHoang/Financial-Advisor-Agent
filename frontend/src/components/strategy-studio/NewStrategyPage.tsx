"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CandlestickChart, Layers3 } from "lucide-react";
import { useStrategyStudio } from "@/components/strategy-studio/StrategyStudioProvider";
import type { StrategyMode } from "@/components/strategy-studio/types";
import { WorkspacePage } from "@/components/workspace/WorkspaceUI";

export default function NewStrategyPage({ initialMode }: { initialMode: StrategyMode }) {
  const router = useRouter();
  const { createStrategy } = useStrategyStudio();
  const [mode, setMode] = useState<StrategyMode>(initialMode);

  const create = () => {
    const draft = createStrategy(mode);
    router.push(`${mode === "investment" ? "/invest" : "/trade"}/strategies/${draft.id}`);
  };

  return (
    <WorkspacePage eyebrow="Strategy Studio" title="Create Strategy" description="Choose the decision horizon that controls the available rules, validation, metrics, and paper workflow.">
      <div className="mx-auto max-w-3xl">
        <div role="radiogroup" aria-label="Strategy mode" className="grid gap-4 sm:grid-cols-2">
          <ModeOption mode="investment" selected={mode === "investment"} onSelect={setMode} icon={BriefcaseBusiness} title="Investment" detail="Allocation, ranking, thesis review, and rebalancing rules" />
          <ModeOption mode="trading" selected={mode === "trading"} onSelect={setMode} icon={CandlestickChart} title="Trading" detail="Entry, exit, sizing, risk, and execution schedules" />
        </div>
        <button type="button" onClick={create} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-black"><Layers3 className="size-4" /> Create {mode} strategy</button>
      </div>
    </WorkspacePage>
  );
}

function ModeOption({ mode, selected, onSelect, icon: Icon, title, detail }: { mode: StrategyMode; selected: boolean; onSelect: (mode: StrategyMode) => void; icon: typeof Layers3; title: string; detail: string }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={() => onSelect(mode)} className={`min-h-40 border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45 ${selected ? "border-white/40 bg-white/8" : "border-[var(--theme-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)]"}`}><Icon className={`size-5 ${mode === "investment" ? "text-emerald-400" : "text-sky-300"}`} /><strong className="mt-8 block text-lg">{title}</strong><span className="mt-2 block text-sm leading-6 text-[var(--text-muted)]">{detail}</span></button>;
}
