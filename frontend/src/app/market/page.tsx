"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowDownRight,
    ArrowUpRight,
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
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { api, type MarketQuote } from "@/lib/api";
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
}

type ChartStyle = "area" | "line";

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
    };
}

function quotePeriod(range: ChartRange): [string, string] {
    const periods: Record<ChartRange, [string, string]> = {
        "1D": ["1d", "15m"],
        "5D": ["5d", "30m"],
        "1M": ["1mo", "1d"],
        "6M": ["6mo", "1d"],
        "YTD": ["ytd", "1d"],
        "1Y": ["1y", "1d"],
        "5Y": ["5y", "1wk"],
    };
    return periods[range];
}

export default function MarketPage() {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const marketTopRef = useRef<HTMLDivElement>(null);
    const [stocks, setStocks] = useState<StockInfo[]>(() => DEFAULT_MARKET_TICKERS.map(createStock));
    const [query, setQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
    const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
    const [selectedRange, setSelectedRange] = useState<ChartRange>("1M");
    const [chartStyle, setChartStyle] = useState<ChartStyle>("area");
    const [pendingRemoval, setPendingRemoval] = useState<StockInfo | null>(null);
    const [skipRemoveConfirm, setSkipRemoveConfirm] = useState(false);
    const [skipRemoveConfirmDraft, setSkipRemoveConfirmDraft] = useState(false);

    const matches = useMemo(() => searchMarketSymbols(query), [query]);

    useEffect(() => {
        setMounted(true);
        setSkipRemoveConfirm(window.localStorage.getItem("market.skipRemoveConfirm") === "true");
    }, []);

    useEffect(() => {
        if (!mounted) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

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

    const fetchQuote = async (ticker: string, fallback?: StockInfo, range: ChartRange = "1M") => {
        const [period, interval] = quotePeriod(range);
        const quote = await api.marketQuote(ticker, period, interval);
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

        fetchQuote(normalized, next)
            .then((fresh) => {
                setSelectedStock((current) => current?.ticker === fresh.ticker ? fresh : current);
                setStocks((current) => current.map((stock) => stock.ticker === fresh.ticker ? fresh : stock));
            })
            .catch(() => undefined);
    };

    const changeChartRange = (range: ChartRange) => {
        setSelectedRange(range);
        if (!selectedStock) return;

        fetchQuote(selectedStock.ticker, selectedStock, range)
            .then((fresh) => {
                setSelectedStock((current) => current?.ticker === fresh.ticker ? fresh : current);
                setStocks((current) => current.map((stock) => stock.ticker === fresh.ticker ? fresh : stock));
            })
            .catch(() => undefined);
    };

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
                    <h1 className="bg-gradient-to-r from-white to-white/40 bg-clip-text text-4xl font-bold text-transparent">
                        Market Overview
                    </h1>
                    
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-[34rem]">
                    <div className="flex gap-2">
                        <MarketSearch
                            inputRef={searchInputRef}
                            query={query}
                            matches={matches}
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
                            onOpen={() => {
                                setSelectedStock(stock);
                                setSelectedRange("1M");
                                setChartStyle("area");
                            }}
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
                onRangeChange={changeChartRange}
                onStyleChange={setChartStyle}
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
    open,
    onOpenChange,
    onQueryChange,
    onSelect,
    onPreview,
}: {
    inputRef: RefObject<HTMLInputElement | null>;
    query: string;
    matches: MarketSymbol[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onQueryChange: (query: string) => void;
    onSelect: (ticker: string) => void;
    onPreview: (ticker: string) => void;
}) {
    const canAddCustom = normalizeTicker(query).length > 0 && !matches.some((match) => match.ticker === normalizeTicker(query));

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
                    className="absolute right-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-white/36 transition-colors hover:bg-white/[0.06] hover:text-white"
                    aria-label="Clear search"
                >
                    <X className="size-4" />
                </button>
            )}

            {open && query && (
                <Card className="absolute left-0 right-0 top-13 z-30 rounded-2xl border-white/[0.06] bg-[#090a0f] py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_22px_64px_rgba(0,0,0,0.58),0_0_44px_rgba(99,102,241,0.1)]">
                    <CardContent className="flex max-h-80 flex-col gap-1 overflow-y-auto px-2 py-0">
                        {matches.map((match) => (
                            <div
                                key={match.ticker}
                                onMouseDown={(event) => event.preventDefault()}
                                className="group/search-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_34px_rgba(99,102,241,0.12)]"
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

                        {canAddCustom && (
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
                className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28),0_0_34px_rgba(99,102,241,0.06)] transition-all duration-300 group-hover:border-white/[0.12] group-hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
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
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="rounded-lg text-white/32 hover:bg-white/[0.06] hover:text-white"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRequestRemove();
                                }}
                                aria-label={`Remove ${stock.ticker}`}
                            >
                                <X data-icon="inline-start" />
                            </Button>
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

function MiniChart({ stock }: { stock: StockInfo }) {
    const up = stock.change >= 0;
    const color = up ? "#34d399" : "#f87171";

    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={stock.data}>
                <defs>
                    <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="price"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#grad-${stock.ticker})`}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function MarketChartDialog({
    stock,
    mounted,
    range,
    chartStyle,
    onRangeChange,
    onStyleChange,
    onOpenChange,
}: {
    stock: StockInfo | null;
    mounted: boolean;
    range: ChartRange;
    chartStyle: ChartStyle;
    onRangeChange: (range: ChartRange) => void;
    onStyleChange: (style: ChartStyle) => void;
    onOpenChange: (open: boolean) => void;
}) {
    const series = useMemo(() => {
        if (!stock) return [];
        return stock.data.length > 0 ? stock.data : createMarketSeries(stock, range);
    }, [stock, range]);
    const up = (stock?.change ?? 0) >= 0;
    const color = up ? "#34d399" : "#f87171";
    const stats = useMemo(() => createStats(stock, series), [stock, series]);

    return (
        <Dialog open={Boolean(stock)} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]">
                {stock && (
                    <>
                        <DialogHeader className="shrink-0 px-4 pt-4 pr-14 sm:px-6 sm:pt-6 sm:pr-16">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <DialogTitle className="flex flex-wrap items-center gap-3 text-xl sm:text-2xl">
                                        {stock.ticker}
                                        <Badge variant="outline" className="h-6 rounded-lg">{stock.exchange}</Badge>
                                    </DialogTitle>
                                    <DialogDescription>{stock.name} · {stock.sector}</DialogDescription>
                                </div>
                                <div className="text-left lg:text-right">
                                    <div className="text-2xl font-bold text-white sm:text-3xl">{formatCurrency(stock.price)}</div>
                                    <div className={cn("mt-1 inline-flex items-center gap-1 text-sm", up ? "text-green-positive" : "text-red-negative")}>
                                        {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                                        {formatChange(stock.change)}
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
                            <div className="flex flex-wrap gap-2">
                                {CHART_RANGES.map((value) => (
                                    <Button
                                        key={value}
                                        type="button"
                                        size="sm"
                                        variant={range === value ? "secondary" : "outline"}
                                        className="h-8 rounded-lg px-3 text-xs"
                                        onClick={() => onRangeChange(value)}
                                    >
                                        {value}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={chartStyle === "area" ? "secondary" : "outline"}
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={() => onStyleChange("area")}
                                >
                                    Area
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={chartStyle === "line" ? "secondary" : "outline"}
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={() => onStyleChange("line")}
                                >
                                    Line
                                </Button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                <Card className="rounded-2xl border-white/[0.06] bg-white/[0.025] py-0">
                                    <CardContent className="flex flex-col gap-3 p-4">
                                        <div className="flex items-center justify-between gap-4 px-1">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{stock.ticker} price chart</div>
                                                <div className="text-xs text-white/38">{range} · Price on right axis · Volume below</div>
                                            </div>
                                            <Badge variant="outline" className="h-6 rounded-lg">{stock.currency ?? "USD"}</Badge>
                                        </div>
                                        {mounted ? (
                                            <div className="h-[20rem] sm:h-[24rem] lg:h-[28rem]">
                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                    <ComposedChart data={series} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id={`dialog-grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={color} stopOpacity={0.34} />
                                                                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }} minTickGap={24} />
                                                        <YAxis yAxisId="price" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }} width={64} domain={["dataMin - 3", "dataMax + 3"]} />
                                                        <YAxis yAxisId="volume" hide />
                                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(99,102,241,0.46)", strokeWidth: 1 }} />
                                                        <Bar yAxisId="volume" dataKey="volume" fill="rgba(99,102,241,0.16)" barSize={6} radius={[4, 4, 0, 0]} />
                                                        {chartStyle === "area" && (
                                                            <Area yAxisId="price" type="monotone" dataKey="price" stroke={color} strokeWidth={2.4} fill={`url(#dialog-grad-${stock.ticker})`} />
                                                        )}
                                                        {chartStyle === "line" && (
                                                            <Line yAxisId="price" type="monotone" dataKey="price" stroke={color} strokeWidth={2.4} dot={false} />
                                                        )}
                                                    </ComposedChart>
                                                </ResponsiveContainer>
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
                                    <Card className="rounded-2xl border-white/[0.06] bg-gradient-to-b from-indigo-primary/12 to-cyan-secondary/8 py-0">
                                        <CardContent className="p-4">
                                            <div className="text-sm font-semibold text-white">Chart tools</div>
                                            <div className="mt-3 flex flex-col gap-2 text-sm text-white/52">
                                                <div className="flex justify-between gap-4"><span>Selected range</span><span className="text-white/80">{range}</span></div>
                                                <div className="flex justify-between gap-4"><span>View mode</span><span className="text-white/80">{chartStyle === "area" ? "Area + volume" : "Line + volume"}</span></div>
                                                <div className="flex justify-between gap-4"><span>Hover data</span><span className="text-white/80">Price, date, volume</span></div>
                                                <div className="flex justify-between gap-4"><span>Latest quote</span><span className="text-white/80">{stock.loading ? "Updating" : "Loaded"}</span></div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    const price = payload.find((item) => item.dataKey === "price")?.value;
    const volume = payload.find((item) => item.dataKey === "volume")?.value;

    return (
        <div className="rounded-xl border border-white/[0.06] bg-[#090a0f]/96 p-3 shadow-[0_16px_46px_rgba(0,0,0,0.48)] backdrop-blur-xl">
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

function formatLargeNumber(value: number) {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
}
