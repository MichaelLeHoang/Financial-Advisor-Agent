"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CandlestickChart, ExternalLink, Loader2 } from "lucide-react";

import CryptoAnalytics from "@/components/market/CryptoAnalytics";
import QuanforaStockChart from "@/components/market/QuanforaStockChart";
import TradingViewWidget, { TRADINGVIEW_SCRIPTS, tradingViewCryptoSymbol } from "@/components/market/TradingViewWidget";
import WatchlistButton from "@/components/watchlist/WatchlistButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip, MetricLabel } from "@/components/ui/info-tooltip";
import { api, type CryptoOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

type QuoteCurrency = "CAD" | "USD" | "USDT";
const QUOTES: QuoteCurrency[] = ["CAD", "USD", "USDT"];

function money(value: number | null | undefined, quote: string, compact = false) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: quote === "USDT" ? "USD" : quote,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact || value >= 1_000 ? 0 : 2,
  }).format(value).replace("US$", quote === "USDT" ? "USDT " : "US$");
}

function amount(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function MarketSnapshot({ overview }: { overview: CryptoOverview | null }) {
  const definitions: Record<string, string> = {
    "Market cap": "Current price multiplied by circulating supply. It measures market size, not cash held by the network.",
    "Market rank": "The asset's position among tracked crypto assets by market capitalization.",
    "24h volume": "Estimated value traded across tracked venues during the latest 24-hour window.",
    "24h range": "Lowest and highest tracked prices during the latest rolling 24-hour window.",
    "Circulating supply": "Units estimated to be available and circulating in the market.",
    "Maximum supply": "Protocol-defined upper limit when one exists. Some assets have no fixed maximum.",
    "All-time high": "Highest historical composite price recorded in the selected quote currency.",
    "From ATH": "Percentage decline from the recorded all-time high to the current composite price.",
  };
  const metrics = [
    ["Market cap", money(overview?.market_cap, overview?.quote_currency ?? "CAD", true)],
    ["Market rank", overview?.market_cap_rank ? `#${overview.market_cap_rank}` : "—"],
    ["24h volume", money(overview?.volume_24h, overview?.quote_currency ?? "CAD", true)],
    ["24h range", overview?.low_24h != null && overview.high_24h != null ? `${money(overview.low_24h, overview.quote_currency)} – ${money(overview.high_24h, overview.quote_currency)}` : "—"],
    ["Circulating supply", amount(overview?.circulating_supply)],
    ["Maximum supply", amount(overview?.max_supply)],
    ["All-time high", money(overview?.ath, overview?.quote_currency ?? "CAD")],
    ["From ATH", overview?.ath_drawdown_pct != null ? `−${overview.ath_drawdown_pct.toFixed(1)}%` : "—"],
  ];
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-[var(--theme-border)] py-4">
        <div className="flex items-center gap-2"><CardTitle>Market snapshot</CardTitle><InfoTooltip label="About the market snapshot" side="bottom"><strong>What this shows</strong><p className="mt-1 text-[var(--text-muted)]">A point-in-time view of liquidity, supply, market size, and distance from the all-time high. Metrics update at different intervals and may not match a single exchange tick exactly.</p><p className="mt-2 text-[var(--text-subtle)]">CoinGecko composite market data</p></InfoTooltip></div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-px bg-[var(--theme-border)] p-0">
        {metrics.map(([label, value]) => <div key={label} className="min-w-0 bg-[var(--surface-card)] px-4 py-4"><MetricLabel label={label} description={definitions[label]} /><p className="mt-1 truncate font-semibold tabular-nums" title={String(value)}>{value}</p></div>)}
      </CardContent>
      <p className="border-t border-[var(--theme-border)] px-4 py-3 text-[11px] text-[var(--text-subtle)]">{overview ? `Updated ${new Date(overview.updated_at).toLocaleString("en-CA")}` : "Waiting for market data"}</p>
    </Card>
  );
}

export default function CryptoDetails({ base, initialQuote }: { base: string; initialQuote: QuoteCurrency }) {
  const [quote, setQuote] = useState<QuoteCurrency>(initialQuote);
  const [overview, setOverview] = useState<CryptoOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartEngine, setChartEngine] = useState<"quanfora" | "tradingview">("quanfora");
  const marketSymbol = `${base}-${quote === "USDT" ? "USD" : quote}`;
  const displaySymbol = `${base}-${quote}`;
  const tvSymbol = tradingViewCryptoSymbol(base, quote);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setOverviewError(null);
    api.cryptoOverview(base, quote)
      .then((value) => { if (!canceled) setOverview(value); })
      .catch((error) => { if (!canceled) setOverviewError(error instanceof Error ? error.message : "Crypto overview is unavailable."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [base, quote]);

  const positive = (overview?.change_24h ?? 0) >= 0;
  const name = overview?.name ?? (base === "BTC" ? "Bitcoin" : base);
  const quoteNote = quote === "USDT" ? "Quanfora analytics use a USD proxy; TradingView shows the USDT venue pair." : null;
  const headerPrice = useMemo(() => overview ? money(overview.price, overview.quote_currency) : "—", [overview]);

  return (
    <main className="min-h-full bg-[var(--background)] px-4 py-5 text-[var(--text-primary)] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/discover/markets" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArrowLeft className="size-4" /> Market overview</Link>
            <h1 className="mt-2 text-3xl font-semibold">{name} market detail</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{displaySymbol} · Trading 24/7{overview?.venue ? ` · ${overview.venue}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-[var(--theme-border)] bg-[var(--surface-panel)] p-1" role="group" aria-label="Quote currency">
              {QUOTES.map((value) => <button key={value} type="button" aria-pressed={quote === value} onClick={() => setQuote(value)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", quote === value && "bg-[var(--surface-selected)] text-[var(--text-primary)]")}>{value}</button>)}
            </div>
            <WatchlistButton symbol={displaySymbol} assetType="crypto" />
          </div>
        </header>

        <Card className="gap-0 py-0">
          <CardContent className="flex min-h-36 flex-wrap items-center justify-between gap-6 px-5 py-6 sm:px-6">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)]">{name} · {displaySymbol}</p>
              {loading ? <p className="mt-3 text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" />Loading market price</p> : overviewError ? <p className="mt-3 text-sm text-rose-300">{overviewError}</p> : <><p className="mt-2 text-4xl font-semibold tabular-nums">{headerPrice}</p><p className={cn("mt-2 text-sm font-semibold tabular-nums", positive ? "text-emerald-400" : "text-rose-400")}>{positive ? "+" : ""}{overview?.change_24h?.toFixed(2) ?? "0.00"}% over 24h</p></>}
              {quoteNote && <p className="mt-2 max-w-xl text-xs text-[var(--text-subtle)]">{quoteNote}</p>}
            </div>
            <div className="text-right text-xs text-[var(--text-muted)]"><p>Market trades continuously</p><p className="mt-1">{overview?.updated_at ? `Updated ${new Date(overview.updated_at).toLocaleString("en-CA")}` : "Awaiting provider timestamp"}</p></div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(310px,0.7fr)]">
          <section aria-labelledby="crypto-price-chart-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-2"><div><h2 id="crypto-price-chart-title" className="font-semibold">Price action</h2></div><InfoTooltip label="About the price chart" side="bottom"><strong>What this shows</strong><p className="mt-1 text-[var(--text-muted)]">Quanfora provides interactive candles, overlays, volume, zoom, and range measurement. Prices use the selected quote currency and trade continuously; short provider gaps can occur.</p><p className="mt-2 text-[var(--text-subtle)]">Quanfora market history · Optional TradingView toolset</p></InfoTooltip></div>
              <div className="flex rounded-full border border-[var(--theme-border)] bg-[var(--surface-panel)] p-1" role="group" aria-label="Chart source">
                <button type="button" aria-pressed={chartEngine === "quanfora"} onClick={() => setChartEngine("quanfora")} className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", chartEngine === "quanfora" && "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-sm")}><CandlestickChart className="size-3.5" /> Quanfora</button>
                <button type="button" aria-pressed={chartEngine === "tradingview"} onClick={() => setChartEngine("tradingview")} className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", chartEngine === "tradingview" && "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-sm")}><ExternalLink className="size-3.5" /> TradingView</button>
              </div>
            </div>
            {chartEngine === "quanfora" ? <QuanforaStockChart symbol={marketSymbol} displaySymbol={displaySymbol} currency={quote} className="stock-detail-chart-surface" /> : <TradingViewWidget title={`${displaySymbol} advanced chart`} scriptUrl={TRADINGVIEW_SCRIPTS.advancedChart} height={680} className="stock-detail-chart-surface" matchAppSurface config={{ symbol: tvSymbol, interval: "D", timezone: "Etc/UTC", locale: "en", allow_symbol_change: true, hide_side_toolbar: false, hide_top_toolbar: false, save_image: false, calendar: false, studies: ["STD;SMA", "STD;EMA"] }} />}
          </section>
          <MarketSnapshot overview={overview} />
        </div>

        <CryptoAnalytics base={base} quote={quote} overview={overview} />
      </div>
    </main>
  );
}
