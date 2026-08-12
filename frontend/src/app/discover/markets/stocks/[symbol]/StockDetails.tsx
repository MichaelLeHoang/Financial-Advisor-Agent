"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CandlestickChart, ExternalLink } from "lucide-react";
import QuanforaStockChart from "@/components/market/QuanforaStockChart";
import TradingViewWidget, { TRADINGVIEW_SCRIPTS, tradingViewSymbol } from "@/components/market/TradingViewWidget";
import WatchlistButton from "@/components/watchlist/WatchlistButton";
import { cn } from "@/lib/utils";

export default function StockDetails({ symbol, exchange }: { symbol: string; exchange?: string }) {
  const [chartEngine, setChartEngine] = useState<"quanfora" | "tradingview">("quanfora");
  const tvSymbol = tradingViewSymbol(symbol, exchange);
  return (
    <main className="min-h-full bg-[var(--background)] px-4 py-5 text-[var(--text-primary)] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/discover/markets" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArrowLeft className="size-4" /> Market overview</Link>
            <h1 className="mt-2 text-3xl font-semibold">{symbol} stock details</h1>
          </div>
          <WatchlistButton symbol={symbol} />
        </header>

        <TradingViewWidget title={`${symbol} symbol information`} scriptUrl={TRADINGVIEW_SCRIPTS.symbolInfo} height={190} className="stock-detail-chart-surface" matchAppSurface config={{ symbol: tvSymbol, locale: "en", isTransparent: false }} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,0.9fr)]">
          <div className="space-y-6">
            <section aria-labelledby="price-chart-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div><h2 id="price-chart-title" className="font-semibold">Price chart</h2><p className="text-xs text-[var(--text-muted)]">Switch between Quanfora&apos;s focused analysis and TradingView&apos;s full toolset.</p></div>
                <div className="flex rounded-full border border-[var(--theme-border)] bg-[var(--surface-panel)] p-1" role="group" aria-label="Chart source">
                  <button type="button" aria-pressed={chartEngine === "quanfora"} onClick={() => setChartEngine("quanfora")} className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", chartEngine === "quanfora" && "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-sm")}><CandlestickChart className="size-3.5" /> Quanfora</button>
                  <button type="button" aria-pressed={chartEngine === "tradingview"} onClick={() => setChartEngine("tradingview")} className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", chartEngine === "tradingview" && "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-sm")}><ExternalLink className="size-3.5" /> TradingView</button>
                </div>
              </div>
              {chartEngine === "quanfora" ? <QuanforaStockChart symbol={symbol} className="stock-detail-chart-surface" /> : <TradingViewWidget title={`${symbol} advanced chart`} scriptUrl={TRADINGVIEW_SCRIPTS.advancedChart} height={680} className="stock-detail-chart-surface" matchAppSurface config={{ symbol: tvSymbol, interval: "D", timezone: "Etc/UTC", locale: "en", allow_symbol_change: true, hide_side_toolbar: false, hide_top_toolbar: false, save_image: false, calendar: false, gridColor: "rgba(120, 120, 120, 0.12)", studies: ["STD;SMA", "STD;EMA"] }} />}
            </section>
            <section aria-labelledby="market-performance-title">
              <div className="mb-3"><h2 id="market-performance-title" className="font-semibold">TradingView market performance</h2><p className="text-xs text-[var(--text-muted)]">A persistent baseline view for quickly comparing performance across time ranges.</p></div>
              <TradingViewWidget title={`${symbol} market performance`} scriptUrl={TRADINGVIEW_SCRIPTS.symbolOverview} height={430} className="stock-detail-chart-surface" matchAppSurface config={{ symbols: [[`${tvSymbol}|1D`]], chartOnly: false, locale: "en", isTransparent: false, gridLineColor: "rgba(120, 120, 120, 0.12)", fontColor: "#b4b4b4", scalePosition: "right", scaleMode: "Normal", fontFamily: "Inter, sans-serif", noTimeScale: false, valuesTracking: "1", changeMode: "price-and-percent" }} />
            </section>
          </div>
          <aside className="space-y-4">
            <TradingViewWidget title={`${symbol} technical analysis`} scriptUrl={TRADINGVIEW_SCRIPTS.technicalAnalysis} height={440} className="stock-detail-chart-surface" matchAppSurface config={{ interval: "1D", symbol: tvSymbol, showIntervalTabs: true, displayMode: "single", locale: "en", isTransparent: false }} />
            <TradingViewWidget title={`${symbol} company profile`} scriptUrl={TRADINGVIEW_SCRIPTS.companyProfile} height={390} className="stock-detail-chart-surface" matchAppSurface config={{ symbol: tvSymbol, locale: "en", isTransparent: false }} />
            <TradingViewWidget title={`${symbol} financials`} scriptUrl={TRADINGVIEW_SCRIPTS.financials} height={560} className="stock-detail-chart-surface" matchAppSurface config={{ symbol: tvSymbol, locale: "en", isTransparent: false, displayMode: "regular" }} />
          </aside>
        </div>
      </div>
    </main>
  );
}
