"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarPlus,
  ChevronDown,
  Clock3,
  ExternalLink,
  LineChart,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { Area, AreaChart, Line, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Watchlist, WatchlistAsset, MarketQuote } from "@/lib/api";
import { fetchQuote, invalidate } from "@/lib/quote-cache";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import MarketMovers from "@/components/market/MarketMovers";
import MarketNewsFeed from "@/components/market/MarketNewsFeed";
import MarketSummary from "@/components/market/MarketSummary";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

interface AssetRow extends WatchlistAsset {
  quote: MarketQuote | null;
  loading: boolean;
}

interface MarketInstrument {
  symbol: string;
  label: string;
  exchange: string;
  category: "Americas" | "Crypto" | "Futures";
  googlePath: string;
}

interface QuoteRow extends MarketInstrument {
  quote: MarketQuote | null;
  loading: boolean;
}

interface EarningsEvent {
  symbol: string;
  company: string;
  exchange: string;
  day: string;
  date: string;
  time: string;
  period: string;
  epsEstimate: string;
  revenueEstimate: string;
  googlePath: string;
}

type RightPanelView =
  | { type: "home" }
  | { type: "quote"; instrument: MarketInstrument }
  | { type: "earnings"; event: EarningsEvent };

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// The market quote API returns `change` as a percentage, not a dollar amount.
function changePct(q: MarketQuote): number {
  return q.change;
}

const MARKET_SECTIONS: { title: MarketInstrument["category"]; instruments: MarketInstrument[] }[] = [
  {
    title: "Americas",
    instruments: [
      { symbol: "^DJI", label: "Dow Jones", exchange: "INDEXDJX", category: "Americas", googlePath: "/quote/.DJI:INDEXDJX" },
      { symbol: "^GSPC", label: "S&P 500", exchange: "INDEXSP", category: "Americas", googlePath: "/quote/.INX:INDEXSP" },
      { symbol: "^IXIC", label: "Nasdaq", exchange: "INDEXNASDAQ", category: "Americas", googlePath: "/quote/.IXIC:INDEXNASDAQ" },
      { symbol: "^RUT", label: "Russell 2000", exchange: "INDEXRUSSELL", category: "Americas", googlePath: "/quote/RUT:INDEXRUSSELL" },
      { symbol: "^VIX", label: "VIX", exchange: "INDEXCBOE", category: "Americas", googlePath: "/quote/VIX:INDEXCBOE" },
    ],
  },
  {
    title: "Crypto",
    instruments: [
      { symbol: "BTC-CAD", label: "BTC / CAD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/BTC-CAD" },
      { symbol: "ETH-CAD", label: "ETH / CAD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/ETH-CAD" },
      { symbol: "LTC-CAD", label: "LTC / CAD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/LTC-CAD" },
      { symbol: "DOGE-CAD", label: "DOGE / CAD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/DOGE-CAD" },
      { symbol: "ADA-CAD", label: "ADA / CAD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/ADA-CAD" },
    ],
  },
  {
    title: "Futures",
    instruments: [
      { symbol: "YM=F", label: "Dow Futures", exchange: "CBOT", category: "Futures", googlePath: "/quote/YM1:CBOT" },
      { symbol: "ES=F", label: "S&P Futures", exchange: "CME", category: "Futures", googlePath: "/quote/ES1:CME" },
      { symbol: "NQ=F", label: "Nasdaq Futures", exchange: "CME", category: "Futures", googlePath: "/quote/NQ1:CME" },
      { symbol: "GC=F", label: "Gold", exchange: "COMEX", category: "Futures", googlePath: "/quote/GCW00:COMEX" },
      { symbol: "CL=F", label: "Crude Oil", exchange: "NYMEX", category: "Futures", googlePath: "/quote/CLW00:NYMEX" },
    ],
  },
];

const UPCOMING_EARNINGS: EarningsEvent[] = [
  {
    symbol: "EMP.A",
    company: "Empire Company Limited",
    exchange: "TSE",
    day: "Thu",
    date: "18",
    time: "8:00 a.m. UTC-4",
    period: "Fiscal Q4 2026",
    epsEstimate: "$0.88",
    revenueEstimate: "7.8B",
    googlePath: "/quote/EMP.A:TSE?tab=earnings",
  },
  {
    symbol: "ACN",
    company: "Accenture plc",
    exchange: "NYSE",
    day: "Thu",
    date: "18",
    time: "7:00 a.m. UTC-4",
    period: "Fiscal Q3 2026",
    epsEstimate: "$3.71",
    revenueEstimate: "18.8B",
    googlePath: "/quote/ACN:NYSE?tab=earnings",
  },
  {
    symbol: "FDX",
    company: "FedEx Corporation",
    exchange: "NYSE",
    day: "Tue",
    date: "23",
    time: "4:00 p.m. UTC-4",
    period: "Fiscal Q4 2026",
    epsEstimate: "$5.92",
    revenueEstimate: "24.0B",
    googlePath: "/quote/FDX:NYSE?tab=earnings",
  },
];

const SUMMARY_CACHE_KEY = "financial-advisor.watchlist-summary";
const SUMMARY_TTL_MS = 6 * 60 * 60 * 1000;

/* Deterministic monogram avatar color from the ticker, à la Google Finance logos. */
const AVATAR_COLORS = [
  "bg-indigo-500/20 text-indigo-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-rose-500/20 text-rose-300",
  "bg-violet-500/20 text-violet-300",
  "bg-teal-500/20 text-teal-300",
  "bg-orange-500/20 text-orange-300",
];

function avatarColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function TickerAvatar({ symbol }: { symbol: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-tight",
        avatarColor(symbol)
      )}
      aria-hidden="true"
    >
      {symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}
    </div>
  );
}

/* Change pill: arrow + sign so direction never relies on color alone. */
function ChangePill({ pct, positive }: { pct: number; positive: boolean }) {
  const Arrow = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-semibold tabular-nums",
        positive
          ? "bg-green-positive/12 text-green-positive"
          : "bg-red-negative/12 text-red-negative"
      )}
    >
      <Arrow className="h-3 w-3" aria-hidden="true" />
      {fmt(Math.abs(pct))}%
    </span>
  );
}

function priceLabel(q: MarketQuote): string {
  const prefix = q.currency && q.currency !== "USD" ? `${q.currency} ` : q.ticker.includes("^") ? "" : "$";
  return `${prefix}${fmt(q.price)}`;
}

function estimateAbsoluteChange(q: MarketQuote): number {
  if (q.change === 0) return 0;
  const previous = q.price / (1 + q.change / 100);
  return q.price - previous;
}

function compactNumber(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function displaySymbol(symbol: string): string {
  return symbol.replace("-", " / ");
}

function MiniSparkline({ history, positive }: { history: MarketQuote["history"]; positive: boolean }) {
  if (history.length < 2) return <div className="h-full w-full" />;
  return (
    <div className={cn("h-full w-full", positive ? "text-green-positive" : "text-red-negative")}>
      <ChartContainer
        config={{ price: { label: "Price", color: "currentColor" } }}
        className="aspect-auto h-full w-full"
        initialDimension={{ width: 82, height: 48 }}
      >
        <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <Area
            type="monotone"
            dataKey="price"
            stroke="currentColor"
            strokeWidth={1.6}
            fill="currentColor"
            fillOpacity={0.12}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function useQuoteRows(instruments: MarketInstrument[]) {
  const [rows, setRows] = useState<QuoteRow[]>(
    instruments.map((instrument) => ({ ...instrument, quote: null, loading: true }))
  );

  useEffect(() => {
    let cancelled = false;
    setRows(instruments.map((instrument) => ({ ...instrument, quote: null, loading: true })));
    instruments.forEach((instrument) => {
      fetchQuote(instrument.symbol)
        .then((quote) => {
          if (cancelled) return;
          setRows((prev) =>
            prev.map((row) => (row.symbol === instrument.symbol ? { ...row, quote, loading: false } : row))
          );
        })
        .catch(() => {
          if (cancelled) return;
          setRows((prev) =>
            prev.map((row) => (row.symbol === instrument.symbol ? { ...row, loading: false } : row))
          );
        });
    });
    return () => {
      cancelled = true;
    };
  }, [instruments]);

  return rows;
}

function MarketCard({ row, onOpen }: { row: QuoteRow; onOpen: (instrument: MarketInstrument) => void }) {
  const q = row.quote;
  const positive = q ? q.change >= 0 : true;
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="group flex h-[132px] min-w-[220px] flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition-all hover:border-white/[0.14] hover:bg-white/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/40"
      aria-label={`Open ${row.label} chart detail`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{row.label}</p>
          <p className="mt-0.5 truncate text-xs text-white/35">{row.exchange}</p>
        </div>
        <LineChart className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-white/55" />
      </div>

      <div className="grid grid-cols-[1fr_82px] items-end gap-3">
        <div className="min-w-0">
          {row.loading ? (
            <>
              <div className="h-5 w-24 animate-pulse rounded bg-white/[0.07]" />
              <div className="mt-2 h-4 w-16 animate-pulse rounded-full bg-white/[0.05]" />
            </>
          ) : q ? (
            <>
              <p className="truncate text-lg font-semibold tabular-nums text-white">{priceLabel(q)}</p>
              <div className="mt-1">
                <ChangePill pct={changePct(q)} positive={positive} />
              </div>
            </>
          ) : (
            <p className="text-sm text-white/25">Unavailable</p>
          )}
        </div>
        <div className="h-12">
          {q && <MiniSparkline history={q.history} positive={positive} />}
        </div>
      </div>
    </button>
  );
}

function MarketSectionSlider({
  instruments,
  onOpen,
}: {
  instruments: MarketInstrument[];
  onOpen: (instrument: MarketInstrument) => void;
}) {
  const rows = useQuoteRows(instruments);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showScrollbar = () => {
    setIsScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setIsScrolling(false), 900);
  };

  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  }, []);

  return (
    <div>
      <ScrollArea
        onPointerDown={showScrollbar}
        onWheel={showScrollbar}
        className="watchlist-horizontal-slider -mx-1 pb-2"
        data-scrolling={isScrolling ? "true" : "false"}
        scrollbarOrientation="horizontal"
        scrollbarClassName={cn(
          "h-1.5 border-0 p-0 opacity-0 transition-opacity duration-200",
          isScrolling && "opacity-100"
        )}
      >
        <div onScroll={showScrollbar} className="flex w-max min-w-full gap-3 px-1 pb-2">
          {rows.map((row) => (
            <MarketCard key={row.symbol} row={row} onOpen={onOpen} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function MarketSections({ onOpen }: { onOpen: (instrument: MarketInstrument) => void }) {
  const [activeCategory, setActiveCategory] = useState<MarketInstrument["category"]>("Americas");
  const activeSection = MARKET_SECTIONS.find((section) => section.title === activeCategory) ?? MARKET_SECTIONS[0];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Markets</h2>
        <Tabs
          value={activeCategory}
          onValueChange={(value) => setActiveCategory(value as MarketInstrument["category"])}
          className="min-w-0"
        >
          <TabsList variant="line" className="h-9 gap-3 rounded-none p-0">
            {MARKET_SECTIONS.map((section) => (
              <TabsTrigger
                key={section.title}
                value={section.title}
                className="h-8 px-1.5 text-sm text-white/45 data-active:text-white"
              >
                {section.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {activeSection && (
        <MarketSectionSlider
          key={activeSection.title}
          instruments={activeSection.instruments}
          onOpen={onOpen}
        />
      )}
    </section>
  );
}

function useDynamicSummary() {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = window.localStorage.getItem(SUMMARY_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { generatedAt: number; text: string };
        if (Date.now() - parsed.generatedAt < SUMMARY_TTL_MS) {
          setSummary(parsed.text);
          return;
        }
      } catch {
        window.localStorage.removeItem(SUMMARY_CACHE_KEY);
      }
    }

    Promise.allSettled([fetchQuote("^DJI"), fetchQuote("^GSPC"), fetchQuote("^IXIC"), fetchQuote("^VIX")]).then((results) => {
      if (cancelled) return;
      const quotes = results
        .filter((result): result is PromiseFulfilledResult<MarketQuote> => result.status === "fulfilled")
        .map((result) => result.value);
      if (quotes.length === 0) return;

      const equityQuotes = quotes.filter((q) => q.ticker !== "^VIX");
      const avgMove = equityQuotes.reduce((sum, q) => sum + q.change, 0) / Math.max(equityQuotes.length, 1);
      const vix = quotes.find((q) => q.ticker === "^VIX");
      const direction = avgMove >= 0 ? "positive" : "negative";
      const text = `US indexes are leaning ${direction}, with the major equity benchmarks averaging ${avgMove >= 0 ? "+" : ""}${fmt(avgMove)}%. ${vix ? `Volatility is at ${fmt(vix.price)} with a ${vix.change >= 0 ? "+" : ""}${fmt(vix.change)}% move.` : ""} This brief refreshes from cached market data every few hours.`;

      window.localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ generatedAt: Date.now(), text }));
      setSummary(text);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return summary;
}

function DynamicMarketBrief() {
  const summary = useDynamicSummary();
  return (
    <div className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
        <div>
          <p className="text-sm font-medium text-white/80">Cached market brief</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">
            {summary ?? "Building a summary from cached market data..."}
          </p>
        </div>
      </div>
    </div>
  );
}

function UpcomingEarnings({
  onOpen,
}: {
  onOpen: (event: EarningsEvent) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Upcoming earnings</h2>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onOpen(UPCOMING_EARNINGS[0])}
          className="rounded-lg text-white/40 hover:text-white"
        >
          More earnings
        </Button>
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {UPCOMING_EARNINGS.map((event) => (
          <button
            key={`${event.symbol}-${event.period}`}
            type="button"
            onClick={() => onOpen(event)}
            className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-white/[0.06] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-white/[0.045] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/40"
          >
            <span className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <span className="text-xs font-semibold uppercase text-white/38">{event.day}</span>
              <span className="text-lg font-bold text-white">{event.date}</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{event.company}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/38">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {event.time}
                </span>
                <span>{event.period}</span>
              </span>
            </span>
            <span className="hidden min-w-[10rem] grid-cols-2 gap-3 text-xs sm:grid">
              <span>
                <span className="block text-white/32">EPS est.</span>
                <span className="mt-0.5 block font-semibold text-white/82">{event.epsEstimate}</span>
              </span>
              <span>
                <span className="block text-white/32">Rev est.</span>
                <span className="mt-0.5 block font-semibold text-white/82">{event.revenueEstimate}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuoteDetailPanel({
  instrument,
  onBack,
}: {
  instrument: MarketInstrument;
  onBack: () => void;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1M");
  const [notice, setNotice] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"area" | "compare">("area");
  const [compareOpen, setCompareOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareQuote, setCompareQuote] = useState<MarketQuote | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setQuote(null);
    fetchQuote(instrument.symbol)
      .then((next) => {
        if (!cancelled) setQuote(next);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instrument.symbol]);

  const chartData = useMemo(() => {
    if (!quote) return [];
    const rangeSize: Record<string, number> = { "1D": 1, "5D": 5, "1M": 30, "6M": 60, "YTD": 90, "1Y": 90, "5Y": 90, MAX: 90 };
    return quote.history.slice(-(rangeSize[range] ?? 30));
  }, [quote, range]);
  const displayedChartData = useMemo(() => {
    if (!compareQuote || chartMode !== "compare") return chartData;
    const compareHistory = compareQuote.history.slice(-chartData.length);
    return chartData.map((point, index) => ({
      ...point,
      comparePrice: compareHistory[index]?.price ?? null,
    }));
  }, [chartData, chartMode, compareQuote]);

  const addCompareSymbol = async (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    setCompareSymbol(normalized);
    setCompareLoading(true);
    setChartMode("compare");
    try {
      const next = await fetchQuote(normalized);
      setCompareQuote(next);
      setNotice(`Comparing ${instrument.symbol} with ${next.ticker}.`);
    } catch {
      setCompareQuote(null);
      setNotice(`Unable to load ${normalized} for comparison.`);
    } finally {
      setCompareLoading(false);
    }
  };

  const positive = quote ? quote.change >= 0 : true;
  const absoluteChange = quote ? estimateAbsoluteChange(quote) : 0;
  const isCrypto = instrument.category === "Crypto";
  const timestamp = useMemo(
    () => new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(new Date()),
    [quote?.ticker]
  );
  const stats: Array<[string, string]> = isCrypto ? [
    ["Mkt. cap", compactNumber(quote?.market_cap)],
    ["Fully-diluted value", quote?.market_cap ? compactNumber(quote.market_cap * 1.05) : "—"],
    ["Volume (24h)", compactNumber(quote?.volume)],
    ["Circulating supply", quote?.market_cap && quote?.price ? compactNumber(quote.market_cap / quote.price) : "—"],
    ["Issue date", instrument.symbol.startsWith("BTC") ? "Jul 12, 2010" : "—"],
  ] : [
    ["Open", typeof quote?.open_price === "number" ? fmt(quote.open_price) : "—"],
    ["High", typeof quote?.day_high === "number" ? fmt(quote.day_high) : "—"],
    ["Low", typeof quote?.day_low === "number" ? fmt(quote.day_low) : "—"],
    ["Volume", compactNumber(quote?.volume)],
    ["52-wk high", typeof quote?.fifty_two_week_high === "number" ? fmt(quote.fifty_two_week_high) : "—"],
    ["52-wk low", typeof quote?.fifty_two_week_low === "number" ? fmt(quote.fifty_two_week_low) : "—"],
  ];
  const relatedAssets = MARKET_SECTIONS.find((section) => section.title === instrument.category)?.instruments
    .filter((item) => item.symbol !== instrument.symbol)
    .slice(0, 4) ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Summary
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setNotice("Added to your local review queue.")}
            aria-label="Track quote"
          >
            <Star className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setNotice("Alert setup opens from the sidebar bell.")}
            aria-label="Create alert"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              navigator.clipboard?.writeText(`https://www.google.com/finance/beta${instrument.googlePath}`);
              setNotice("Reference link copied.");
            }}
            aria-label="Copy Google Finance reference URL"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/?session=${encodeURIComponent(`quote-${instrument.symbol}`)}`)}
            className="rounded-xl"
          >
            Ask AI
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-white/42">{displaySymbol(instrument.symbol)} Research</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{displaySymbol(instrument.symbol)}</h2>
          <p className="mt-1 text-sm text-white/42">{quote?.name || instrument.label}</p>
        </div>

        {loading ? (
          <div className="h-20 w-72 animate-pulse rounded-2xl bg-white/[0.06]" />
        ) : quote ? (
          <div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-white">{priceLabel(quote)}</p>
              <span className={cn("mb-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums", positive ? "text-green-positive" : "text-red-negative")}>
                {positive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {positive ? "+" : "-"}{fmt(Math.abs(quote.change))}%
              </span>
              <span className="mb-1 text-sm tabular-nums text-white/45">
                ({absoluteChange >= 0 ? "+" : "-"}{fmt(Math.abs(absoluteChange))}) {range}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/35">{timestamp}</p>
          </div>
        ) : (
          <p className="text-sm text-white/30">Quote unavailable</p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-y border-white/[0.06] py-3">
          <Button
            type="button"
            variant={chartMode === "area" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setChartMode("area");
              setCompareOpen(false);
            }}
            className="rounded-xl"
          >
            <LineChart className="h-4 w-4" />
            Area
          </Button>
          <Button
            type="button"
            variant={chartMode === "compare" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setChartMode("compare");
              setCompareOpen((open) => !open);
            }}
            className="rounded-xl"
          >
            <Search className="h-4 w-4" />
            Compare
          </Button>
          <Button
            type="button"
            variant={indicatorsOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIndicatorsOpen((open) => !open)}
            className="rounded-xl"
          >
            <LineChart className="h-4 w-4" />
            Indicators
          </Button>
        </div>

        {compareOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
            <TickerSuggestionInput
              value={compareSymbol}
              onValueChange={setCompareSymbol}
              onSelect={addCompareSymbol}
              existingTickers={[instrument.symbol]}
              placeholder="All symbols"
              className="min-w-[14rem] flex-1"
              inputClassName="h-9 rounded-xl text-sm"
            />
            {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-white/35" />}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setCompareOpen(false);
                setCompareQuote(null);
                setCompareSymbol("");
                setChartMode("area");
              }}
              aria-label="Close compare"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}

        {indicatorsOpen && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white/45">
            No indicators selected. Use this area for moving averages, RSI, and volume overlays.
          </div>
        )}

        <div className="h-[360px]">
          {quote && chartData.length > 1 ? (
            <ChartContainer
              config={{
                price: { label: instrument.symbol, color: positive ? "var(--color-green-positive)" : "var(--color-red-negative)" },
                comparePrice: { label: compareQuote?.ticker ?? "Compare", color: "var(--color-indigo-primary)" },
              }}
              className="aspect-auto h-full w-full"
              initialDimension={{ width: 720, height: 360 }}
            >
              <AreaChart data={displayedChartData} margin={{ top: 10, right: 8, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="watch-detail-chart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} minTickGap={28} />
                <YAxis orientation="right" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} width={58} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  fill="url(#watch-detail-chart)"
                  className={positive ? "text-green-positive" : "text-red-negative"}
                  dot={false}
                  isAnimationActive={false}
                />
                {chartMode === "compare" && compareQuote && (
                  <Line
                    type="monotone"
                    dataKey="comparePrice"
                    stroke="var(--color-indigo-primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-sm text-white/32">
              {loading ? "Loading chart..." : "No chart history available"}
            </div>
          )}
        </div>

        <Tabs value={range} onValueChange={(value) => setRange(String(value))}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4 rounded-none border-t border-white/[0.06] p-0 pt-3">
            {["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"].map((item) => (
              <TabsTrigger key={item} value={item} className="h-8 px-1 text-xs text-white/45 data-active:text-white">
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {notice && <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/50">{notice}</p>}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-white">Overview</h3>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.06] py-2">
            <p className="text-sm text-white/42">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-white/82">{value}</p>
          </div>
        ))}
        </div>
      </section>

      {relatedAssets.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-white">Related assets</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {relatedAssets.map((asset) => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => {
                  setNotice(`${asset.label} is available from the ${asset.category} tab.`);
                }}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span>
                  <span className="block text-sm font-semibold text-white/82">{asset.label}</span>
                  <span className="block text-xs text-white/35">{asset.symbol}</span>
                </span>
                <ArrowUp className="h-3.5 w-3.5 text-green-positive" />
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function EarningsDetailPanel({
  event,
  onBack,
}: {
  event: EarningsEvent;
  onBack: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Summary
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNotice("Earnings reminder added for this browser session.")}
            className="rounded-xl"
          >
            <CalendarPlus className="h-4 w-4" />
            Add reminder
          </Button>
          <a
            href={`https://www.google.com/finance/beta${event.googlePath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[var(--border-card)] bg-[var(--surface-card)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Reference
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/40">{event.exchange}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{event.company}</h2>
            <p className="mt-1 text-sm text-white/35">{event.symbol}</p>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <span className="text-xs font-semibold uppercase text-white/38">{event.day}</span>
            <span className="text-xl font-bold text-white">{event.date}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-wide text-white/34">Time</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/85">
              <Clock3 className="h-4 w-4 text-indigo-300" />
              {event.time}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-wide text-white/34">Period</p>
            <p className="mt-2 text-sm font-semibold text-white/85">{event.period}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-wide text-white/34">EPS est.</p>
            <p className="mt-2 text-xl font-bold text-white">{event.epsEstimate}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-wide text-white/34">Revenue est.</p>
            <p className="mt-2 text-xl font-bold text-white">{event.revenueEstimate}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white">Earnings focus</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Compare reported EPS and revenue against estimates, then check guidance and margin commentary before changing a position.
          This panel stays local to the Watchlist page so earnings research does not interrupt your market summary.
        </p>
      </div>
      {notice && <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/50">{notice}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compact watchlist section (sidebar)                                 */
/* ------------------------------------------------------------------ */

function WatchlistSection({
  watchlist,
  onDelete,
  onUpgrade,
}: {
  watchlist: Watchlist;
  onDelete: () => void;
  onUpgrade: (message: string) => void;
}) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback((rows: AssetRow[]) => {
    rows.forEach((a) => {
      fetchQuote(a.symbol)
        .then((quote) => {
          setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, quote, loading: false } : r)));
        })
        .catch(() => {
          setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, loading: false } : r)));
        });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.watchlistAssets(watchlist.id)
      .then((list) => {
        if (cancelled) return;
        const rows: AssetRow[] = list.map((a) => ({ ...a, quote: null, loading: true }));
        setAssets(rows);
        setLoading(false);
        fetchQuotes(rows);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [watchlist.id, fetchQuotes]);

  const addAsset = async (symbol: string) => {
    setAdding(true);
    setError(null);
    try {
      const asset = await api.addWatchlistAsset(watchlist.id, symbol);
      const row: AssetRow = { ...asset, quote: null, loading: true };
      setAssets((prev) => [...prev, row]);
      setTickerInput("");
      fetchQuotes([row]);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) onUpgrade(e.detail.message);
      else setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    try {
      await api.removeWatchlistAsset(watchlist.id, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const refresh = async () => {
    if (refreshing || assets.length === 0) return;
    setRefreshing(true);
    assets.forEach((a) => invalidate(a.symbol));
    const rows = assets.map((a) => ({ ...a, loading: true }));
    setAssets(rows);
    await Promise.allSettled(
      rows.map((a) =>
        fetchQuote(a.symbol)
          .then((quote) => {
            setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, quote, loading: false } : r)));
          })
          .catch(() => {
            setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, loading: false } : r)));
          })
      )
    );
    setRefreshing(false);
  };

  const existingSymbols = useMemo(() => assets.map((a) => a.symbol), [assets]);

  return (
    <section aria-label={watchlist.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-white/35 transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold text-white">{watchlist.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-white/30">
            {loading ? "" : assets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || assets.length === 0}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Refresh quotes for ${watchlist.name}`}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>

        <AlertDialog>
          <AlertDialogTrigger
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-red-negative"
            aria-label={`Delete ${watchlist.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{watchlist.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the watchlist and all its tickers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-red-negative text-white hover:bg-red-negative/85"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!collapsed && (
        <>
          {/* Add symbol */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            <TickerSuggestionInput
              value={tickerInput}
              onValueChange={setTickerInput}
              onSelect={addAsset}
              existingTickers={existingSymbols}
              placeholder="Add symbol…"
              className="flex-1"
              inputClassName="h-8 border border-white/[0.08] bg-white/[0.03] rounded-lg text-sm focus-visible:ring-0 focus-visible:border-indigo-primary/50"
            />
            {adding && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />}
          </div>

          {error && <p className="px-3 pb-2 text-xs text-red-negative">{error}</p>}

          {/* Symbol rows */}
          {loading ? (
            <div className="space-y-2 px-3 pb-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-12 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="px-3 pb-4 pt-1 text-xs text-white/30">No symbols yet. Add your first above.</p>
          ) : (
            <ul className="px-1.5 pb-2">
              {assets.map((a) => {
                const q = a.quote;
                const positive = q ? q.change >= 0 : true;
                return (
                  <li key={a.id} className="group">
                    <Link
                      href={`/market?ticker=${encodeURIComponent(a.symbol)}`}
                      className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.04]"
                    >
                      <TickerAvatar symbol={a.symbol} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{a.symbol}</p>
                        {q ? (
                          <p className="truncate text-xs text-white/35">{q.name}</p>
                        ) : a.loading ? (
                          <p className="mt-1 h-2.5 w-16 animate-pulse rounded bg-white/[0.07]" />
                        ) : (
                          <p className="text-xs text-white/25">Unavailable</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {a.loading ? (
                          <span className="inline-block h-4 w-12 animate-pulse rounded bg-white/[0.07]" />
                        ) : q ? (
                          <>
                            <p className="text-sm font-semibold tabular-nums text-white">${fmt(q.price)}</p>
                            <div className="mt-0.5 flex justify-end">
                              <ChangePill pct={changePct(q)} positive={positive} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-white/25">—</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          removeAsset(a.id);
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/15 opacity-0 transition-all hover:bg-white/[0.06] hover:text-red-negative focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Remove ${a.symbol} from ${watchlist.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanelView>({ type: "home" });

  useEffect(() => {
    api.watchlists()
      .then(setWatchlists)
      .catch(() => {})
      .finally(() => setListsLoading(false));
  }, []);

  const createWatchlist = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreatingList(true);
    setCreateError(null);
    try {
      const w = await api.createWatchlist(name);
      setWatchlists((prev) => [...prev, w]);
      setNewName("");
      setShowNewForm(false);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setCreateError(e.message);
    } finally {
      setCreatingList(false);
    }
  };

  const deleteWatchlist = async (watchlistId: string) => {
    try {
      await api.deleteWatchlist(watchlistId);
      setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId));
    } catch {
      /* deletion failure leaves the list in place */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        {/* Page header */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Watchlist</h1>
            <p className="mt-1 text-sm text-white/40">Your lists, market sections, earnings and focused chart details.</p>
          </div>
        </div>

        {/* On mobile this wrapper scrolls as one; on lg each column scrolls independently. */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* ---------------- Left sidebar: watchlists ---------------- */}
          <aside className="w-full shrink-0 lg:w-80 lg:overflow-y-auto lg:pr-1.5">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Your lists</h2>
              {!showNewForm && (
                <Button
                  onClick={() => setShowNewForm(true)}
                  size="sm"
                  className="theme-solid-action h-8 rounded-lg px-2.5 text-xs font-semibold"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> New
                </Button>
              )}
            </div>

            {showNewForm && (
              <div className="mb-3 flex items-center gap-2">
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createWatchlist();
                    if (e.key === "Escape") setShowNewForm(false);
                  }}
                  placeholder="List name"
                  autoFocus
                  className="h-9 flex-1 rounded-xl text-sm"
                />
                <Button
                  onClick={createWatchlist}
                  disabled={creatingList || !newName.trim()}
                  size="sm"
                  className="theme-solid-action h-9 rounded-xl px-3 text-xs font-semibold"
                >
                  {creatingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="text-sm text-white/30 hover:text-white"
                  aria-label="Cancel new list"
                >
                  ✕
                </button>
              </div>
            )}

            {createError && <p className="pb-2 text-xs text-red-negative">{createError}</p>}
            {upgradeMessage && (
              <div className="pb-4">
                <UpgradePrompt message={upgradeMessage} />
              </div>
            )}

            {listsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
                ))}
              </div>
            ) : watchlists.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
                <Star className="h-8 w-8 text-white/10" />
                <div>
                  <p className="text-sm font-medium text-white/40">No watchlists yet</p>
                  <p className="mt-1 text-xs text-white/20">Create a list to track symbols.</p>
                </div>
                <Button
                  onClick={() => setShowNewForm(true)}
                  size="sm"
                  className="theme-solid-action mt-1 h-9 rounded-xl px-4 text-sm font-semibold"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New list
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {watchlists.map((w) => (
                  <WatchlistSection
                    key={w.id}
                    watchlist={w}
                    onDelete={() => deleteWatchlist(w.id)}
                    onUpgrade={setUpgradeMessage}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* ---------------- Main: right panel ---------------- */}
          <main className="min-w-0 flex-1 space-y-8 lg:overflow-y-auto lg:pr-1.5">
            {rightPanel.type === "quote" ? (
              <QuoteDetailPanel instrument={rightPanel.instrument} onBack={() => setRightPanel({ type: "home" })} />
            ) : rightPanel.type === "earnings" ? (
              <EarningsDetailPanel event={rightPanel.event} onBack={() => setRightPanel({ type: "home" })} />
            ) : (
              <>
                <MarketSections onOpen={(instrument) => setRightPanel({ type: "quote", instrument })} />

                <section>
                  <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">US market summary</h2>
                  <DynamicMarketBrief />
                  <MarketSummary />
                </section>

                <UpcomingEarnings onOpen={(event) => setRightPanel({ type: "earnings", event })} />

                <section>
                  <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Market trends</h2>
                  <MarketMovers />
                </section>

                <section>
                  <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Today's financial news</h2>
                  <MarketNewsFeed />
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
