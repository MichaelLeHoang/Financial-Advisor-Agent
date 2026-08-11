"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Eye,
  EyeOff,
  ListChecks,
  RefreshCw,
  Repeat2,
  WalletCards,
} from "lucide-react";
import { InvestmentWorkspaceProvider, useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import PortfolioBookSwitch from "@/components/portfolio/PortfolioBookSwitch";
import { LoadingRegion, SkeletonBlock } from "@/components/ui/DataLoading";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { Metric, Panel, PanelHeading, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { usePortfolioBookView } from "@/components/portfolio/PortfolioBookViewProvider";
import { marketDetailsHref } from "@/lib/market-routes";
import type { PortfolioBookEvent, RecurringBuy } from "@/lib/api";
import { cn } from "@/lib/utils";

export type PortfolioSection = "holdings" | "allocation" | "performance" | "accounts" | "activity";

type PositionRow = {
  id: string;
  portfolioId: string;
  portfolioName: string;
  symbol: string;
  assetType: string;
  quantity: number;
  currency: string;
  price: number;
  value: number;
  costBasis: number;
  pnl: number;
  dailyChange: number;
  weight: number;
};

const SECTION_COPY: Record<PortfolioSection, { title: string; description: string }> = {
  holdings: {
    title: "Holdings",
    description: "Review position size, account ownership, cost basis, and current contribution in the selected book.",
  },
  allocation: {
    title: "Allocation",
    description: "Understand where the selected book is concentrated across securities and accounts.",
  },
  performance: {
    title: "Performance",
    description: "Compare current value with recorded cost basis and inspect estimated position contribution.",
  },
  accounts: {
    title: "Accounts",
    description: "See which portfolios hold the selected book and how much each account contributes.",
  },
  activity: {
    title: "Activity",
    description: "Review recorded classifications and completed recurring purchases for the selected book.",
  },
};

const POSITION_COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

export default function PortfolioSectionRoute({ section }: { section: PortfolioSection }) {
  return (
    <InvestmentWorkspaceProvider>
      <PortfolioSectionPage section={section} />
    </InvestmentWorkspaceProvider>
  );
}

function PortfolioSectionPage({ section }: { section: PortfolioSection }) {
  const workspace = useInvestmentWorkspace();
  const { book } = usePortfolioBookView();
  const copy = SECTION_COPY[section];
  const hidden = workspace.preferences.privacyMode;
  const currency = workspace.preferences.displayCurrency;

  const positions = useMemo<PositionRow[]>(() => {
    const records = workspace.selectedHoldings.filter(({ holding }) => holding.book_type === book);
    const rows = records.map(({ holding, portfolio }) => {
      const quote = workspace.quotes.get(holding.symbol.toUpperCase());
      const quoteCurrency = (quote?.currency || holding.cost_currency || portfolio.base_currency || currency).toUpperCase();
      const costCurrency = (holding.cost_currency || portfolio.base_currency || currency).toUpperCase();
      const quoteRate = workspace.currencyRates.get(quoteCurrency) ?? 1;
      const costRate = workspace.currencyRates.get(costCurrency) ?? 1;
      const price = quote?.price ?? holding.average_cost;
      const value = holding.quantity * price * quoteRate;
      const costBasis = holding.quantity * holding.average_cost * costRate;
      return {
        id: holding.id,
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        symbol: holding.symbol.toUpperCase(),
        assetType: holding.asset_type,
        quantity: holding.quantity,
        currency: quoteCurrency,
        price,
        value,
        costBasis,
        pnl: value - costBasis,
        dailyChange: holding.quantity * (quote?.change ?? 0) * quoteRate,
        weight: 0,
      };
    });
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows
      .map((row) => ({ ...row, weight: total > 0 ? (row.value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [book, currency, workspace.currencyRates, workspace.quotes, workspace.selectedHoldings]);

  const totals = useMemo(() => positions.reduce((result, row) => ({
    value: result.value + row.value,
    costBasis: result.costBasis + row.costBasis,
    pnl: result.pnl + row.pnl,
    dailyChange: result.dailyChange + row.dailyChange,
  }), { value: 0, costBasis: 0, pnl: 0, dailyChange: 0 }), [positions]);

  const contextBar = (
    <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] py-4 lg:flex-row lg:items-center lg:justify-between">
      <PortfolioBookSwitch />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => workspace.setPreference("privacyMode", !hidden)}
          aria-label="Toggle portfolio privacy"
          aria-pressed={hidden}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border-strong)] px-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45"
        >
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {hidden ? "Show values" : "Hide values"}
        </button>
        <button
          type="button"
          onClick={() => void workspace.refresh()}
          disabled={workspace.refreshing}
          aria-label="Refresh portfolio data"
          className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45 disabled:opacity-45"
        >
          <RefreshCw className={cn("size-4", workspace.refreshing && "animate-spin")} />
        </button>
      </div>
    </div>
  );

  return (
    <WorkspacePage
      dense
      eyebrow="Portfolio"
      title={copy.title}
      description={copy.description}
      contextBar={contextBar}
    >
      {workspace.error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-200">
          {workspace.error} Try refreshing the page.
        </div>
      )}
      <LoadingRegion
        loading={workspace.loading}
        label={`Loading portfolio ${section}`}
        className="min-h-80"
        skeleton={<div className="space-y-3"><SkeletonBlock className="h-24 w-full rounded-2xl" /><SkeletonBlock className="h-72 w-full rounded-2xl" /></div>}
      >
        {section === "holdings" && <HoldingsView positions={positions} totals={totals} currency={currency} hidden={hidden} />}
        {section === "allocation" && <AllocationView positions={positions} totals={totals} currency={currency} hidden={hidden} />}
        {section === "performance" && <PerformanceView positions={positions} totals={totals} currency={currency} hidden={hidden} />}
        {section === "accounts" && <AccountsView positions={positions} currency={currency} hidden={hidden} />}
        {section === "activity" && <ActivityView events={workspace.events} purchases={workspace.recurringBuys} book={book} />}
      </LoadingRegion>
    </WorkspacePage>
  );
}

function HoldingsView({ positions, totals, currency, hidden }: { positions: PositionRow[]; totals: Pick<PositionRow, "value" | "costBasis" | "pnl" | "dailyChange">; currency: string; hidden: boolean }) {
  if (!positions.length) return <EmptyState icon={WalletCards} title="No holdings in this book" detail="Classify a position into this book from the Portfolio overview to see it here." />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current value" value={privateMoney(totals.value, currency, hidden)} detail={`${positions.length} position${positions.length === 1 ? "" : "s"}`} />
        <Metric label="Recorded cost" value={privateMoney(totals.costBasis, currency, hidden)} />
        <Metric label="Estimated return" value={privateSignedMoney(totals.pnl, currency, hidden)} tone={totals.pnl >= 0 ? "positive" : "negative"} />
        <Metric label="Today" value={privateSignedMoney(totals.dailyChange, currency, hidden)} tone={totals.dailyChange >= 0 ? "positive" : "negative"} />
      </div>
      <Panel className="overflow-hidden p-0">
        <HorizontalScroll>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-[var(--theme-border)] text-left text-xs text-[var(--text-muted)]">
              <tr><th className="px-5 py-3 font-medium">Security</th><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 text-right font-medium">Weight</th><th className="px-4 py-3 text-right font-medium">Quantity</th><th className="px-4 py-3 text-right font-medium">Value</th><th className="px-5 py-3 text-right font-medium">Return</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-border)]">
              {positions.map((position) => (
                <tr key={position.id} className="transition-colors hover:bg-[var(--surface-card-hover)]">
                  <td className="px-5 py-4"><Link href={marketDetailsHref(position.symbol, position.assetType)} className="inline-flex items-center gap-2 font-semibold hover:text-indigo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/45"><span>{position.symbol}</span><ArrowRight className="size-3.5 text-[var(--text-subtle)]" /></Link></td>
                  <td className="px-4 py-4 text-[var(--text-secondary)]">{position.portfolioName}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{position.weight.toFixed(2)}%</td>
                  <td className="px-4 py-4 text-right tabular-nums text-[var(--text-secondary)]">{position.quantity.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">{privateMoney(position.value, currency, hidden)}</td>
                  <td className={cn("px-5 py-4 text-right font-semibold tabular-nums", position.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{privateSignedMoney(position.pnl, currency, hidden)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScroll>
      </Panel>
    </div>
  );
}

function AllocationView({ positions, totals, currency, hidden }: { positions: PositionRow[]; totals: Pick<PositionRow, "value">; currency: string; hidden: boolean }) {
  if (!positions.length) return <EmptyState icon={WalletCards} title="No allocation to display" detail="Add or classify holdings to build the allocation view." />;
  const largest = positions[0];
  const accounts = new Set(positions.map((position) => position.portfolioId)).size;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <Panel>
        <PanelHeading title="Security allocation" detail="Current market value by position" />
        <div className="space-y-5">
          {positions.map((position, index) => (
            <div key={position.id}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="inline-flex min-w-0 items-center gap-2 font-semibold"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: POSITION_COLORS[index % POSITION_COLORS.length] }} /><span className="truncate">{position.symbol}</span></span><span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{position.weight.toFixed(2)}% · {privateMoney(position.value, currency, hidden)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-control)]" role="img" aria-label={`${position.symbol} represents ${position.weight.toFixed(2)} percent`}><div className="h-full rounded-full" style={{ width: `${Math.max(position.weight, 1)}%`, backgroundColor: POSITION_COLORS[index % POSITION_COLORS.length] }} /></div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel><PanelHeading title="Concentration" detail="How narrowly the book is distributed" /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><Metric label="Largest position" value={`${largest.weight.toFixed(2)}%`} detail={largest.symbol} tone={largest.weight > 25 ? "warning" : "neutral"} /><Metric label="Top three positions" value={`${positions.slice(0, 3).reduce((sum, item) => sum + item.weight, 0).toFixed(2)}%`} /></div></Panel>
        <Panel><PanelHeading title="Coverage" /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><Metric label="Book value" value={privateMoney(totals.value, currency, hidden)} /><Metric label="Accounts represented" value={String(accounts)} /></div></Panel>
      </div>
    </div>
  );
}

function PerformanceView({ positions, totals, currency, hidden }: { positions: PositionRow[]; totals: Pick<PositionRow, "value" | "costBasis" | "pnl" | "dailyChange">; currency: string; hidden: boolean }) {
  if (!positions.length) return <EmptyState icon={ListChecks} title="No performance data yet" detail="Performance appears after the selected book contains priced holdings." />;
  const returnPct = totals.costBasis > 0 ? (totals.pnl / totals.costBasis) * 100 : 0;
  const maxContribution = Math.max(1, ...positions.map((position) => Math.abs(position.pnl)));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current value" value={privateMoney(totals.value, currency, hidden)} />
        <Metric label="Recorded cost" value={privateMoney(totals.costBasis, currency, hidden)} />
        <Metric label="Estimated return" value={hidden ? "••••" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`} tone={returnPct >= 0 ? "positive" : "negative"} />
        <Metric label="Today" value={privateSignedMoney(totals.dailyChange, currency, hidden)} tone={totals.dailyChange >= 0 ? "positive" : "negative"} />
      </div>
      <Panel>
        <PanelHeading title="Position contribution" detail="Current value minus recorded cost basis; realized gains, dividends, fees, and deposits are not reconstructed." />
        <div className="space-y-4">
          {positions.map((position) => (
            <div key={position.id} className="grid gap-2 sm:grid-cols-[100px_minmax(0,1fr)_140px] sm:items-center">
              <span className="font-semibold">{position.symbol}</span>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-control)]"><div className={cn("h-full rounded-full", position.pnl >= 0 ? "bg-emerald-400" : "bg-rose-400")} style={{ width: `${Math.max(2, (Math.abs(position.pnl) / maxContribution) * 100)}%` }} /></div>
              <span className={cn("text-right text-sm font-semibold tabular-nums", position.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{privateSignedMoney(position.pnl, currency, hidden)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AccountsView({ positions, currency, hidden }: { positions: PositionRow[]; currency: string; hidden: boolean }) {
  const accounts = Array.from(positions.reduce((map, position) => {
    const current = map.get(position.portfolioId) ?? { id: position.portfolioId, name: position.portfolioName, positions: 0, value: 0, dailyChange: 0 };
    current.positions += 1;
    current.value += position.value;
    current.dailyChange += position.dailyChange;
    map.set(position.portfolioId, current);
    return map;
  }, new Map<string, { id: string; name: string; positions: number; value: number; dailyChange: number }>()).values()).sort((a, b) => b.value - a.value);
  if (!accounts.length) return <EmptyState icon={BriefcaseBusiness} title="No accounts in this book" detail="Accounts appear here after at least one position is classified into the selected book." />;
  return (
    <Panel className="p-0">
      <div className="px-5 pt-5">
        <PanelHeading title="Account coverage" detail={`${accounts.length} account${accounts.length === 1 ? "" : "s"} contain positions in this book`} />
      </div>
      <div className="divide-y divide-[var(--theme-border)]">
        {accounts.map((account) => (
          <div key={account.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-card-hover)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3"><span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-control)]"><BriefcaseBusiness className="size-5 text-[var(--text-muted)]" /></span><div className="min-w-0"><p className="truncate font-semibold">{account.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{account.positions} position{account.positions === 1 ? "" : "s"}</p></div></div>
            <div className="sm:text-right"><p className="font-semibold tabular-nums">{privateMoney(account.value, currency, hidden)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Current value</p></div>
            <div className={cn("sm:min-w-28 sm:text-right", account.dailyChange >= 0 ? "text-emerald-400" : "text-rose-400")}><p className="font-semibold tabular-nums">{privateSignedMoney(account.dailyChange, currency, hidden)}</p><p className="mt-1 text-xs opacity-70">Today</p></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type ActivityItem = { id: string; at: string; symbol: string; title: string; detail: string; kind: "classification" | "purchase" };

function ActivityView({ events, purchases, book }: { events: PortfolioBookEvent[]; purchases: RecurringBuy[]; book: "investment" | "trading" }) {
  const [filter, setFilter] = useState<"all" | ActivityItem["kind"]>("all");
  const items = useMemo<ActivityItem[]>(() => {
    const classifications = events
      .filter((event) => event.new_book_type === book || event.previous_book_type === book)
      .map((event) => ({ id: event.id, at: event.created_at, symbol: event.symbol, title: event.new_book_type === book ? `Added to ${book}` : `Moved out of ${book}`, detail: `${labelBook(event.previous_book_type)} → ${labelBook(event.new_book_type)}`, kind: "classification" as const }));
    const completedPurchases = book === "investment" ? purchases.map((purchase) => ({ id: purchase.id, at: purchase.executed_at, symbol: purchase.symbol, title: "Recurring purchase recorded", detail: `${purchase.filled_quantity.toLocaleString()} shares · ${purchase.account || purchase.recurrence_frequency}`, kind: "purchase" as const })) : [];
    return [...classifications, ...completedPurchases].sort((a, b) => b.at.localeCompare(a.at));
  }, [book, events, purchases]);
  const activeFilter = book === "trading" && filter === "purchase" ? "all" : filter;
  const visible = activeFilter === "all" ? items : items.filter((item) => item.kind === activeFilter);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--theme-border)] pb-3" role="group" aria-label="Portfolio activity filters">
        {([['all', 'All'], ['classification', 'Classifications'], ['purchase', 'Purchases']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={activeFilter === value} onClick={() => setFilter(value)} className={cn("h-9 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors", activeFilter === value ? "bg-[var(--surface-control-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]", book === "trading" && value === "purchase" && "hidden")}>{label}</button>
        ))}
      </div>
      {visible.length ? (
        <Panel className="p-0">
          <div className="divide-y divide-[var(--theme-border)]">
            {visible.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="grid gap-3 px-5 py-4 sm:grid-cols-[40px_110px_90px_minmax(0,1fr)_auto] sm:items-center">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[var(--surface-control)] text-[var(--text-muted)]">{item.kind === "purchase" ? <Repeat2 className="size-4" /> : <ListChecks className="size-4" />}</span>
                <time dateTime={item.at} className="text-sm text-[var(--text-muted)]">{formatDate(item.at)}</time>
                <strong>{item.symbol}</strong><span className="text-sm">{item.title}</span><span className="text-xs text-[var(--text-muted)]">{item.detail}</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : <EmptyState icon={CalendarClock} title="No matching activity" detail="Recorded classifications and purchases will appear here." />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof WalletCards; title: string; detail: string }) {
  return <Panel className="flex min-h-72 flex-col items-center justify-center text-center"><Icon className="size-7 text-[var(--text-muted)]" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">{detail}</p><Link href="/portfolio" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border-strong)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--surface-card-hover)]">Open Portfolio overview <ArrowRight className="size-4" /></Link></Panel>;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
}

function privateMoney(value: number, currency: string, hidden: boolean) {
  return hidden ? "••••••" : money(value, currency);
}

function privateSignedMoney(value: number, currency: string, hidden: boolean) {
  if (hidden) return "••••••";
  return `${value >= 0 ? "+" : "−"}${money(Math.abs(value), currency)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function labelBook(value: string) {
  return value === "investment" ? "Investment" : value === "trading" ? "Trade" : "Unclassified";
}
