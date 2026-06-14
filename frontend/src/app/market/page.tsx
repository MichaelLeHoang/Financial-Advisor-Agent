"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDown,
    ArrowDownRight,
    ArrowUp,
    ArrowUpRight,
    CandlestickChart,
    ChartNoAxesColumn,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    LineChart,
    Loader2,
    Maximize2,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    Trash2Icon,
    X,
} from "lucide-react";
import { motion } from "motion/react";
import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { api, type EarningsPoint, type MarketQuote, type QuarterlyFinancial } from "@/lib/api";
import { fetchQuote as fetchCachedQuote, invalidate as invalidateQuote } from "@/lib/quote-cache";
import {
    CHART_RANGES,
    DEFAULT_MARKET_TICKERS,
    createMarketSeries,
    createMarketSymbol,
    normalizeTicker,
    searchMarketSymbols,
    type ChartRange,
    type MarketPoint,
    type MarketSymbol,
} from "@/lib/market-data";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface StockInfo extends MarketSymbol {
    data: MarketPoint[];
    loading?: boolean;
    currency?: string | null;
    openPrice?: number | null;
    dayHigh?: number | null;
    dayLow?: number | null;
    marketCap?: number | null;
    volume?: number | null;
    peRatio?: number | null;
    fiftyTwoWeekHigh?: number | null;
    fiftyTwoWeekLow?: number | null;
    dividendYield?: number | null;
    dividendRate?: number | null;
    quarterlyDividendAmount?: number | null;
    earnings?: EarningsPoint[];
    quarterlyFinancials?: QuarterlyFinancial[];
}

type DetailChartStyle = "area" | "line" | "candle" | "bar";
type MarketChartRange = ChartRange | "MAX";

interface DetailChartPoint extends MarketPoint {
    primaryPerformance: number;
    open?: number;
    high?: number;
    low?: number;
    candleBase?: number;
    candleBody?: number;
    candlePositive?: boolean;
    [key: string]: string | number | boolean | null | undefined;
}

const MARKET_STOCKS_STORAGE_KEY = "market.savedStocks";
const CHART_DETAIL_RANGES: MarketChartRange[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];
const COMPARE_COLORS = ["#34d399", "#818cf8", "#22d3ee", "#fbbf24", "#f472b6"];
const CHART_STYLE_LABELS: Record<DetailChartStyle, string> = {
    area: "Area",
    line: "Line",
    candle: "Candle",
    bar: "Bar",
};

function createStock(ticker: string): StockInfo {
    const symbol = createMarketSymbol(ticker);
    return {
        ...symbol,
        data: createMarketSeries(symbol, "1M"),
    };
}

function quoteToStock(quote: MarketQuote, fallback?: StockInfo): StockInfo {
    return {
        ticker: quote.ticker,
        name: quote.name || fallback?.name || quote.ticker,
        exchange: quote.exchange || fallback?.exchange || "Market",
        sector: quote.sector || fallback?.sector || "Instrument",
        price: quote.price,
        change: quote.change,
        currency: quote.currency,
        openPrice: quote.open_price,
        dayHigh: quote.day_high,
        dayLow: quote.day_low,
        marketCap: quote.market_cap,
        volume: quote.volume,
        peRatio: quote.pe_ratio,
        fiftyTwoWeekHigh: quote.fifty_two_week_high,
        fiftyTwoWeekLow: quote.fifty_two_week_low,
        dividendYield: quote.dividend_yield,
        dividendRate: quote.dividend_rate,
        quarterlyDividendAmount: quote.quarterly_dividend_amount,
        data: quote.history.length > 0 ? quote.history : fallback?.data ?? createMarketSeries(createMarketSymbol(quote.ticker), "1M"),
        earnings: quote.earnings,
        quarterlyFinancials: quote.quarterly_financials,
    };
}

function quotePeriod(range: MarketChartRange): [string, string] {
    const periods: Record<MarketChartRange, [string, string]> = {
        "1D": ["1d", "1m"],
        "5D": ["5d", "5m"],
        "1M": ["1mo", "30m"],
        "6M": ["6mo", "1d"],
        "YTD": ["ytd", "1d"],
        "1Y": ["1y", "1d"],
        "5Y": ["5y", "1wk"],
        "MAX": ["max", "1mo"],
    };
    return periods[range];
}

function rangeRefreshMs(range: MarketChartRange): number | null {
    if (range === "1D") return 60_000;
    if (range === "5D") return 5 * 60_000;
    if (range === "1M") return 15 * 60_000;
    if (range === "6M" || range === "YTD" || range === "1Y") return 60 * 60_000;
    return null;
}

function readSavedMarketStocks(): string[] {
    try {
        const raw = window.localStorage.getItem(MARKET_STOCKS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return normalizeSymbolList(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
        return [];
    }
}

function normalizeSymbolList(symbols: string[]): string[] {
    const seen = new Set<string>();
    return symbols
        .map(normalizeTicker)
        .filter((symbol) => {
            if (!symbol || seen.has(symbol)) return false;
            seen.add(symbol);
            return true;
        });
}

function pointToDetail(point: MarketPoint, previousPrice?: number): DetailChartPoint {
    const ohlcPoint = point as MarketPoint & { open?: number; high?: number; low?: number };
    const open = typeof ohlcPoint.open === "number" ? ohlcPoint.open : previousPrice ?? point.price;
    const high = typeof ohlcPoint.high === "number" ? ohlcPoint.high : Math.max(open, point.price);
    const low = typeof ohlcPoint.low === "number" ? ohlcPoint.low : Math.min(open, point.price);
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

function performanceFrom(start: number, current: number): number {
    if (!Number.isFinite(start) || start === 0) return 0;
    return ((current - start) / Math.abs(start)) * 100;
}

function domainWithPadding(values: number[]): [number, number] {
    const finite = values.filter((value) => Number.isFinite(value));
    if (finite.length === 0) return [0, 1];
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const padding = Math.max((max - min) * 0.12, Math.abs(max || min || 1) * 0.01);
    return [min - padding, max + padding];
}

function compareKey(symbol: string, suffix: "price" | "performance"): string {
    return `compare_${symbol.replace(/[^A-Z0-9]/gi, "_")}_${suffix}`;
}

function estimateAbsoluteChange(stock: StockInfo): number {
    const percent = stock.change / 100;
    if (!Number.isFinite(percent) || percent === -1) return 0;
    return stock.price - stock.price / (1 + percent);
}

function formatAxisPrice(value: number) {
    if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function ChartModeIcon({ mode }: { mode: DetailChartStyle }) {
    if (mode === "candle") return <CandlestickChart className="size-4" />;
    if (mode === "bar") return <ChartNoAxesColumn className="size-4" />;
    return <LineChart className="size-4" />;
}

function DetailChartTooltip({
    active,
    payload,
    primaryTicker,
    compareQuotes,
    compareMode,
}: {
    active?: boolean;
    payload?: Array<{ payload?: DetailChartPoint }>;
    primaryTicker: string;
    compareQuotes: StockInfo[];
    compareMode: boolean;
}) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    return (
        <div className="min-w-52 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-tooltip)] px-3 py-2 text-xs shadow-[var(--shadow-tooltip)]">
            <p className="font-semibold text-white/85">{point.label}</p>
            <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-white/55">
                        <span className="size-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[0] }} />
                        {primaryTicker}
                    </span>
                    <span className="font-semibold tabular-nums text-white">
                        {compareMode
                            ? `${formatCurrency(point.price)} · ${point.primaryPerformance >= 0 ? "+" : ""}${point.primaryPerformance.toFixed(2)}%`
                            : formatCurrency(point.price)}
                    </span>
                </div>
                {compareMode && compareQuotes.map((compareQuote, index) => {
                    const price = point[compareKey(compareQuote.ticker, "price")];
                    const performance = point[compareKey(compareQuote.ticker, "performance")];
                    if (typeof price !== "number" || typeof performance !== "number") return null;
                    return (
                        <div key={compareQuote.ticker} className="flex items-center justify-between gap-4">
                            <span className="inline-flex items-center gap-2 text-white/55">
                                <span className="size-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length] }} />
                                {compareQuote.ticker}
                            </span>
                            <span className="font-semibold tabular-nums text-white">
                                {formatCurrency(price)} · {performance >= 0 ? "+" : ""}{performance.toFixed(2)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function MarketPage() {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const marketTopRef = useRef<HTMLDivElement>(null);
    const [stocks, setStocks] = useState<StockInfo[]>(() => DEFAULT_MARKET_TICKERS.map(createStock));
    const [query, setQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [symbolMatches, setSymbolMatches] = useState<MarketSymbol[]>([]);
    const [searchingSymbols, setSearchingSymbols] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
    const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
    const [selectedRange, setSelectedRange] = useState<MarketChartRange>("1M");
    const [chartStyle, setChartStyle] = useState<DetailChartStyle>("area");
    const [comparisonSymbols, setComparisonSymbols] = useState<string[]>([]);
    const [pendingRemoval, setPendingRemoval] = useState<StockInfo | null>(null);
    const [skipRemoveConfirm, setSkipRemoveConfirm] = useState(false);
    const [skipRemoveConfirmDraft, setSkipRemoveConfirmDraft] = useState(false);

    const localMatches = useMemo(() => searchMarketSymbols(query), [query]);
    const matches = symbolMatches.length > 0 ? symbolMatches : localMatches;

    useEffect(() => {
        const saved = readSavedMarketStocks();
        if (saved.length > 0) {
            setStocks(saved.map(createStock));
        }
        setSkipRemoveConfirm(window.localStorage.getItem("market.skipRemoveConfirm") === "true");
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;
        window.localStorage.setItem(MARKET_STOCKS_STORAGE_KEY, JSON.stringify(stocks.map((stock) => stock.ticker)));
    }, [mounted, stocks]);

    useEffect(() => {
        const normalized = query.trim();
        if (normalized.length < 1) {
            setSymbolMatches([]);
            setSearchingSymbols(false);
            return;
        }

        let cancelled = false;
        setSearchingSymbols(true);
        const timer = window.setTimeout(() => {
            api.marketSearch(normalized)
                .then((results) => {
                    if (cancelled) return;
                    setSymbolMatches(results.map((result) => ({
                        ticker: result.ticker,
                        name: result.name,
                        exchange: result.exchange || "Market",
                        sector: result.sector || result.quote_type || "Instrument",
                        price: 0,
                        change: 0,
                    })));
                })
                .catch(() => {
                    if (cancelled) return;
                    setSymbolMatches([]);
                })
                .finally(() => {
                    if (!cancelled) setSearchingSymbols(false);
                });
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [query]);

    useEffect(() => {
        const focusSearch = () => {
            marketTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            window.requestAnimationFrame(() => {
                searchInputRef.current?.focus();
                setSearchOpen(true);
            });
        };

        window.addEventListener("market-search:focus", focusSearch);
        if (new URLSearchParams(window.location.search).get("focus") === "search") focusSearch();
        return () => window.removeEventListener("market-search:focus", focusSearch);
    }, []);

    const fetchQuote = async (ticker: string, fallback?: StockInfo, range: MarketChartRange = "1M") => {
        const [period, interval] = quotePeriod(range);
        const quote = await fetchCachedQuote(ticker, period, interval);
        return quoteToStock(quote, fallback);
    };

    const addTicker = (value: string) => {
        const ticker = normalizeTicker(value);
        if (!ticker) return;

        setStocks((current) => {
            if (current.some((stock) => stock.ticker === ticker)) return current;
            return [{ ...createStock(ticker), loading: true }, ...current];
        });
        setQuery("");
        setSearchOpen(false);

        fetchQuote(ticker)
            .then((fresh) => {
                setStocks((current) => current.map((stock) => stock.ticker === ticker ? fresh : stock));
            })
            .catch(() => {
                setStocks((current) => current.map((stock) => stock.ticker === ticker ? { ...stock, loading: false } : stock));
            });
    };

    const removeTicker = (ticker: string) => {
        setStocks((current) => current.filter((stock) => stock.ticker !== ticker));
        setSelectedStock((current) => current?.ticker === ticker ? null : current);
    };

    const requestRemoveTicker = (stock: StockInfo) => {
        if (skipRemoveConfirm) {
            removeTicker(stock.ticker);
            return;
        }
        setPendingRemoval(stock);
        setSkipRemoveConfirmDraft(false);
    };

    const confirmRemoveTicker = () => {
        if (!pendingRemoval) return;
        if (skipRemoveConfirmDraft) {
            window.localStorage.setItem("market.skipRemoveConfirm", "true");
            setSkipRemoveConfirm(true);
        }
        removeTicker(pendingRemoval.ticker);
        setPendingRemoval(null);
    };

    const openChartForTicker = (ticker: string) => {
        const normalized = normalizeTicker(ticker);
        const existing = stocks.find((stock) => stock.ticker === normalized);
        const next = existing ?? createStock(normalized);
        setSelectedStock(next);
        setSelectedRange("1M");
        setChartStyle("area");
        setComparisonSymbols([]);

        fetchQuote(normalized, next)
            .then((fresh) => {
                setSelectedStock((current) => current?.ticker === fresh.ticker ? fresh : current);
                setStocks((current) => current.map((stock) => stock.ticker === fresh.ticker ? fresh : stock));
            })
            .catch(() => undefined);
    };

    const changeChartRange = (range: MarketChartRange) => {
        setSelectedRange(range);
        if (!selectedStock) return;

        fetchQuote(selectedStock.ticker, selectedStock, range)
            .then((fresh) => {
                setSelectedStock((current) => current?.ticker === fresh.ticker ? fresh : current);
                setStocks((current) => current.map((stock) => stock.ticker === fresh.ticker ? fresh : stock));
            })
            .catch(() => undefined);
    };

    const handleStockLoaded = useCallback((fresh: StockInfo) => {
        setSelectedStock((current) => current?.ticker === fresh.ticker ? fresh : current);
        setStocks((current) => current.map((stock) => stock.ticker === fresh.ticker ? fresh : stock));
    }, []);

    const refresh = async () => {
        if (stocks.length === 0) return;
        setLoading(true);
        setUpgradeMessage(null);
        setStocks((current) => current.map((stock) => ({ ...stock, loading: true })));
        const updated = await Promise.all(
            stocks.map(async (stock) => {
                try {
                    return await fetchQuote(stock.ticker, stock);
                } catch {
                    return { ...stock, loading: false };
                }
            })
        );
        setStocks(updated);
        setLoading(false);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div ref={marketTopRef} className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-white">
                        <span className="gradient-highlight">Market</span> Overview
                    </h1>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-[34rem]">
                    <div className="flex gap-2">
                        <MarketSearch
                            inputRef={searchInputRef}
                            query={query}
                            matches={matches}
                            searching={searchingSymbols}
                            open={searchOpen}
                            onOpenChange={setSearchOpen}
                            onQueryChange={setQuery}
                            onSelect={addTicker}
                            onPreview={openChartForTicker}
                        />
                        <Button
                            onClick={refresh}
                            disabled={loading || stocks.length === 0}
                            size="icon"
                            variant="outline"
                            className="size-11 rounded-xl border-white/[0.06] bg-white/[0.045] text-white/60 hover:bg-white/[0.08] hover:text-white"
                            aria-label="Refresh market data"
                        >
                            <RefreshCw data-icon="inline-start" className={cn(loading && "animate-spin")} />
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setStocks(DEFAULT_MARKET_TICKERS.map(createStock))}
                        >
                            Restore defaults
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setStocks([])}
                            disabled={stocks.length === 0}
                        >
                            <Trash2 data-icon="inline-start" />
                            Clear all
                        </Button>
                        <span className="text-xs text-white/32">{stocks.length} symbols</span>
                    </div>
                </div>
            </div>

            {upgradeMessage && <div className="mb-8"><UpgradePrompt message={upgradeMessage} /></div>}

            {stocks.length === 0 ? (
                <Empty className="min-h-[24rem]">
                    <EmptyTitle>No tickers selected</EmptyTitle>
                    <EmptyDescription>Search a ticker or restore the default market list.</EmptyDescription>
                </Empty>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {stocks.map((stock) => (
                        <MarketCard
                            key={stock.ticker}
                            stock={stock}
                            mounted={mounted}
                            onOpen={() => openChartForTicker(stock.ticker)}
                            onRemove={() => removeTicker(stock.ticker)}
                            onRequestRemove={() => requestRemoveTicker(stock)}
                        />
                    ))}
                </div>
            )}

            <MarketChartDialog
                stock={selectedStock}
                mounted={mounted}
                range={selectedRange}
                chartStyle={chartStyle}
                comparisonSymbols={comparisonSymbols}
                onRangeChange={changeChartRange}
                onStyleChange={setChartStyle}
                onComparisonChange={setComparisonSymbols}
                onStockLoaded={handleStockLoaded}
                onOpenChange={(open) => {
                    if (!open) setSelectedStock(null);
                }}
            />

            <RemoveTickerDialog
                stock={pendingRemoval}
                skipChecked={skipRemoveConfirmDraft}
                onSkipCheckedChange={setSkipRemoveConfirmDraft}
                onCancel={() => setPendingRemoval(null)}
                onConfirm={confirmRemoveTicker}
            />
        </div>
    );
}

function MarketSearch({
    inputRef,
    query,
    matches,
    searching,
    open,
    onOpenChange,
    onQueryChange,
    onSelect,
    onPreview,
}: {
    inputRef: RefObject<HTMLInputElement | null>;
    query: string;
    matches: MarketSymbol[];
    searching: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onQueryChange: (query: string) => void;
    onSelect: (ticker: string) => void;
    onPreview: (ticker: string) => void;
}) {
    const normalizedQuery = normalizeTicker(query);
    const canAddCustom = /^[A-Z0-9.-]{1,16}$/.test(normalizedQuery) && matches.length === 0;

    return (
        <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-white/36" />
            <Input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                    onQueryChange(event.target.value);
                    onOpenChange(true);
                }}
                onFocus={() => onOpenChange(true)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        onSelect(matches[0]?.ticker ?? query);
                    }
                    if (event.key === "Escape") onOpenChange(false);
                }}
                placeholder="Search market or add ticker..."
                className="h-11 rounded-xl border-white/[0.06] bg-white/[0.045] pl-11 pr-11 text-sm"
            />
            {query && (
                <button
                    type="button"
                    onClick={() => {
                        onQueryChange("");
                        onOpenChange(false);
                        inputRef.current?.focus();
                    }}
                    className="group absolute right-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    aria-label="Clear search"
                >
                    <img
                        src="/close-svgrepo-com.svg"
                        alt=""
                        aria-hidden="true"
                        className="size-4 opacity-55 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_7px_rgba(255,255,255,0.65)]"
                    />
                </button>
            )}

            {open && query && (
                <Card className="absolute left-0 right-0 top-13 z-30 rounded-2xl border-[var(--theme-border)] bg-[var(--surface-panel)] py-2 shadow-[var(--shadow-popover)]">
                    <CardContent className="flex max-h-80 flex-col gap-1 overflow-y-auto px-2 py-0">
                        {matches.map((match) => (
                            <div
                                key={match.ticker}
                                onMouseDown={(event) => event.preventDefault()}
                                className="group/search-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[var(--shadow-row-hover)]"
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelect(match.ticker)}
                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-primary/16 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/24 transition-colors group-hover/search-item:bg-indigo-primary/24 group-hover/search-item:text-white">
                                    {match.ticker.slice(0, 2)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white">{match.ticker}</span>
                                        <Badge variant="outline" className="h-5 rounded-md text-[10px]">{match.exchange}</Badge>
                                    </div>
                                    <div className="truncate text-xs text-white/42">{match.name}</div>
                                </span>
                                </button>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onPreview(match.ticker);
                                            onOpenChange(false);
                                        }}
                                        className="flex size-8 items-center justify-center rounded-lg text-white/38 transition-colors hover:bg-white/[0.1] hover:text-white"
                                        aria-label={`Open full chart for ${match.ticker}`}
                                    >
                                        <Maximize2 className="size-4" />
                                    </button>
                                    <Plus className="size-4 text-white/38" />
                                </div>
                            </div>
                        ))}

                        {searching && matches.length === 0 && (
                            <div className="px-3 py-3 text-sm text-white/42">Searching symbols...</div>
                        )}

                        {!searching && matches.length === 0 && !canAddCustom && (
                            <div className="px-3 py-3 text-sm text-white/42">No symbols found.</div>
                        )}

                        {canAddCustom && !searching && (
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => onSelect(query)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                            >
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-secondary/14 text-cyan-secondary ring-1 ring-cyan-secondary/24">
                                    <Plus className="size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-white">Add {normalizeTicker(query)}</div>
                                    <div className="text-xs text-white/42">Create a custom market tile</div>
                                </div>
                            </button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function MarketCard({
    stock,
    mounted,
    onOpen,
    onRequestRemove,
}: {
    stock: StockInfo;
    mounted: boolean;
    onOpen: () => void;
    onRemove: () => void;
    onRequestRemove: () => void;
}) {
    const up = stock.change >= 0;

    return (
        <motion.div whileHover={{ y: -5 }} className="group">
            <Card
                role="button"
                tabIndex={0}
                onClick={onOpen}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onOpen();
                }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[var(--shadow-accent-card)] transition-all duration-300 group-hover:border-white/[0.12] group-hover:bg-white/[0.07] focus:outline-none focus-visible:border-white/[0.12] focus-visible:ring-0"
            >
                <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h3 className="text-2xl font-bold text-white">{stock.ticker}</h3>
                            <p className="truncate text-sm text-white/40">{stock.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "h-6 rounded-lg border-transparent gap-1",
                                    up ? "bg-green-positive/20 text-green-positive" : "bg-red-negative/20 text-red-negative"
                                )}
                            >
                                {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                {formatChange(stock.change)}
                            </Badge>
                            <button
                                type="button"
                                className="group inline-flex size-8 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRequestRemove();
                                }}
                                aria-label={`Remove ${stock.ticker}`}
                            >
                                <img
                                    src="/close-svgrepo-com.svg"
                                    alt=""
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                    className="size-4 opacity-55 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_7px_rgba(255,255,255,0.65)]"
                                />
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex items-end justify-between gap-3">
                        <div>
                            <div className="text-3xl font-bold">{formatCurrency(stock.price)}</div>
                            <div className="mt-1 text-xs text-white/35">{stock.loading ? "Updating..." : `${stock.exchange} · ${stock.sector}`}</div>
                        </div>
                        <Maximize2 className="size-4 text-white/30 transition-colors group-hover:text-white/70" />
                    </div>

                    <div className="h-24 min-h-24 w-full min-w-0">
                        {mounted ? <MiniChart stock={stock} /> : <div className="h-full w-full rounded-xl bg-white/[0.035]" />}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

/** Wrapper around ResponsiveContainer that waits for the parent to have valid dimensions before rendering. */
function SafeChartContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const check = () => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
                setReady(true);
            }
        };

        // Immediate check
        check();
        if (!ready) {
            const observer = new ResizeObserver(check);
            observer.observe(el);
            return () => observer.disconnect();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div ref={containerRef} className={cn("h-full w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none", className)}>
            {ready && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    {children as React.ReactElement}
                </ResponsiveContainer>
            )}
        </div>
    );
}

function MiniChart({ stock }: { stock: StockInfo }) {
    const up = stock.change >= 0;
    const color = up ? "#34d399" : "#f87171";

    return (
        <SafeChartContainer>
            <AreaChart data={stock.data} accessibilityLayer={false} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
                <defs>
                    <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Tooltip content={<MiniChartTooltip />} cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.28 }} />
                <Area
                    type="monotone"
                    dataKey="price"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#grad-${stock.ticker})`}
                    activeDot={{ r: 3, strokeWidth: 0, fill: color }}
                />
            </AreaChart>
        </SafeChartContainer>
    );
}

function MiniChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    const price = payload[0]?.value;

    return (
        <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--surface-tooltip)] px-2 py-1.5 shadow-[var(--shadow-tooltip)]">
            <div className="text-[10px] text-white/38">{label}</div>
            <div className="text-xs font-semibold text-white">{formatCurrency(price ?? 0)}</div>
        </div>
    );
}

function MarketChartDialog({
    stock,
    mounted,
    range,
    chartStyle,
    comparisonSymbols,
    onRangeChange,
    onStyleChange,
    onComparisonChange,
    onStockLoaded,
    onOpenChange,
}: {
    stock: StockInfo | null;
    mounted: boolean;
    range: MarketChartRange;
    chartStyle: DetailChartStyle;
    comparisonSymbols: string[];
    onRangeChange: (range: MarketChartRange) => void;
    onStyleChange: (style: DetailChartStyle) => void;
    onComparisonChange: (symbols: string[]) => void;
    onStockLoaded: (stock: StockInfo) => void;
    onOpenChange: (open: boolean) => void;
}) {
    const [earningsExpanded, setEarningsExpanded] = useState(false);
    const [quarterIdx, setQuarterIdx] = useState(0);
    const [detailStock, setDetailStock] = useState<StockInfo | null>(stock);
    const [loading, setLoading] = useState(false);
    const [compareQuery, setCompareQuery] = useState("");
    const [compareQuotes, setCompareQuotes] = useState<StockInfo[]>([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [hoverPoint, setHoverPoint] = useState<DetailChartPoint | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        setEarningsExpanded(false);
        setQuarterIdx(0);
        setDetailStock(stock);
        setHoverPoint(null);
        setNotice(null);
    }, [stock]);

    const [period, interval] = useMemo(() => quotePeriod(range), [range]);

    useEffect(() => {
        if (!stock) return;
        let cancelled = false;
        setLoading(true);
        fetchCachedQuote(stock.ticker, period, interval)
            .then((quote) => {
                if (cancelled) return;
                const fresh = quoteToStock(quote, stock);
                setDetailStock(fresh);
                onStockLoaded(fresh);
            })
            .catch(() => {
                if (!cancelled) setDetailStock(stock);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    // Fetch on symbol/range changes only. `stock` object identity changes when fresh quotes land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interval, onStockLoaded, period, stock?.ticker]);

    useEffect(() => {
        if (!stock) return;
        const refreshMs = rangeRefreshMs(range);
        if (!refreshMs) return;

        let cancelled = false;
        const timer = window.setInterval(() => {
            invalidateQuote(stock.ticker);
            fetchCachedQuote(stock.ticker, period, interval)
                .then((quote) => {
                    if (cancelled) return;
                    const fresh = quoteToStock(quote, detailStock ?? stock);
                    setDetailStock(fresh);
                    onStockLoaded(fresh);
                })
                .catch(() => undefined);

            comparisonSymbols.forEach((symbol) => invalidateQuote(symbol));
        }, refreshMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    // Auto-refresh follows the active symbol/range and uses the latest cached detail state as fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comparisonSymbols, interval, onStockLoaded, period, range, stock?.ticker]);

    const activeComparisonSymbols = useMemo(
        () => normalizeSymbolList(comparisonSymbols).filter((symbol) => symbol !== stock?.ticker),
        [comparisonSymbols, stock?.ticker]
    );

    useEffect(() => {
        if (!stock || activeComparisonSymbols.length === 0) {
            setCompareQuotes([]);
            setCompareLoading(false);
            return;
        }

        let cancelled = false;
        setCompareLoading(true);
        Promise.allSettled(activeComparisonSymbols.map((symbol) => fetchCachedQuote(symbol, period, interval))).then((results) => {
            if (cancelled) return;
            setCompareQuotes(
                results
                    .filter((result): result is PromiseFulfilledResult<MarketQuote> => result.status === "fulfilled")
                    .map((result) => quoteToStock(result.value, createStock(result.value.ticker)))
            );
            setCompareLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [activeComparisonSymbols, interval, period, stock]);

    const compareMode = activeComparisonSymbols.length > 0;
    useEffect(() => {
        if (compareMode && chartStyle !== "line") onStyleChange("line");
    }, [chartStyle, compareMode, onStyleChange]);

    const series = useMemo(() => {
        if (!detailStock) return [];
        return detailStock.data.length > 0 ? detailStock.data : createMarketSeries(detailStock, range === "MAX" ? "5Y" : range);
    }, [detailStock, range]);
    const chartData = useMemo(() => {
        return series.map((point, index, history) => pointToDetail(point, history[index - 1]?.price));
    }, [series]);
    const displayedChartData = useMemo(() => {
        if (chartData.length === 0) return [];
        const primaryStart = chartData[0]?.price ?? 1;
        return chartData.map((point, index) => {
            const next: DetailChartPoint = {
                ...point,
                primaryPerformance: performanceFrom(primaryStart, point.price),
            };
            compareQuotes.forEach((compareQuote) => {
                const compareHistory = compareQuote.data.slice(-chartData.length);
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

    const up = (detailStock?.change ?? 0) >= 0;
    const color = compareMode ? COMPARE_COLORS[0] : up ? "#34d399" : "#f87171";
    const stats = useMemo(() => createStats(detailStock, series), [detailStock, series]);
    const chartValues = compareMode
        ? displayedChartData.flatMap((point) => [
            point.primaryPerformance,
            ...compareQuotes.flatMap((compareQuote) => {
                const value = point[compareKey(compareQuote.ticker, "performance")];
                return typeof value === "number" ? [value] : [];
            }),
        ])
        : chartStyle === "candle"
            ? displayedChartData.flatMap((point) => [
                typeof point.high === "number" ? point.high : point.price,
                typeof point.low === "number" ? point.low : point.price,
            ])
            : displayedChartData.map((point) => point.price);
    const yDomain = domainWithPadding(chartValues);
    const activePoint = hoverPoint ?? displayedChartData[displayedChartData.length - 1] ?? null;
    const activePrice = activePoint?.price ?? detailStock?.price ?? 0;
    const activePercentChange = detailStock ? performanceFrom(detailStock.price - estimateAbsoluteChange(detailStock), activePrice) : 0;
    const activeAbsoluteChange = detailStock ? activePrice - (detailStock.price - estimateAbsoluteChange(detailStock)) : 0;
    const filteredCompareMatches = useMemo(() => {
        const excluded = new Set([stock?.ticker, ...activeComparisonSymbols]);
        return searchMarketSymbols(compareQuery, 8).filter((match) => !excluded.has(match.ticker));
    }, [activeComparisonSymbols, compareQuery, stock?.ticker]);

    const addCompareSymbol = (symbol: string) => {
        const normalized = normalizeTicker(symbol);
        if (!normalized || normalized === stock?.ticker || activeComparisonSymbols.includes(normalized)) return;
        onComparisonChange([...activeComparisonSymbols, normalized]);
        setCompareQuery("");
    };

    const removeCompareSymbol = (symbol: string) => {
        onComparisonChange(activeComparisonSymbols.filter((item) => item !== symbol));
        setHoverPoint(null);
    };

    return (
        <Dialog open={Boolean(stock)} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]">
                {stock && detailStock && (
                    <>
                        <DialogHeader className="shrink-0 px-4 pt-4 pr-14 sm:px-6 sm:pt-6 sm:pr-16">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <DialogTitle className="flex flex-wrap items-center gap-3 text-xl sm:text-2xl">
                                        {detailStock.ticker}
                                        <Badge variant="outline" className="h-6 rounded-lg">{detailStock.exchange}</Badge>
                                    </DialogTitle>
                                    <DialogDescription>{detailStock.name} · {detailStock.sector}</DialogDescription>
                                </div>
                                <div className="text-left lg:text-right">
                                    <div className="text-2xl font-bold text-white sm:text-3xl">{formatCurrency(activePrice)}</div>
                                    <div className={cn("mt-1 inline-flex items-center gap-1 text-sm", up ? "text-green-positive" : "text-red-negative")}>
                                        {activePercentChange >= 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                                        {formatChange(activePercentChange)}
                                        <span className="text-white/42">({activeAbsoluteChange >= 0 ? "+" : "-"}{formatCurrency(Math.abs(activeAbsoluteChange))})</span>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-y border-white/[0.06] px-4 py-3 sm:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                                {(Object.keys(CHART_STYLE_LABELS) as DetailChartStyle[]).map((style) => {
                                    const disabled = compareMode && style !== "line";
                                    return (
                                        <Button
                                            key={style}
                                            type="button"
                                            size="sm"
                                            variant={chartStyle === style ? "secondary" : "outline"}
                                            disabled={disabled}
                                            className="h-8 rounded-lg px-3 text-xs"
                                            onClick={() => onStyleChange(style)}
                                        >
                                            <ChartModeIcon mode={style} />
                                            {CHART_STYLE_LABELS[style]}
                                        </Button>
                                    );
                                })}
                                {compareLoading && <Loader2 className="size-4 animate-spin text-white/40" />}
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                                <Input
                                    value={compareQuery}
                                    onChange={(event) => setCompareQuery(event.target.value)}
                                    placeholder="Compare symbol..."
                                    className="h-9 rounded-xl pl-9 text-sm"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addCompareSymbol(filteredCompareMatches[0]?.ticker ?? compareQuery);
                                        }
                                    }}
                                />
                                {compareQuery && (
                                    <Card className="absolute left-0 right-0 top-10 z-30 rounded-2xl border-[var(--theme-border)] bg-[var(--surface-panel)] py-2 shadow-[var(--shadow-popover)]">
                                        <CardContent className="flex max-h-56 flex-col gap-1 overflow-y-auto px-2 py-0">
                                            {(filteredCompareMatches.length > 0 ? filteredCompareMatches : [createMarketSymbol(compareQuery)]).map((match) => (
                                                <button
                                                    key={match.ticker}
                                                    type="button"
                                                    onClick={() => addCompareSymbol(match.ticker)}
                                                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.08]"
                                                >
                                                    <span>
                                                        <span className="block text-sm font-semibold text-white">{match.ticker}</span>
                                                        <span className="block text-xs text-white/42">{match.name}</span>
                                                    </span>
                                                    <Plus className="size-4 text-white/40" />
                                                </button>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
                            {activeComparisonSymbols.length > 0 && (
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    {activeComparisonSymbols.map((symbol, index) => (
                                        <span
                                            key={symbol}
                                            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-sm font-medium text-white/78"
                                        >
                                            <span className="size-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length] }} />
                                            {symbol}
                                            <button
                                                type="button"
                                                onClick={() => removeCompareSymbol(symbol)}
                                                className="rounded-full p-0.5 text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
                                                aria-label={`Remove ${symbol} comparison`}
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    <span className="text-xs text-white/35">Comparison uses normalized percent performance.</span>
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                <Card className="rounded-2xl border-white/[0.06] bg-white/[0.025] py-0">
                                    <CardContent className="flex flex-col gap-3 p-4">
                                        <div className="flex items-center justify-between gap-4 px-1">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{detailStock.ticker} price chart</div>
                                                <div className="text-xs text-white/38">{range} · {compareMode ? "Performance on right axis" : "Price on right axis · Volume below"}</div>
                                            </div>
                                            <Badge variant="outline" className="h-6 rounded-lg">{detailStock.currency ?? "USD"}</Badge>
                                        </div>
                                        {mounted ? (
                                            <div className="h-[20rem] sm:h-[24rem] lg:h-[28rem]">
                                                <SafeChartContainer>
                                                    <ComposedChart
                                                        data={displayedChartData}
                                                        margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
                                                        onMouseMove={(state: unknown) => {
                                                            const payload = (state as { activePayload?: Array<{ payload?: DetailChartPoint }> })?.activePayload?.[0]?.payload;
                                                            if (payload) setHoverPoint(payload);
                                                        }}
                                                        onMouseLeave={() => setHoverPoint(null)}
                                                    >
                                                        <defs>
                                                            <linearGradient id={`dialog-grad-${detailStock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={color} stopOpacity={0.34} />
                                                                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                                                        <XAxis
                                                            dataKey="label"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                                                            minTickGap={range === "1D" ? 16 : 24}
                                                            tickFormatter={(value) => range === "1D" ? formatIntradayLabel(String(value)) : String(value)}
                                                        />
                                                        <YAxis
                                                            yAxisId="price"
                                                            orientation="right"
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                                                            width={64}
                                                            domain={yDomain}
                                                            tickFormatter={(value) => compareMode ? `${Number(value).toFixed(1)}%` : formatAxisPrice(Number(value))}
                                                        />
                                                        <YAxis yAxisId="volume" hide />
                                                        <Tooltip
                                                            content={<DetailChartTooltip primaryTicker={detailStock.ticker} compareQuotes={compareQuotes} compareMode={compareMode} />}
                                                            cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }}
                                                        />
                                                        {compareMode && <ReferenceLine yAxisId="price" y={0} stroke="rgba(255,255,255,0.32)" strokeDasharray="4 4" />}
                                                        {!compareMode && <Bar yAxisId="volume" dataKey="volume" fill="var(--chart-volume)" barSize={6} radius={[4, 4, 0, 0]} />}
                                                        {chartStyle === "area" && !compareMode && (
                                                            <Area yAxisId="price" type="monotone" dataKey="price" stroke={color} strokeWidth={2.4} fill={`url(#dialog-grad-${detailStock.ticker})`} dot={false} />
                                                        )}
                                                        {chartStyle === "bar" && !compareMode && (
                                                            <Bar yAxisId="price" dataKey="price" fill={color} radius={[4, 4, 0, 0]} opacity={0.72} />
                                                        )}
                                                        {chartStyle === "candle" && !compareMode && (
                                                            <>
                                                                <Bar yAxisId="price" dataKey="candleBase" stackId="candle" fill="transparent" isAnimationActive={false} />
                                                                <Bar yAxisId="price" dataKey="candleBody" stackId="candle" radius={[2, 2, 2, 2]}>
                                                                    {displayedChartData.map((point, index) => (
                                                                        <Cell key={`${point.label}-${index}`} fill={point.candlePositive ? "#34d399" : "#f87171"} opacity={0.78} />
                                                                    ))}
                                                                </Bar>
                                                                <Line yAxisId="price" type="linear" dataKey="price" stroke="rgba(255,255,255,0.26)" strokeWidth={1} dot={false} />
                                                            </>
                                                        )}
                                                        {(chartStyle === "line" || compareMode) && (
                                                            <Line yAxisId="price" type="monotone" dataKey={compareMode ? "primaryPerformance" : "price"} stroke={color} strokeWidth={2.4} dot={false} />
                                                        )}
                                                        {compareMode && compareQuotes.map((compareQuote, index) => (
                                                            <Line
                                                                key={compareQuote.ticker}
                                                                yAxisId="price"
                                                                type="monotone"
                                                                dataKey={compareKey(compareQuote.ticker, "performance")}
                                                                stroke={COMPARE_COLORS[(index + 1) % COMPARE_COLORS.length]}
                                                                strokeWidth={2.2}
                                                                dot={false}
                                                            />
                                                        ))}
                                                        {loading && (
                                                            <ReferenceLine yAxisId="price" y={yDomain[1]} label={{ value: "Refreshing...", fill: "rgba(255,255,255,0.42)", fontSize: 11 }} stroke="transparent" />
                                                        )}
                                                    </ComposedChart>
                                                </SafeChartContainer>
                                            </div>
                                        ) : (
                                            <div className="h-[20rem] sm:h-[24rem] lg:h-[28rem] rounded-xl bg-white/[0.035]" />
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="flex flex-col gap-4">
                                    <Card className="rounded-2xl border-white/[0.06] bg-white/[0.025] py-0">
                                        <CardHeader className="px-4 pt-4">
                                            <CardTitle className="text-sm">Details</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 gap-2.5 px-4 pb-4">
                                            {stats.map((item) => (
                                                <div key={item.label} className="rounded-xl bg-white/[0.035] px-3 py-2.5">
                                                    <div className="text-[11px] text-white/35">{item.label}</div>
                                                    <div className="mt-0.5 text-sm font-semibold text-white">{item.value}</div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                    <EarningsCard
                                        earnings={detailStock.earnings ?? []}
                                        expanded={earningsExpanded}
                                        onToggle={() => setEarningsExpanded((x) => !x)}
                                    />
                                    {(detailStock.quarterlyFinancials?.length ?? 0) > 0 && (
                                        <QuarterlyFinancialsCard
                                            quarters={detailStock.quarterlyFinancials!}
                                            quarterIdx={Math.min(quarterIdx, detailStock.quarterlyFinancials!.length - 1)}
                                            currency={detailStock.currency ?? "USD"}
                                            onPrev={() => setQuarterIdx((i) => Math.min(detailStock.quarterlyFinancials!.length - 1, i + 1))}
                                            onNext={() => setQuarterIdx((i) => Math.max(0, i - 1))}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                                <div className="flex flex-wrap gap-2">
                                    {CHART_DETAIL_RANGES.map((value) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            size="sm"
                                            variant={range === value ? "secondary" : "outline"}
                                            className="h-8 rounded-full px-3 text-xs"
                                            onClick={() => onRangeChange(value)}
                                        >
                                            {value}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-full px-3 text-xs"
                                    onClick={() => {
                                        invalidateQuote(detailStock.ticker);
                                        setNotice("Chart cache cleared. Refreshing latest quote.");
                                        fetchCachedQuote(detailStock.ticker, period, interval).then((quote) => {
                                            const fresh = quoteToStock(quote, detailStock);
                                            setDetailStock(fresh);
                                            onStockLoaded(fresh);
                                        }).catch(() => undefined);
                                    }}
                                >
                                    <RefreshCw className="size-3.5" />
                                    Refresh cache
                                </Button>
                            </div>
                            {notice && <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/50">{notice}</p>}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function EarningsCard({
    earnings,
    expanded,
    onToggle,
}: {
    earnings: EarningsPoint[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const visible = expanded ? earnings : earnings.slice(0, 3);
    return (
        <Card className="rounded-2xl border-white/[0.06] bg-white/[0.025] py-0">
            <CardHeader className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Earnings</CardTitle>
                    {earnings.length > 3 && (
                        <button
                            type="button"
                            onClick={onToggle}
                            className="flex items-center gap-0.5 text-xs text-white/40 transition-colors hover:text-white"
                        >
                            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                {earnings.length === 0 ? (
                    <div className="text-xs text-white/32">No earnings data available.</div>
                ) : (
                    <div className="flex flex-col divide-y divide-white/[0.04]">
                        {visible.map((e) => {
                            const beat = (e.beat_pct ?? 0) >= 0;
                            return (
                                <div key={e.date} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                    <span className="text-[11px] text-white/45">{e.date}</span>
                                    <span className={cn("text-[11px] font-medium", beat ? "text-green-positive" : "text-red-negative")}>
                                        EPS {beat ? "beat" : "missed"} by {Math.abs(e.beat_pct ?? 0).toFixed(2)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function QuarterlyFinancialsCard({
    quarters,
    quarterIdx,
    currency,
    onPrev,
    onNext,
}: {
    quarters: QuarterlyFinancial[];
    quarterIdx: number;
    currency: string;
    onPrev: () => void;
    onNext: () => void;
}) {
    const q = quarters[quarterIdx];
    if (!q) return null;

    const rows: { label: string; value: string; yoy: number | null }[] = [
        { label: "Revenue", value: formatFinancial(q.revenue), yoy: q.revenue_yoy },
        { label: "Net income", value: formatFinancial(q.net_income), yoy: q.net_income_yoy },
        { label: "Diluted EPS", value: q.diluted_eps != null ? q.diluted_eps.toFixed(2) : "—", yoy: q.eps_yoy },
        { label: "Net profit margin", value: q.net_profit_margin != null ? `${q.net_profit_margin.toFixed(1)}%` : "—", yoy: q.margin_yoy },
    ];

    return (
        <Card className="rounded-2xl border-white/[0.06] bg-white/[0.025] py-0">
            <CardHeader className="px-4 pt-4 pb-0">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Quarterly financials</CardTitle>
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            disabled={quarterIdx >= quarters.length - 1}
                            onClick={onPrev}
                            className="flex size-5 items-center justify-center rounded text-white/40 transition-colors hover:text-white disabled:opacity-20"
                        >
                            <ChevronLeft className="size-3.5" />
                        </button>
                        <span className="min-w-[4.5rem] text-center text-[11px] text-white/52">{q.period}</span>
                        <button
                            type="button"
                            disabled={quarterIdx <= 0}
                            onClick={onNext}
                            className="flex size-5 items-center justify-center rounded text-white/40 transition-colors hover:text-white disabled:opacity-20"
                        >
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-3">
                <div className="mb-2 flex items-center text-[10px] text-white/28">
                    <span className="flex-1">({currency})</span>
                    <span className="w-[4.5rem] text-right">{q.period}</span>
                    <span className="w-12 text-right">Y/Y</span>
                </div>
                <div className="flex flex-col divide-y divide-white/[0.04]">
                    {rows.map((row) => {
                        const isPos = (row.yoy ?? 0) >= 0;
                        return (
                            <div key={row.label} className="flex items-center gap-1 py-2 first:pt-0 last:pb-0">
                                <span className="flex-1 text-[11px] text-white/45">{row.label}</span>
                                <span className="w-[4.5rem] text-right text-[11px] font-semibold text-white">{row.value}</span>
                                <span className={cn("w-12 text-right text-[11px] font-medium", row.yoy != null ? (isPos ? "text-green-positive" : "text-red-negative") : "text-white/30")}>
                                    {row.yoy != null ? `${isPos ? "+" : ""}${row.yoy.toFixed(2)}%` : "—"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    const price = payload.find((item) => item.dataKey === "price")?.value;
    const volume = payload.find((item) => item.dataKey === "volume")?.value;

    return (
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-tooltip)] p-3 shadow-[var(--shadow-tooltip)]">
            <div className="text-xs text-white/38">{label}</div>
            <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(price ?? 0)}</div>
            <div className="mt-1 text-xs text-white/42">Volume {formatLargeNumber(volume ?? 0)}</div>
        </div>
    );
}

function createStats(stock: StockInfo | null, series: MarketPoint[]) {
    if (!stock || series.length === 0) return [];
    const prices = series.map((point) => point.price);
    const open = prices[0];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = stock.volume ?? series.reduce((sum, point) => sum + point.volume, 0);
    const marketCap = stock.marketCap ?? stock.price * (900000000 + stock.ticker.length * 420000000);

    return [
        { label: "Open", value: formatCurrency(stock.openPrice ?? open) },
        { label: "High", value: formatCurrency(stock.dayHigh ?? high) },
        { label: "Low", value: formatCurrency(stock.dayLow ?? low) },
        { label: "Mkt cap", value: formatLargeNumber(marketCap) },
        { label: "P/E ratio", value: formatRatio(stock.peRatio) },
        { label: "52-wk high", value: formatCurrency(stock.fiftyTwoWeekHigh ?? high) },
        { label: "Dividend", value: formatPercent(stock.dividendYield) },
        { label: "Qtrly Div Amt", value: formatCurrencyOrDash(stock.quarterlyDividendAmount ?? (stock.dividendRate ? stock.dividendRate / 4 : null)) },
        { label: "52-wk low", value: formatCurrency(stock.fiftyTwoWeekLow ?? low) },
        { label: "Volume", value: formatLargeNumber(volume) },
    ];
}

function RemoveTickerDialog({
    stock,
    skipChecked,
    onSkipCheckedChange,
    onCancel,
    onConfirm,
}: {
    stock: StockInfo | null;
    skipChecked: boolean;
    onSkipCheckedChange: (checked: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <AlertDialog open={Boolean(stock)} onOpenChange={(open) => {
            if (!open) onCancel();
        }}>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                        <Trash2Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Remove {stock?.ticker}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This ticker will be removed from your market overview. You can add it again from search.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <FieldGroup className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.035] p-3">
                    <Field orientation="horizontal">
                        <Checkbox
                            id="skip-remove-ticker-confirmation"
                            name="skip-remove-ticker-confirmation"
                            checked={skipChecked}
                            onCheckedChange={onSkipCheckedChange}
                        />
                        <FieldLabel htmlFor="skip-remove-ticker-confirmation">Do not ask again</FieldLabel>
                    </Field>
                </FieldGroup>
                <AlertDialogFooter>
                    <AlertDialogCancel variant="outline" onClick={onCancel}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onConfirm}>Remove</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function formatCurrency(value: number) {
    if (value >= 1000) {
        return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `$${value.toFixed(2)}`;
}

function formatCurrencyOrDash(value: number | null | undefined) {
    return value == null ? "—" : formatCurrency(value);
}

function formatRatio(value: number | null | undefined) {
    return value == null ? "—" : value.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
    if (value == null) return "—";
    return `${(value * 100).toFixed(3)}%`;
}

function formatChange(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatIntradayLabel(value: string) {
    const timeMatch = value.match(/\b(\d{1,2}):(\d{2})\b/);
    if (!timeMatch) return value;

    const hour = Number(timeMatch[1]);
    const minute = timeMatch[2];
    if (Number.isNaN(hour)) return value;

    return `${hour.toString().padStart(2, "0")}:${minute}`;
}

function formatLargeNumber(value: number) {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
}

function formatFinancial(value: number | null) {
    if (value == null) return "—";
    const abs = Math.abs(value);
    const formatted = formatLargeNumber(abs);
    return value < 0 ? `-${formatted}` : formatted;
}
