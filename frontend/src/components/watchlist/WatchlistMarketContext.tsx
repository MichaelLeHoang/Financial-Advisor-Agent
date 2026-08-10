"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  RefreshCw,
  Search,
} from "lucide-react";
import MarketMovers from "@/components/market/MarketMovers";
import MarketNewsFeed from "@/components/market/MarketNewsFeed";
import MarketSummary from "@/components/market/MarketSummary";
import WatchlistMarketsSection from "@/components/watchlist/WatchlistMarketsSection";
import { fetchQuotes, invalidate } from "@/lib/quote-cache";
import type { EarningsPoint, MarketQuote } from "@/lib/api";
import { cn } from "@/lib/utils";
import { marketDetailsHref } from "@/lib/market-routes";

const INDEXES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^VIX", label: "Volatility" },
];

type UpcomingEarning = EarningsPoint & {
  name: string;
  symbol: string;
};

function stockDetailsHref(symbol: string) {
  return marketDetailsHref(symbol);
}

function buildMarketBrief(quotes: Map<string, MarketQuote>) {
  const benchmarks = INDEXES.slice(0, 3)
    .map((index) => quotes.get(index.symbol))
    .filter((quote): quote is MarketQuote => Boolean(quote));
  const volatility = quotes.get("^VIX");

  if (!benchmarks.length) {
    return "Live benchmark data is temporarily unavailable. Refresh to request the latest cached market snapshot.";
  }

  const average = benchmarks.reduce((sum, quote) => sum + quote.change, 0) / benchmarks.length;
  const direction = average > 0.1 ? "leaning positive" : average < -0.1 ? "leaning negative" : "mixed";
  const vixCopy = volatility
    ? ` Volatility is at ${volatility.price.toFixed(2)} with a ${volatility.change >= 0 ? "+" : ""}${volatility.change.toFixed(2)}% move.`
    : "";

  return `US indexes are ${direction}, with the major equity benchmarks averaging ${average >= 0 ? "+" : ""}${average.toFixed(2)}%.${vixCopy} This brief refreshes from cached market data every few minutes.`;
}

function getUpcomingEarnings(watchlistQuotes: MarketQuote[]): UpcomingEarning[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return watchlistQuotes
    .flatMap((quote) =>
      (quote.earnings ?? []).map((earning) => ({
        ...earning,
        name: quote.name || quote.ticker,
        symbol: quote.ticker,
      }))
    )
    .filter((earning) => {
      const date = new Date(`${earning.date}T00:00:00`);
      return !Number.isNaN(date.getTime()) && date >= today && earning.eps_actual == null;
    })
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 6);
}

export default function WatchlistMarketContext({ watchlistQuotes = [] }: { watchlistQuotes?: MarketQuote[] }) {
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const loadPulse = async () => {
    const next = await fetchQuotes(INDEXES.map((index) => index.symbol), "5d", "1d");
    setQuotes(next);
  };

  useEffect(() => {
    let canceled = false;
    fetchQuotes(INDEXES.map((index) => index.symbol), "5d", "1d").then((next) => {
      if (!canceled) setQuotes(next);
    });
    return () => { canceled = true; };
  }, []);

  const refreshMarket = async () => {
    setRefreshing(true);
    INDEXES.forEach((index) => invalidate(index.symbol));
    try {
      await loadPulse();
    } finally {
      setRefreshing(false);
    }
  };

  const marketBrief = useMemo(() => buildMarketBrief(quotes), [quotes]);
  const earnings = useMemo(() => getUpcomingEarnings(watchlistQuotes), [watchlistQuotes]);

  return (
    <section className="mt-10 border-t border-[var(--theme-border)] pt-7" aria-labelledby="market-context-title">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">Beyond your list</p>
          <h2 id="market-context-title" className="mt-1 text-2xl font-semibold">Market context</h2>
        </div>
      </div>

      <WatchlistMarketsSection />

      <section className="mt-8" aria-labelledby="market-pulse-title">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-indigo-300" />
          <h3 id="market-pulse-title" className="font-semibold">Market pulse</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {INDEXES.map((index) => {
            const quote = quotes.get(index.symbol);
            const positive = (quote?.change ?? 0) >= 0;
            const Direction = positive ? ArrowUpRight : ArrowDownRight;
            return (
              <Link
                key={index.symbol}
                href={stockDetailsHref(index.symbol)}
                aria-label={`Research ${index.label}`}
                className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4 transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transform-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]">{index.label}</span>
                  <Direction className={cn("size-4", positive ? "text-emerald-400" : "text-rose-400")} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <strong className="text-xl tabular-nums">{quote ? quote.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</strong>
                  <span className={cn("text-sm font-medium tabular-nums", positive ? "text-emerald-400" : "text-rose-400")}>{quote ? `${positive ? "+" : ""}${quote.change.toFixed(2)}%` : "Loading"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="market-summary-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="market-summary-title" className="font-semibold">US market summary</h3>
          <button
            type="button"
            onClick={() => void refreshMarket()}
            disabled={refreshing}
            className="group inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin motion-reduce:animate-none")} />
            {refreshing ? "Refreshing" : "Refresh brief"}
          </button>
        </div>
        <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-5">
          <Search className="mt-0.5 size-5 shrink-0 text-indigo-300" />
          <div>
            <p className="font-medium">Cached market brief</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{marketBrief}</p>
          </div>
        </div>
        <MarketSummary />
      </section>

      <section className="mt-8" aria-labelledby="upcoming-earnings-title">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="size-4 text-indigo-300" />
          <h3 id="upcoming-earnings-title" className="font-semibold">Upcoming earnings</h3>
        </div>
        {earnings.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {earnings.map((earning) => (
              <Link
                key={`${earning.symbol}-${earning.date}`}
                href={stockDetailsHref(earning.symbol)}
                className="group rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4 transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transform-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{earning.symbol}</p><p className="truncate text-xs text-[var(--text-muted)]">{earning.name}</p></div>
                  <ArrowRight className="size-4 shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 text-sm"><time dateTime={earning.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${earning.date}T00:00:00`))}</time><span className="text-[var(--text-muted)]">EPS est. {earning.eps_estimate == null ? "—" : earning.eps_estimate.toFixed(2)}</span></div>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/discover/markets"
            className="group flex min-h-24 items-center justify-between gap-5 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-5 py-4 transition-colors hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
          >
            <div><p className="font-medium">No scheduled earnings in this watchlist</p><p className="mt-1 text-sm text-[var(--text-muted)]">Add companies with upcoming reports or explore more market names.</p></div>
            <ArrowRight className="size-5 shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
          </Link>
        )}
      </section>

      <section className="mt-8" aria-labelledby="market-trends-title"><h3 id="market-trends-title" className="mb-3 font-semibold">Market trends</h3><MarketMovers /></section>
      <section className="mt-8" aria-labelledby="market-news-title"><h3 id="market-news-title" className="mb-3 font-semibold">Latest market news</h3><MarketNewsFeed limit={10} title={null} /></section>
    </section>
  );
}
