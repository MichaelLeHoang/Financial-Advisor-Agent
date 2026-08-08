"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CandlestickChart, Check, Crosshair, LineChart, Loader2, Maximize2, Ruler, SlidersHorizontal, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import InteractiveMarketChart, { type InteractiveChartMode, type InteractiveChartPoint } from "@/components/market/InteractiveMarketChart";
import { fetchQuote } from "@/lib/quote-cache";
import type { MarketQuote } from "@/lib/api";
import { cn } from "@/lib/utils";

type ChartRange = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y";
type ChartPoint = InteractiveChartPoint & { sma20?: number; ema20?: number; vwap?: number };

const RANGES: ChartRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y"];
const PERIODS: Record<ChartRange, [string, string]> = {
  "1D": ["1d", "1m"],
  "5D": ["5d", "5m"],
  "1M": ["1mo", "30m"],
  "6M": ["6mo", "1d"],
  "1Y": ["1y", "1d"],
  "5Y": ["5y", "1wk"],
};
const MODE_LABELS: Record<InteractiveChartMode, string> = { candle: "Candlestick", line: "Line", area: "Area", bar: "OHLC bars" };
const TOOL_BUTTON_CLASS = "rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50";

function ToolHint({ label, align = "center", children }: { label: string; align?: "center" | "end"; children: ReactNode }) {
  return (
    <div className="group/chart-tool relative">
      {children}
      <span role="tooltip" className={cn("pointer-events-none absolute top-full z-40 mt-2 w-max max-w-48 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] opacity-0 shadow-[var(--shadow-tooltip)] transition-opacity group-hover/chart-tool:opacity-100", align === "end" ? "right-0" : "left-1/2 -translate-x-1/2")}>{label}</span>
    </div>
  );
}

function movingAverage(values: number[], index: number, length: number) {
  const start = Math.max(0, index - length + 1);
  const window = values.slice(start, index + 1);
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

function enrichHistory(quote: MarketQuote): ChartPoint[] {
  const prices = quote.history.map((point) => point.price);
  let ema = prices[0] ?? quote.price;
  let cumulativeVolume = 0;
  let cumulativeValue = 0;
  return quote.history.map((point, index) => {
    const open = point.open ?? prices[index - 1] ?? point.price;
    const volume = point.volume ?? 0;
    const typicalPrice = ((point.high ?? point.price) + (point.low ?? point.price) + point.price) / 3;
    ema = index === 0 ? point.price : point.price * (2 / 21) + ema * (19 / 21);
    cumulativeVolume += volume;
    cumulativeValue += typicalPrice * volume;
    return {
      label: point.label,
      price: point.price,
      volume,
      open,
      high: point.high ?? Math.max(open, point.price),
      low: point.low ?? Math.min(open, point.price),
      sma20: movingAverage(prices, index, 20),
      ema20: ema,
      vwap: cumulativeVolume ? cumulativeValue / cumulativeVolume : point.price,
    };
  });
}

function formatTime(label: string, range: ChartRange) {
  const date = new Date(label);
  if (Number.isNaN(date.getTime())) return label;
  return range === "1D"
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric", year: range === "5Y" ? "2-digit" : undefined });
}

function Metric({ color, label, value }: { color: string; label: string; value: number | undefined }) {
  if (value == null) return null;
  return <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: color }} />{label} <span className="tabular-nums text-[var(--text-primary)]">{value.toFixed(2)}</span></span>;
}

function ChartTooltip({ point, symbol, indicators }: { point: ChartPoint; symbol: string; indicators: { sma: boolean; ema: boolean; vwap: boolean } }) {
  const positive = point.price >= (point.open ?? point.price);
  return (
    <div className="min-w-56 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-4"><strong>{point.label}</strong><span className="font-semibold">{symbol}</span></div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[var(--text-muted)]">
        <span>Open <b className="text-[var(--text-primary)]">{(point.open ?? point.price).toFixed(2)}</b></span>
        <span>High <b className="text-emerald-400">{(point.high ?? point.price).toFixed(2)}</b></span>
        <span>Low <b className="text-rose-400">{(point.low ?? point.price).toFixed(2)}</b></span>
        <span>Close <b className={positive ? "text-emerald-400" : "text-rose-400"}>{point.price.toFixed(2)}</b></span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--theme-border)] pt-2 text-[var(--text-muted)]">
        {indicators.sma && <Metric color="#818cf8" label="SMA 20" value={point.sma20} />}
        {indicators.ema && <Metric color="#22d3ee" label="EMA 20" value={point.ema20} />}
        {indicators.vwap && <Metric color="#f59e0b" label="VWAP" value={point.vwap} />}
        <Metric color={positive ? "#22c7a9" : "#f04464"} label={positive ? "Buy volume" : "Sell volume"} value={point.volume} />
      </div>
    </div>
  );
}

export default function QuanforaStockChart({ symbol, className }: { symbol: string; className?: string }) {
  const [range, setRange] = useState<ChartRange>("6M");
  const [mode, setMode] = useState<InteractiveChartMode>("candle");
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(true);
  const [showSma, setShowSma] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showVwap, setShowVwap] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [fitKey, setFitKey] = useState(0);

  useEffect(() => {
    let canceled = false;
    const [period, interval] = PERIODS[range];
    setLoading(true);
    setError(null);
    fetchQuote(symbol, period, interval)
      .then((next) => { if (!canceled) setQuote(next); })
      .catch((reason) => { if (!canceled) setError(reason instanceof Error ? reason.message : "Chart data is unavailable."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [range, symbol]);

  const data = useMemo(() => quote ? enrichHistory(quote) : [], [quote]);
  const first = data[0]?.price ?? quote?.price ?? 0;
  const last = data.at(-1)?.price ?? quote?.price ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;
  const indicators = { sma: showSma, ema: showEma, vwap: showVwap };
  const nextMode: InteractiveChartMode = mode === "candle" ? "line" : mode === "line" ? "area" : mode === "area" ? "bar" : "candle";
  const overlays = [
    ...(showSma ? [{ key: "sma20", color: "#818cf8", lineWidth: 2 as const }] : []),
    ...(showEma ? [{ key: "ema20", color: "#22d3ee", lineWidth: 2 as const }] : []),
    ...(showVwap ? [{ key: "vwap", color: "#f59e0b", lineWidth: 2 as const }] : []),
  ];

  return (
    <section aria-label={`${symbol} Quanfora chart`} className={cn("overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)]", className)}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-primary/15 text-indigo-300"><Crosshair className="size-4" /></span>
          <div><div className="flex items-center gap-2"><strong>{symbol}</strong>{quote && <span className="tabular-nums">${last.toFixed(2)}</span>}</div><p className={cn("text-xs tabular-nums", change >= 0 ? "text-emerald-400" : "text-rose-400")}>{change >= 0 ? "+" : ""}{change.toFixed(2)}% over {range}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ToolHint label={`${MODE_LABELS[mode]} chart · Switch to ${MODE_LABELS[nextMode]}`}><Button type="button" size="icon" variant="ghost" aria-label={`Chart type: ${MODE_LABELS[mode]}`} className={TOOL_BUTTON_CLASS} onClick={() => setMode(nextMode)}>{mode === "candle" || mode === "bar" ? <CandlestickChart className="size-4" /> : <LineChart className="size-4" />}</Button></ToolHint>
          <ToolHint label="Indicators: SMA, EMA, and VWAP"><DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" size="icon" variant="ghost" aria-label="Chart indicators" className={TOOL_BUTTON_CLASS} />}><SlidersHorizontal className="size-4" /></DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-48 rounded-xl">
                <DropdownMenuItem onClick={() => setShowSma((value) => !value)}><Check className={cn("size-4", !showSma && "opacity-0")} /> SMA 20</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEma((value) => !value)}><Check className={cn("size-4", !showEma && "opacity-0")} /> EMA 20</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowVwap((value) => !value)}><Check className={cn("size-4", !showVwap && "opacity-0")} /> VWAP</DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu></ToolHint>
          <ToolHint label={showVolume ? "Hide buy and sell volume" : "Show buy and sell volume"}><Button type="button" size="icon" variant="ghost" aria-pressed={showVolume} aria-label={showVolume ? "Hide volume" : "Show volume"} className={cn(TOOL_BUTTON_CLASS, showVolume && "bg-[var(--surface-selected)] text-[var(--text-primary)]")} onClick={() => setShowVolume((value) => !value)}><Volume2 className="size-4" /></Button></ToolHint>
          <ToolHint label={measure ? "Disable range measurement" : "Measure: drag across the chart"}><Button type="button" size="icon" variant="ghost" aria-pressed={measure} aria-label={measure ? "Disable price measurement" : "Measure price range"} className={cn(TOOL_BUTTON_CLASS, measure && "bg-[var(--surface-selected)] text-[var(--text-primary)]")} onClick={() => setMeasure((value) => !value)}><Ruler className="size-4" /></Button></ToolHint>
          <ToolHint label="Fit all price history" align="end"><Button type="button" size="icon" variant="ghost" aria-label="Fit chart" className={TOOL_BUTTON_CLASS} onClick={() => setFitKey((value) => value + 1)}><Maximize2 className="size-4" /></Button></ToolHint>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
        <div className="flex gap-1" role="group" aria-label="Chart range">{RANGES.map((value) => <button key={value} type="button" onClick={() => setRange(value)} className={cn("min-h-8 rounded-lg px-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]", range === value && "bg-[var(--surface-selected)] text-[var(--text-primary)]")} aria-pressed={range === value}>{value}</button>)}</div>
        <div className="hidden flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)] sm:flex">
          {showSma && <Metric color="#818cf8" label="SMA 20" value={data.at(-1)?.sma20} />}
          {showEma && <Metric color="#22d3ee" label="EMA 20" value={data.at(-1)?.ema20} />}
          {showVwap && <Metric color="#f59e0b" label="VWAP" value={data.at(-1)?.vwap} />}
          {showVolume && <><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#22c7a9]" />Buy volume</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f04464]" />Sell volume</span></>}
        </div>
      </div>

      <div className="relative h-[520px] sm:h-[620px]">
        {loading && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-[var(--surface-card)]/80 text-sm text-[var(--text-muted)]"><span><Loader2 className="mr-2 inline size-4 animate-spin" />Loading {symbol} chart</span></div>}
        {!loading && (error || !data.length) ? <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--text-muted)]">{error ?? "No price history is available for this range."}</div> : <InteractiveMarketChart data={data} mode={mode} color={change >= 0 ? "#34d399" : "#f87171"} positiveColor="#22c7a9" negativeColor="#f04464" volume={showVolume} overlayLines={overlays} rangeKey={`${symbol}-${range}`} fitKey={fitKey} measurementEnabled={measure} axisFormatter={(value) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} timeFormatter={(label) => formatTime(label, range)} tooltip={(point) => <ChartTooltip point={point} symbol={symbol} indicators={indicators} />} tooltipClassName="rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] p-3 shadow-[var(--shadow-popover)]" />}
      </div>
      <p className="border-t border-[var(--theme-border)] px-3 py-2 text-[11px] text-[var(--text-subtle)]">Scroll to pan · Ctrl + wheel to zoom · Double-click to fit{measure ? " · Drag to measure" : ""}</p>
    </section>
  );
}
