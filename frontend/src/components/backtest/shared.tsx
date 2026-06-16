import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className={cn("mt-2 text-2xl font-semibold", tone === "positive" && "text-green-positive", tone === "negative" && "text-red-negative")}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatStrategyType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
