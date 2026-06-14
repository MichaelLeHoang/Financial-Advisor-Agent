"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarPlus,
  CandlestickChart,
  ChartNoAxesColumn,
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
  X,
} from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
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
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface DetailChartPoint {
  label: string;
  price: number;
  volume: number;
  primaryPerformance: number;
  open?: number;
  high?: number;
  low?: number;
  candleBase?: number;
  candleBody?: number;
  candlePositive?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

type ChartMode = "line" | "area" | "candle" | "bar";

interface WikipediaProfileData {
  title: string;
  extract: string;
  url: string;
  fetchedAt: number;
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
      { symbol: "^DJI", label: "Dow Jones Industrial Average", exchange: "INDEXDJX", category: "Americas", googlePath: "/quote/.DJI:INDEXDJX" },
      { symbol: "^GSPC", label: "S&P 500", exchange: "INDEXSP", category: "Americas", googlePath: "/quote/.INX:INDEXSP" },
      { symbol: "^IXIC", label: "Nasdaq Composite", exchange: "INDEXNASDAQ", category: "Americas", googlePath: "/quote/.IXIC:INDEXNASDAQ" },
      { symbol: "^GSPTSE", label: "S&P/TSX Composite Index", exchange: "INDEXTSI", category: "Americas", googlePath: "/quote/OSPTX:INDEXTSI" },
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
const WIKIPEDIA_PROFILE_CACHE_KEY = "financial-advisor.wikipedia-profile";
const WIKIPEDIA_PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMPARE_ASSETS: MarketInstrument[] = [
  { symbol: "LLY", label: "Eli Lilly and Company", exchange: "NYSE", category: "Americas", googlePath: "/quote/LLY:NYSE" },
  { symbol: "ETH-USD", label: "Ethereum USD", exchange: "Crypto", category: "Crypto", googlePath: "/quote/ETH-USD" },
  { symbol: "MRU.TO", label: "Metro Inc", exchange: "TSE", category: "Americas", googlePath: "/quote/MRU:TSE" },
  ...MARKET_SECTIONS.flatMap((section) => section.instruments),
];

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

function performanceFrom(start: number, current: number): number {
  if (!start) return 0;
  return ((current - start) / start) * 100;
}

function domainWithPadding(values: number[]): [number, number] {
  if (values.length === 0) return [-1, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.08, 0.35);
  return [Number((min - padding).toFixed(2)), Number((max + padding).toFixed(2))];
}

function compareKey(symbol: string, suffix: "price" | "performance"): string {
  return `compare_${symbol.replace(/[^a-zA-Z0-9]/g, "_")}_${suffix}`;
}

const COMPARE_COLORS = [
  "#1a73e8",
  "var(--color-cyan-secondary)",
  "var(--color-amber-warning)",
  "#a78bfa",
  "#fb7185",
];

const MAIN_CHART_ANIMATION = {
  animationDuration: 450,
  animationEasing: "ease-in-out" as const,
};

const CHART_MODE_LABELS: Record<ChartMode, string> = {
  line: "Line chart",
  area: "Area chart",
  candle: "Candle chart",
  bar: "Bar chart",
};

const RANGE_OPTIONS = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];

const RANGE_CONFIG: Record<string, { period: string; interval: string; refreshMs: number | null }> = {
  "1D": { period: "1d", interval: "1m", refreshMs: 60_000 },
  "5D": { period: "5d", interval: "5m", refreshMs: 5 * 60_000 },
  "1M": { period: "1mo", interval: "30m", refreshMs: 15 * 60_000 },
  "6M": { period: "6mo", interval: "1d", refreshMs: 60 * 60_000 },
  YTD: { period: "ytd", interval: "1d", refreshMs: 60 * 60_000 },
  "1Y": { period: "1y", interval: "1d", refreshMs: 60 * 60_000 },
  "5Y": { period: "5y", interval: "1wk", refreshMs: null },
  MAX: { period: "max", interval: "1mo", refreshMs: null },
};

function normalizeSymbolList(symbols: string[]): string[] {
  const seen = new Set<string>();
  return symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => {
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
}

function quoteRangeConfig(range: string) {
  return RANGE_CONFIG[range] ?? RANGE_CONFIG["1M"];
}

function pointToDetail(point: MarketQuote["history"][number], previousPrice?: number): DetailChartPoint {
  const open = typeof point.open === "number" ? point.open : previousPrice ?? point.price;
  const high = typeof point.high === "number" ? point.high : Math.max(open, point.price);
  const low = typeof point.low === "number" ? point.low : Math.min(open, point.price);
  const candlePositive = point.price >= open;
  return {
    ...point,
    primaryPerformance: 0,
    open,
    high,
    low,
    candleBase: candlePositive ? open : point.price,
    candleBody: Math.max(Math.abs(point.price - open), Math.max(point.price * 0.00008, 0.01)),
    candlePositive,
  };
}

function quoteDisplayName(instrument: MarketInstrument, quote?: MarketQuote | null): string {
  const quoteName = quote?.name?.trim();
  if (quoteName && quoteName.toUpperCase() !== quote?.ticker?.toUpperCase()) return quoteName;
  return instrument.label;
}

function findMarketInstrument(symbol: string): MarketInstrument {
  const normalized = symbol.toUpperCase();
  return (
    COMPARE_ASSETS.find((asset) => asset.symbol.toUpperCase() === normalized)
    ?? MARKET_SECTIONS.flatMap((section) => section.instruments).find((asset) => asset.symbol.toUpperCase() === normalized)
    ?? { symbol: normalized, label: normalized, exchange: "Market", category: "Americas", googlePath: `/quote/${normalized}` }
  );
}

const WIKIPEDIA_QUERY_OVERRIDES: Record<string, string> = {
  "^DJI": "Dow Jones Industrial Average",
  "^GSPC": "S&P 500",
  "^IXIC": "Nasdaq Composite",
  "^RUT": "Russell 2000 Index",
  "^VIX": "VIX",
  "BTC-CAD": "Bitcoin",
  "BTC-USD": "Bitcoin",
  "ETH-CAD": "Ethereum",
  "ETH-USD": "Ethereum",
  "LTC-CAD": "Litecoin",
  "DOGE-CAD": "Dogecoin",
  "ADA-CAD": "Cardano",
  "YM=F": "Dow Jones Industrial Average",
  "ES=F": "S&P 500",
  "NQ=F": "Nasdaq-100",
  "GC=F": "Gold",
  "CL=F": "West Texas Intermediate",
};

function wikipediaQueryForInstrument(instrument: MarketInstrument, quoteName?: string | null): string {
  const override = WIKIPEDIA_QUERY_OVERRIDES[instrument.symbol.toUpperCase()];
  if (override) return override;
  const cleanedQuoteName = quoteName?.replace(/\s+(Inc\.?|Corporation|Corp\.?|Ltd\.?|Limited|PLC|Class [A-Z])$/i, "").trim();
  return cleanedQuoteName || instrument.label || instrument.symbol;
}

function wikipediaCacheKey(query: string): string {
  return `${WIKIPEDIA_PROFILE_CACHE_KEY}:${query.toLowerCase().replace(/\s+/g, "-")}`;
}

function readWikipediaProfileCache(query: string): WikipediaProfileData | null {
  try {
    const cached = window.localStorage.getItem(wikipediaCacheKey(query));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as WikipediaProfileData;
    if (!parsed.extract || !parsed.url || Date.now() - parsed.fetchedAt > WIKIPEDIA_PROFILE_TTL_MS) {
      window.localStorage.removeItem(wikipediaCacheKey(query));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeWikipediaProfileCache(query: string, profile: WikipediaProfileData): void {
  try {
    window.localStorage.setItem(wikipediaCacheKey(query), JSON.stringify(profile));
  } catch {
    /* storage can be unavailable in private browsing */
  }
}

async function fetchWikipediaProfile(query: string, signal: AbortSignal): Promise<WikipediaProfileData | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    inprop: "url",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, { signal });
  if (!response.ok) return null;
  const data = await response.json() as {
    query?: {
      pages?: Record<string, { title?: string; extract?: string; fullurl?: string }>;
    };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.extract || !page.fullurl) return null;
  return {
    title: page.title || query,
    extract: page.extract,
    url: page.fullurl,
    fetchedAt: Date.now(),
  };
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

function WatchlistChartTooltip({
  active,
  payload,
  primaryLabel,
  primaryColor,
  compareQuotes,
  compareMode,
}: {
  active?: boolean;
  payload?: Array<{ payload: DetailChartPoint }>;
  primaryLabel: string;
  primaryColor: string;
  compareQuotes: MarketQuote[];
  compareMode: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="min-w-52 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-popover-strong)] px-3 py-2 text-xs text-white shadow-[var(--shadow-popover)]">
      <p className="font-semibold text-white/85">{point.label}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-white/55">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            {primaryLabel}
          </span>
          <span className="font-semibold tabular-nums text-white">
            {compareMode
              ? `${fmt(point.price)} · ${point.primaryPerformance >= 0 ? "+" : ""}${fmt(point.primaryPerformance)}%`
              : fmt(point.price)}
          </span>
        </div>
        {compareMode && compareQuotes.map((compareQuote, index) => {
          const price = point[compareKey(compareQuote.ticker, "price")];
          const performance = point[compareKey(compareQuote.ticker, "performance")];
          if (typeof price !== "number" || typeof performance !== "number") return null;
          return (
            <div key={compareQuote.ticker} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-white/55">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length] }} />
                {compareQuote.ticker}
              </span>
              <span className="font-semibold tabular-nums text-white">
                {fmt(price)} · {performance >= 0 ? "+" : ""}{fmt(performance)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartModeIcon({ mode, className = "h-4 w-4" }: { mode: ChartMode; className?: string }) {
  if (mode === "candle") return <CandlestickChart className={className} />;
  if (mode === "bar") return <ChartNoAxesColumn className={className} />;
  return <LineChart className={className} />;
}

function WikipediaProfile({
  instrument,
  quoteName,
}: {
  instrument: MarketInstrument;
  quoteName?: string | null;
}) {
  const query = useMemo(() => wikipediaQueryForInstrument(instrument, quoteName), [instrument, quoteName]);
  const [profile, setProfile] = useState<WikipediaProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProfile(null);

    const cached = readWikipediaProfileCache(query);
    if (cached) {
      setProfile(cached);
      setLoading(false);
      return () => controller.abort();
    }

    fetchWikipediaProfile(query, controller.signal)
      .then((next) => {
        if (!next || controller.signal.aborted) return;
        writeWikipediaProfileCache(query, next);
        setProfile(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProfile(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-white">Profile</h3>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.05]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.04]" />
        </div>
      ) : profile ? (
        <>
          <p className="text-sm leading-relaxed text-white/52">{profile.extract}</p>
          <p className="text-xs text-white/32">
            Source:{" "}
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-indigo-200 transition-colors hover:text-white"
            >
              Wikipedia · {profile.title}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-white/42">
          No Wikipedia profile was found for {instrument.label}. Quote data, chart history, and market statistics remain available above.
        </p>
      )}
    </section>
  );
}

function QuoteDetailPanel({
  instrument,
  comparisonSymbols,
  onComparisonChange,
  onBack,
}: {
  instrument: MarketInstrument;
  comparisonSymbols: string[];
  onComparisonChange: (symbols: string[]) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1M");
  const [notice, setNotice] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("area");
  const [chartMenuOpen, setChartMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareQuotes, setCompareQuotes] = useState<MarketQuote[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<DetailChartPoint | null>(null);
  const activeComparisonSymbols = useMemo(
    () => normalizeSymbolList(comparisonSymbols).filter((symbol) => symbol !== instrument.symbol.toUpperCase()),
    [comparisonSymbols, instrument.symbol]
  );
  const rangeConfig = useMemo(() => quoteRangeConfig(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setQuote(null);
    fetchQuote(instrument.symbol, rangeConfig.period, rangeConfig.interval)
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
  }, [instrument.symbol, rangeConfig.interval, rangeConfig.period]);

  useEffect(() => {
    const refreshMs = rangeConfig.refreshMs;
    if (!refreshMs || refreshMs <= 0) return;
    let cancelled = false;
    const refreshQuotes = () => {
      invalidate(instrument.symbol);
      fetchQuote(instrument.symbol, rangeConfig.period, rangeConfig.interval).then((next) => {
        if (!cancelled) setQuote(next);
      }).catch(() => {});

      activeComparisonSymbols.forEach((symbol) => {
        invalidate(symbol);
      });
      if (activeComparisonSymbols.length > 0) {
        Promise.allSettled(activeComparisonSymbols.map((symbol) => fetchQuote(symbol, rangeConfig.period, rangeConfig.interval))).then((results) => {
          if (cancelled) return;
          setCompareQuotes(
            results
              .filter((result): result is PromiseFulfilledResult<MarketQuote> => result.status === "fulfilled")
              .map((result) => result.value)
          );
        });
      }
    };
    const interval = window.setInterval(refreshQuotes, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeComparisonSymbols, instrument.symbol, rangeConfig.interval, rangeConfig.period, rangeConfig.refreshMs]);

  useEffect(() => {
    let cancelled = false;
    if (activeComparisonSymbols.length === 0) {
      setCompareQuotes([]);
      setCompareLoading(false);
      return;
    }

    setCompareLoading(true);
    Promise.allSettled(activeComparisonSymbols.map((symbol) => fetchQuote(symbol, rangeConfig.period, rangeConfig.interval))).then((results) => {
      if (cancelled) return;
      setCompareQuotes(
        results
          .filter((result): result is PromiseFulfilledResult<MarketQuote> => result.status === "fulfilled")
          .map((result) => result.value)
      );
      setCompareLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeComparisonSymbols, instrument.symbol, rangeConfig.interval, rangeConfig.period]);

  const chartData = useMemo(() => {
    if (!quote) return [];
    return quote.history.map((point, index, history) => pointToDetail(point, history[index - 1]?.price));
  }, [quote]);
  const displayedChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    const primaryStart = chartData[0]?.price ?? 1;
    return chartData.map((point, index) => {
      const next: DetailChartPoint = {
        ...point,
        primaryPerformance: performanceFrom(primaryStart, point.price),
      };
      compareQuotes.forEach((compareQuote) => {
        const compareHistory = compareQuote.history.slice(-chartData.length);
        const compareStart = compareHistory[0]?.price ?? 1;
        const compareIndex = index - Math.max(chartData.length - compareHistory.length, 0);
        const comparePoint = compareIndex >= 0 ? compareHistory[compareIndex] : undefined;
        next[compareKey(compareQuote.ticker, "price")] = comparePoint?.price ?? null;
        next[compareKey(compareQuote.ticker, "performance")] = comparePoint?.price
          ? performanceFrom(compareStart, comparePoint.price)
          : null;
      });
      return next;
    });
  }, [chartData, compareQuotes]);

  const addCompareSymbol = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    setCompareSymbol("");
    setChartMode("line");
    setCompareOpen(false);
    if (!activeComparisonSymbols.includes(normalized) && normalized !== instrument.symbol.toUpperCase()) {
      onComparisonChange([...activeComparisonSymbols, normalized]);
    }
  };

  const removeCompareSymbol = (symbol: string) => {
    onComparisonChange(activeComparisonSymbols.filter((item) => item !== symbol.toUpperCase()));
    setHoverPoint(null);
  };

  const filteredCompareAssets = useMemo(() => {
    const query = compareSymbol.trim().toLowerCase();
    const excluded = new Set([instrument.symbol.toUpperCase(), ...activeComparisonSymbols]);
    return COMPARE_ASSETS.filter((asset) => {
      if (excluded.has(asset.symbol.toUpperCase())) return false;
      if (!query) return true;
      return [asset.symbol, asset.label, asset.exchange].some((value) => value.toLowerCase().includes(query));
    }).slice(0, 8);
  }, [activeComparisonSymbols, compareSymbol, instrument.symbol]);

  const compareMode = activeComparisonSymbols.length > 0;
  useEffect(() => {
    if (compareMode && chartMode !== "line") setChartMode("line");
  }, [chartMode, compareMode]);

  const chartValues = compareMode
    ? displayedChartData.flatMap((point) => [
        point.primaryPerformance,
        ...compareQuotes.flatMap((compareQuote) => {
          const value = point[compareKey(compareQuote.ticker, "performance")];
          return typeof value === "number" ? [value] : [];
        }),
      ])
    : displayedChartData.map((point) => point.price);
  const singleAssetValues = chartMode === "candle"
    ? displayedChartData.flatMap((point) => [
        typeof point.high === "number" ? point.high : point.price,
        typeof point.low === "number" ? point.low : point.price,
      ])
    : displayedChartData.map((point) => point.price);
  const finalChartValues = compareMode ? chartValues : singleAssetValues;
  const yDomain = domainWithPadding(finalChartValues);
  const activePoint = hoverPoint ?? displayedChartData[displayedChartData.length - 1] ?? null;
  const positive = quote ? quote.change >= 0 : true;
  const activePrice = activePoint?.price ?? quote?.price ?? 0;
  const absoluteChange = quote ? activePrice - (quote.price - estimateAbsoluteChange(quote)) : 0;
  const activePercentChange = quote ? performanceFrom(quote.price - estimateAbsoluteChange(quote), activePrice) : 0;
  const primaryLineColor = compareMode ? COMPARE_COLORS[0] : positive ? "var(--color-green-positive)" : "var(--color-red-negative)";
  const chartTransitionKey = `${chartMode}:${range}:${activeComparisonSymbols.join("|") || "single"}:${quote?.ticker ?? instrument.symbol}`;
  const isCrypto = instrument.category === "Crypto";
  const displayName = quoteDisplayName(instrument, quote);
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

  useEffect(() => {
    setHoverPoint(null);
  }, [chartTransitionKey]);

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

      <div className="space-y-3">
        <div>
          <p className="text-sm text-white/42">{instrument.exchange} · {instrument.category}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">{displayName}</h2>
        </div>

        {loading ? (
          <div className="h-20 w-72 animate-pulse rounded-2xl bg-white/[0.06]" />
        ) : quote ? (
          <div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-white">
                {quote.currency && quote.currency !== "USD" ? `${quote.currency} ` : quote.ticker.includes("^") ? "" : "$"}{fmt(activePrice)}
              </p>
              <span className={cn("mb-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums", activePercentChange >= 0 ? "text-green-positive" : "text-red-negative")}>
                {activePercentChange >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {activePercentChange >= 0 ? "+" : "-"}{fmt(Math.abs(activePercentChange))}%
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
          <DropdownMenu open={chartMenuOpen} onOpenChange={setChartMenuOpen}>
            <DropdownMenuTrigger
              aria-expanded={chartMenuOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[var(--border-card)] bg-[var(--surface-card)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"
            >
              <ChartModeIcon mode={chartMode} />
              {CHART_MODE_LABELS[chartMode]}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-white/35 transition-transform duration-200",
                  chartMenuOpen && "rotate-180"
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-52">
              {(Object.keys(CHART_MODE_LABELS) as ChartMode[]).map((mode) => {
                const disabled = compareMode && mode !== "line";
                return (
                  <DropdownMenuItem
                    key={mode}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setChartMode(mode);
                      setChartMenuOpen(false);
                    }}
                    className={cn(
                      "cursor-pointer justify-between",
                      chartMode === mode && "bg-indigo-primary/12 text-indigo-100",
                      disabled && "pointer-events-none opacity-40"
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ChartModeIcon mode={mode} />
                      {CHART_MODE_LABELS[mode]}
                    </span>
                    {chartMode === mode && <span className="h-2 w-2 rounded-full bg-indigo-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu open={compareOpen} onOpenChange={setCompareOpen}>
            <DropdownMenuTrigger
              aria-expanded={compareOpen}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors",
                compareOpen || compareMode
                  ? "border-indigo-primary/30 bg-indigo-primary/12 text-indigo-100"
                  : "border-[var(--border-card)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <Plus className="h-4 w-4" />
              Compare
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  compareOpen ? "rotate-180 text-indigo-100/70" : "text-white/35"
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="w-80 p-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-white/35" />
                <input
                  value={compareSymbol}
                  onChange={(event) => setCompareSymbol(event.target.value)}
                  placeholder="Search for stocks, indices, etc."
                  className="h-6 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
              <div className="mt-2 space-y-1">
                {filteredCompareAssets.length > 0 ? (
                  filteredCompareAssets.map((asset) => (
                    <DropdownMenuItem
                      key={`${asset.symbol}-${asset.exchange}`}
                      onClick={() => addCompareSymbol(asset.symbol)}
                      className="h-auto cursor-pointer py-2.5"
                    >
                      <TickerAvatar symbol={asset.symbol} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white/86">{asset.label}</span>
                        <span className="block truncate text-xs text-white/38">
                          {asset.symbol} · {asset.exchange}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <p className="px-3 py-4 text-sm text-white/38">No matching assets.</p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {compareLoading && <Loader2 className="h-4 w-4 animate-spin text-white/35" />}
        </div>

        {compareMode && (
          <div className="flex flex-wrap items-center gap-2">
            {activeComparisonSymbols.map((symbol, index) => {
              const asset = findMarketInstrument(symbol);
              const color = COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length];
              return (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-sm font-medium text-white/78"
                  title={asset.label}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {symbol}
                  <button
                    type="button"
                    onClick={() => removeCompareSymbol(symbol)}
                    className="rounded-full p-0.5 text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
                    aria-label={`Remove ${symbol} comparison`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
            <span className="text-xs text-white/35">Comparison chart uses normalized percent performance.</span>
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
                price: { label: instrument.symbol, color: primaryLineColor },
                primaryPerformance: { label: instrument.symbol, color: primaryLineColor },
              }}
              className="aspect-auto h-full w-full"
              initialDimension={{ width: 720, height: 360 }}
            >
              <ComposedChart
                key={chartTransitionKey}
                data={displayedChartData}
                margin={{ top: 10, right: 8, bottom: 8, left: 0 }}
                onMouseMove={(state: unknown) => {
                  const payload = (state as { activePayload?: Array<{ payload?: DetailChartPoint }> })?.activePayload?.[0]?.payload;
                  if (payload) setHoverPoint(payload);
                }}
                onMouseLeave={() => setHoverPoint(null)}
              >
                <defs>
                  <linearGradient id="watch-detail-chart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }} minTickGap={28} />
                <YAxis
                  orientation="right"
                  domain={yDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "rgba(255,255,255,0.36)", fontSize: 11 }}
                  width={58}
                  tickFormatter={(value) => compareMode ? `${Number(value).toFixed(1)}%` : fmt(Number(value), 0)}
                />
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <ChartTooltip
                  content={
                    <WatchlistChartTooltip
                      compareQuotes={compareQuotes}
                      compareMode={compareMode}
                      primaryLabel={instrument.symbol}
                      primaryColor={primaryLineColor}
                    />
                  }
                  cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
                />
                {compareMode && <ReferenceLine y={0} stroke="rgba(255,255,255,0.32)" strokeDasharray="4 4" />}
                {hoverPoint && (
                  <ReferenceLine
                    y={compareMode ? hoverPoint.primaryPerformance : hoverPoint.price}
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={1}
                  />
                )}
                {chartMode === "area" && !compareMode ? (
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="url(#watch-detail-chart)"
                    className={positive ? "text-green-positive" : "text-red-negative"}
                    dot={false}
                    activeDot={{ r: 4, fill: "currentColor", stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive
                    {...MAIN_CHART_ANIMATION}
                  />
                ) : chartMode === "bar" && !compareMode ? (
                  <Bar
                    dataKey="price"
                    fill={primaryLineColor}
                    radius={[3, 3, 0, 0]}
                    opacity={0.72}
                    isAnimationActive
                    {...MAIN_CHART_ANIMATION}
                  />
                ) : chartMode === "candle" && !compareMode ? (
                  <>
                    <Bar dataKey="candleBase" stackId="candle" fill="transparent" isAnimationActive={false} />
                    <Bar
                      dataKey="candleBody"
                      stackId="candle"
                      radius={[2, 2, 2, 2]}
                      isAnimationActive
                      {...MAIN_CHART_ANIMATION}
                    >
                      {displayedChartData.map((point, index) => (
                        <Cell
                          key={`candle-${point.label}-${index}`}
                          fill={point.candlePositive ? "var(--color-green-positive)" : "var(--color-red-negative)"}
                          opacity={0.78}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="linear"
                      dataKey="price"
                      stroke="rgba(255,255,255,0.24)"
                      strokeWidth={1}
                      dot={false}
                      activeDot={{ r: 3, fill: primaryLineColor, stroke: "#fff", strokeWidth: 1.5 }}
                      isAnimationActive
                      {...MAIN_CHART_ANIMATION}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey={compareMode ? "primaryPerformance" : "price"}
                    stroke={primaryLineColor}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: primaryLineColor, stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive
                    {...MAIN_CHART_ANIMATION}
                  />
                )}
                {compareMode && compareQuotes.map((compareQuote, index) => (
                  <Line
                    key={compareQuote.ticker}
                    type="monotone"
                    dataKey={compareKey(compareQuote.ticker, "performance")}
                    stroke={COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length], stroke: "#fff", strokeWidth: 2 }}
                    isAnimationActive
                    {...MAIN_CHART_ANIMATION}
                  />
                ))}
              </ComposedChart>
            </ChartContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-sm text-white/32">
              {loading ? "Loading chart..." : "No chart history available"}
            </div>
          )}
        </div>

        <Tabs value={range} onValueChange={(value) => setRange(String(value))}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none border-t border-white/[0.06] bg-transparent p-0 pt-3">
            {RANGE_OPTIONS.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className="h-8 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 text-xs font-semibold text-white/48 transition-colors data-active:border-indigo-primary/35 data-active:bg-indigo-primary/16 data-active:text-indigo-100"
              >
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

      <WikipediaProfile instrument={instrument} quoteName={quote?.name} />

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanelView>({ type: "home" });
  const comparisonSymbols = useMemo(
    () => normalizeSymbolList((searchParams.get("comparison") ?? "").split(",")),
    [searchParams]
  );
  const primaryQuoteSymbol = useMemo(() => {
    const querySymbol = searchParams.get("quote") ?? searchParams.get("ticker");
    if (querySymbol?.trim()) return querySymbol.trim();
    const quotePathMatch = pathname.match(/\/quote\/([^/?#]+)/);
    return quotePathMatch?.[1] ? decodeURIComponent(quotePathMatch[1]) : null;
  }, [pathname, searchParams]);
  const activeRightPanelSymbol = rightPanel.type === "quote" ? rightPanel.instrument.symbol.toUpperCase() : null;

  const updateQuoteUrl = useCallback(
    (symbol: string | null, nextComparisons: string[] = comparisonSymbols) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedSymbol = symbol?.trim().toUpperCase() ?? null;
      const normalizedComparisons = normalizeSymbolList(nextComparisons).filter(
        (item) => !normalizedSymbol || item !== normalizedSymbol
      );

      if (normalizedSymbol) params.set("quote", normalizedSymbol);
      else params.delete("quote");
      params.delete("ticker");

      if (normalizedComparisons.length > 0) params.set("comparison", normalizedComparisons.join(","));
      else params.delete("comparison");

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [comparisonSymbols, pathname, router, searchParams]
  );

  useEffect(() => {
    if (!primaryQuoteSymbol) return;
    const normalized = primaryQuoteSymbol.toUpperCase();
    if (activeRightPanelSymbol === normalized) return;
    setRightPanel({ type: "quote", instrument: findMarketInstrument(normalized) });
  }, [activeRightPanelSymbol, primaryQuoteSymbol]);

  const openQuotePanel = useCallback(
    (instrument: MarketInstrument) => {
      setRightPanel({ type: "quote", instrument });
      updateQuoteUrl(instrument.symbol, comparisonSymbols);
    },
    [comparisonSymbols, updateQuoteUrl]
  );

  const openEarningsPanel = useCallback(
    (event: EarningsEvent) => {
      setRightPanel({ type: "earnings", event });
      updateQuoteUrl(null, []);
    },
    [updateQuoteUrl]
  );

  const closeDetailPanel = useCallback(() => {
    setRightPanel({ type: "home" });
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const updateComparisonSymbols = useCallback(
    (symbols: string[]) => {
      const currentSymbol = rightPanel.type === "quote" ? rightPanel.instrument.symbol : primaryQuoteSymbol;
      updateQuoteUrl(currentSymbol ?? null, symbols);
    },
    [primaryQuoteSymbol, rightPanel, updateQuoteUrl]
  );

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
              <QuoteDetailPanel
                instrument={rightPanel.instrument}
                comparisonSymbols={comparisonSymbols}
                onComparisonChange={updateComparisonSymbols}
                onBack={closeDetailPanel}
              />
            ) : rightPanel.type === "earnings" ? (
              <EarningsDetailPanel event={rightPanel.event} onBack={closeDetailPanel} />
            ) : (
              <>
                <MarketSections onOpen={openQuotePanel} />

                <section>
                  <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">US market summary</h2>
                  <DynamicMarketBrief />
                  <MarketSummary />
                </section>

                <UpcomingEarnings onOpen={openEarningsPanel} />

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
