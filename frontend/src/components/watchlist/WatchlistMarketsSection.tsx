"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, LineChart } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchQuotes } from "@/lib/quote-cache";
import type { MarketQuote } from "@/lib/api";
import { cn } from "@/lib/utils";

type MarketCategory = "Americas" | "Crypto" | "Futures";
type MarketInstrument = { symbol: string; label: string; exchange: string };

const MARKET_SECTIONS: Array<{ title: MarketCategory; instruments: MarketInstrument[] }> = [
  { title: "Americas", instruments: [
    { symbol: "^DJI", label: "Dow Jones Industrial Average", exchange: "INDEXDJX" },
    { symbol: "^GSPC", label: "S&P 500", exchange: "INDEXSP" },
    { symbol: "^IXIC", label: "Nasdaq Composite", exchange: "INDEXNASDAQ" },
    { symbol: "^GSPTSE", label: "S&P/TSX Composite", exchange: "INDEXTSI" },
    { symbol: "^RUT", label: "Russell 2000", exchange: "INDEXRUSSELL" },
    { symbol: "^VIX", label: "VIX", exchange: "INDEXCBOE" },
  ] },
  { title: "Crypto", instruments: [
    { symbol: "BTC-CAD", label: "Bitcoin / CAD", exchange: "Crypto" },
    { symbol: "ETH-CAD", label: "Ethereum / CAD", exchange: "Crypto" },
    { symbol: "LTC-CAD", label: "Litecoin / CAD", exchange: "Crypto" },
    { symbol: "DOGE-CAD", label: "Dogecoin / CAD", exchange: "Crypto" },
    { symbol: "ADA-CAD", label: "Cardano / CAD", exchange: "Crypto" },
  ] },
  { title: "Futures", instruments: [
    { symbol: "YM=F", label: "Dow Futures", exchange: "CBOT" },
    { symbol: "ES=F", label: "S&P Futures", exchange: "CME" },
    { symbol: "NQ=F", label: "Nasdaq Futures", exchange: "CME" },
    { symbol: "GC=F", label: "Gold", exchange: "COMEX" },
    { symbol: "CL=F", label: "Crude Oil", exchange: "NYMEX" },
  ] },
];

function priceLabel(quote: MarketQuote) {
  const prefix = quote.currency && quote.currency !== "USD" ? `${quote.currency} ` : quote.ticker.includes("^") ? "" : "$";
  return `${prefix}${quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MiniSparkline({ quote }: { quote: MarketQuote }) {
  const positive = quote.change >= 0;
  const gradientId = `watchlist-market-${quote.ticker.replace(/[^a-z0-9]/gi, "")}-${positive ? "up" : "down"}`;
  if (quote.history.length < 2) return <div className="h-full" />;
  return (
    <div className={cn("h-full w-full", positive ? "text-emerald-400" : "text-rose-400")}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={quote.history} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity={0.24} /><stop offset="100%" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="price" stroke="currentColor" strokeWidth={1.8} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WatchlistMarketsSection() {
  const [category, setCategory] = useState<MarketCategory>("Americas");
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const section = useMemo(() => MARKET_SECTIONS.find((item) => item.title === category) ?? MARKET_SECTIONS[0], [category]);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    fetchQuotes(section.instruments.map((instrument) => instrument.symbol), "1mo", "1d")
      .then((next) => { if (!canceled) setQuotes(next); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [section]);

  return (
    <section aria-labelledby="markets-section-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 id="markets-section-title" className="font-semibold">Markets</h3>
        <Tabs value={category} onValueChange={(value) => setCategory(value as MarketCategory)}>
          <TabsList variant="line" className="h-9 gap-3 p-0">
            {MARKET_SECTIONS.map((item) => <TabsTrigger key={item.title} value={item.title} className="h-8 px-1.5 text-sm">{item.title}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      <HorizontalScroll className="-mx-1 flex snap-x gap-3 px-1 pb-2 pt-0.5">
        {section.instruments.map((instrument) => {
          const quote = quotes.get(instrument.symbol.toUpperCase());
          const positive = (quote?.change ?? 0) >= 0;
          const Direction = positive ? ArrowUp : ArrowDown;
          return (
            <Link
              key={instrument.symbol}
              href={`/discover/markets/stocks/${encodeURIComponent(instrument.symbol)}`}
              aria-label={`Open ${instrument.label} market details`}
              className="group flex h-36 min-w-[260px] snap-start flex-col justify-between rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4 transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transform-none sm:min-w-[300px]"
            >
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{instrument.label}</p><p className="mt-0.5 text-xs text-[var(--text-subtle)]">{instrument.exchange}</p></div><LineChart className="size-4 shrink-0 text-[var(--text-subtle)] transition-colors group-hover:text-[var(--text-primary)]" /></div>
              <div className="grid grid-cols-[minmax(0,1fr)_105px] items-end gap-4">
                <div className="min-w-0">{loading ? <p className="text-sm text-[var(--text-muted)]">Loading…</p> : quote ? <><p className="truncate text-xl font-semibold tabular-nums">{priceLabel(quote)}</p><span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", positive ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400")}><Direction className="size-3" />{Math.abs(quote.change).toFixed(2)}%</span></> : <p className="text-sm text-[var(--text-muted)]">Unavailable</p>}</div>
                <div className="h-12">{quote && <MiniSparkline quote={quote} />}</div>
              </div>
            </Link>
          );
        })}
      </HorizontalScroll>
    </section>
  );
}
