"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CirclePlus, RefreshCw } from "lucide-react";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";

export default function InvestmentAccountsPage() {
  const { portfolios, investmentHoldings, quotes, currencyRates, preferences, loading, refreshedAt, refresh } = useInvestmentWorkspace();

  return (
    <div className="min-h-full bg-[var(--theme-bg)] px-4 py-4 text-[var(--text-primary)] lg:px-6 xl:px-8">
      <div className="mx-auto max-w-[1840px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Investment Accounts</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Brokerage, retirement, paper, and manually tracked Investment portfolios.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" title="Refresh accounts" aria-label="Refresh accounts" onClick={() => void refresh()} disabled={loading} className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] disabled:opacity-45"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
            <Link href="/portfolio/accounts" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black"><CirclePlus className="size-4" /> Add portfolio</Link>
          </div>
        </header>

        <section className="mt-5 border-t border-[var(--theme-border)]">
          {portfolios.map((portfolio) => {
            const holdings = investmentHoldings.filter((record) => record.portfolio.id === portfolio.id);
            const value = holdings.reduce((sum, { holding }) => {
              const quote = quotes.get(holding.symbol.toUpperCase());
              const currency = (quote?.currency || holding.cost_currency || portfolio.base_currency).toUpperCase();
              return sum + holding.quantity * (quote?.price || holding.average_cost) * (currencyRates.get(currency) ?? 1);
            }, 0);
            return (
              <Link key={portfolio.id} href={`/invest/holdings?portfolio=${encodeURIComponent(portfolio.id)}`} className="grid w-full gap-3 border-b border-[var(--theme-border)] py-4 text-left transition-colors hover:bg-[var(--surface-card-hover)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-control)]"><BriefcaseBusiness className="size-5 text-[var(--text-muted)]" /></span>
                  <div className="min-w-0"><p className="truncate font-semibold">{portfolio.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{holdings.length} Investment positions · base {portfolio.base_currency}</p></div>
                </div>
                <div className="sm:text-right"><p className="font-semibold tabular-nums">{formatMoney(value, preferences.displayCurrency)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{refreshedAt ? `Synced ${relativeTime(refreshedAt)}` : "Not synced"}</p></div>
                <ArrowRight className="hidden size-4 text-[var(--text-muted)] sm:block" />
              </Link>
            );
          })}
          {!portfolios.length && <div className="py-20 text-center"><BriefcaseBusiness className="mx-auto size-7 text-[var(--text-muted)]" /><h2 className="mt-4 font-semibold">No investment portfolios</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Connect or create a portfolio, then classify positions as Investment.</p></div>}
        </section>

        <div className="mt-5 flex justify-end"><Link href="/portfolio/accounts" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50">Manage all portfolio connections <ArrowRight className="size-4" /></Link></div>
      </div>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
