"use client";

import Link from "next/link";
import { AlertTriangle, Clock3, Database, WalletCards } from "lucide-react";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

export function WorkspacePage({
  eyebrow,
  title,
  description,
  actions,
  contextBar,
  children,
  dense = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  contextBar?: React.ReactNode | false;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div className={cn("min-h-full min-w-0 bg-[var(--background)] px-4 pt-20 text-[var(--text-primary)] md:pt-6", dense ? "pb-5 lg:px-7 lg:pt-5" : "pb-6 lg:px-10 lg:py-9")}>
      <div className="mx-auto min-w-0 max-w-[1500px]">
        <div className="flex flex-col gap-5 border-b border-[var(--theme-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">{eyebrow}</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {contextBar === undefined ? <ContextBar /> : contextBar}
        <div className={cn("min-w-0", dense ? "mt-4" : "mt-7")}>{children}</div>
      </div>
    </div>
  );
}

export function ContextBar({ paperAccount }: { paperAccount?: { name: string; cash: number; dataStatus: string; asOf: string } | null }) {
  const isPaperContext = paperAccount !== undefined;
  const dataLabel = paperAccount
    ? `${paperAccount.dataStatus[0]?.toUpperCase()}${paperAccount.dataStatus.slice(1)} data · ${new Date(paperAccount.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : isPaperContext ? "Loading paper account…" : "Illustrative data · updated now";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--theme-border)] py-3 text-xs text-[var(--text-muted)]">
      <span className="inline-flex items-center gap-2 font-semibold text-[var(--text-primary)]"><WalletCards className="size-4" /> All Portfolio</span>
      <span>{paperAccount?.name ?? (isPaperContext ? "Paper account" : "Main Brokerage")}</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" /> Paper mode</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /> Market open</span>
      <span>Cash {paperAccount ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(paperAccount.cash) : isPaperContext ? "—" : "$14,520"}</span>
      <span className="ml-auto inline-flex items-center gap-1.5"><Database className="size-3.5" /> {dataLabel}</span>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn(APP_RADIUS.surface, "min-w-0 border border-[var(--theme-border)] bg-[var(--surface-card)] p-[20px] sm:p-5", className)}>{children}</section>;
}

export function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="break-words text-sm font-semibold">{title}</h2>{detail && <p className="mt-1 break-words text-xs text-[var(--text-muted)]">{detail}</p>}</div>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

export function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  return (
    <div className="min-w-0 border-l-2 border-[var(--theme-border-strong)] pl-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone === "positive" && "text-emerald-400", tone === "negative" && "text-rose-400", tone === "warning" && "text-amber-300")}>{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-[var(--text-subtle)]">{detail}</p>}
    </div>
  );
}

export function Status({ tone, children }: { tone: "positive" | "warning" | "neutral" | "danger"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-semibold",
      tone === "positive" && "text-emerald-400",
      tone === "warning" && "text-amber-300",
      tone === "neutral" && "text-sky-300",
      tone === "danger" && "text-rose-400",
    )}>
      {tone === "warning" && <AlertTriangle className="size-3.5" />}{children}
    </span>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="theme-solid-action inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">{children}</Link>;
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/40">{children}</Link>;
}
