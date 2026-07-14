"use client";

import { BriefcaseBusiness, CandlestickChart } from "lucide-react";
import { usePortfolioBookView, type PortfolioBookView } from "@/components/portfolio/PortfolioBookViewProvider";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  value: PortfolioBookView;
  label: string;
  icon: typeof BriefcaseBusiness;
}> = [
  { value: "investment", label: "Investment Portfolio", icon: BriefcaseBusiness },
  { value: "trading", label: "Trade Portfolio", icon: CandlestickChart },
];

export default function PortfolioBookSwitch() {
  const { book, setBook, ready } = usePortfolioBookView();

  return (
    <div className="border-b border-[var(--theme-border)] bg-space-black px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Portfolio book"
          aria-busy={!ready}
          className="grid w-full max-w-md grid-cols-2 rounded-full border border-white/10 bg-white/[0.035] p-1"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = book === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setBook(value)}
                className={cn(
                  "flex h-9 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/55",
                  selected
                    ? "bg-[var(--text-primary)] text-space-black shadow-sm"
                    : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]",
                )}
              >
                <Icon className="hidden size-4 shrink-0 sm:block" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="hidden text-xs text-[var(--text-subtle)] sm:block">
          {book === "investment" ? "Long-term holdings" : "Active trade positions"}
        </p>
      </div>
    </div>
  );
}
