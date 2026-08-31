"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type TradingViewWidgetProps = {
  title: string;
  scriptUrl: string;
  config: Record<string, unknown>;
  className?: string;
  height?: number | string;
  matchAppSurface?: boolean;
};

function resolveTheme() {
  if (typeof document === "undefined") return "dark";
  return document.body.dataset.theme === "White" ? "light" : "dark";
}

const MATCHED_SURFACE = {
  dark: "#121318",
  light: "#ffffff",
} as const;

export default function TradingViewWidget({ title, scriptUrl, config, className, height = 480, matchAppSurface = false }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(resolveTheme);
  const serializedConfig = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(resolveTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = scriptUrl;
    script.async = true;
    script.textContent = JSON.stringify({
      ...JSON.parse(serializedConfig),
      ...(matchAppSurface ? { backgroundColor: theme === "dark" ? MATCHED_SURFACE.dark : MATCHED_SURFACE.light } : {}),
      colorTheme: theme,
      theme,
      autosize: true,
      width: "100%",
      height: "100%",
    });
    container.append(widget, script);
    return () => container.replaceChildren();
  }, [matchAppSurface, scriptUrl, serializedConfig, theme]);

  return (
    <section
      aria-label={title}
      className={cn("relative overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)]", className)}
      style={{ height }}
    >
      <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-transparent" />
      <div ref={containerRef} className="tradingview-widget-container relative h-full w-full" />
      <a
        href="https://www.tradingview.com/"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 z-10 inline-flex min-h-10 items-center gap-1 rounded-lg bg-black/70 px-3 py-2 text-xs text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        TradingView <ExternalLink className="size-3" />
      </a>
    </section>
  );
}

export function tradingViewSymbol(symbol: string, exchange?: string | null) {
  const providerSymbol = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = {
    "^DJI": "DJ:DJI",
    "^GSPC": "SP:SPX",
    "^IXIC": "NASDAQ:IXIC",
    "^GSPTSE": "TSX:TSX",
    "^RUT": "TVC:RUT",
    "^VIX": "CBOE:VIX",
    "BTC-CAD": "KRAKEN:BTCCAD",
    "ETH-CAD": "KRAKEN:ETHCAD",
    "LTC-CAD": "KRAKEN:LTCCAD",
    "DOGE-CAD": "KRAKEN:DOGECAD",
    "ADA-CAD": "KRAKEN:ADACAD",
    "YM=F": "CBOT_MINI:YM1!",
    "ES=F": "CME_MINI:ES1!",
    "NQ=F": "CME_MINI:NQ1!",
    "GC=F": "COMEX:GC1!",
    "CL=F": "NYMEX:CL1!",
  };
  if (aliases[providerSymbol]) return aliases[providerSymbol];

  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, "");
  if (normalized.includes(":")) return normalized;
  const venue = (exchange || "NASDAQ").toUpperCase().replace(/[^A-Z]/g, "");
  const supportedVenue = venue.includes("NYSE") ? "NYSE" : venue.includes("TSX") ? "TSX" : venue.includes("AMEX") ? "AMEX" : "NASDAQ";
  return `${supportedVenue}:${normalized}`;
}

export function tradingViewCryptoSymbol(base: string, quote: string) {
  const safeBase = base.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const safeQuote = quote.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const venue = safeQuote === "CAD" ? "KRAKEN" : safeQuote === "USDT" ? "BINANCE" : "COINBASE";
  return `${venue}:${safeBase}${safeQuote}`;
}

export const TRADINGVIEW_SCRIPTS = {
  heatmap: "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",
  marketOverview: "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
  symbolInfo: "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js",
  advancedChart: "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
  symbolOverview: "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js",
  technicalAnalysis: "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js",
  companyProfile: "https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js",
  financials: "https://s3.tradingview.com/external-embedding/embed-widget-financials.js",
} as const;
