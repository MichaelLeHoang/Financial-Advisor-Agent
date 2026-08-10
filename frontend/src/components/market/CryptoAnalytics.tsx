"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Blocks, Loader2, RefreshCw } from "lucide-react";

import BitcoinContextCards from "@/components/market/BitcoinContextCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { api, type CryptoContext, type CryptoOverview, type CryptoSeries, type CryptoSeriesPoint, type FearGreedPoint } from "@/lib/api";
import { cn } from "@/lib/utils";

type SeriesRange = "1Y" | "2Y" | "3Y" | "4Y" | "5Y";
type SentimentRange = "14D" | "30D" | "3M" | "6M" | "1Y";

const SERIES_RANGES: SeriesRange[] = ["1Y", "2Y", "3Y", "4Y", "5Y"];
const SENTIMENT_RANGES: SentimentRange[] = ["14D", "30D", "3M", "6M", "1Y"];
const SERIES_CONFIG = {
  price: { label: "Price", color: "var(--color-cyan-secondary)" },
  sma_50: { label: "50-day SMA", color: "var(--color-indigo-primary)" },
  sma_100: { label: "100-day SMA", color: "#a78bfa" },
  sma_200: { label: "200-day SMA", color: "var(--color-red-negative)" },
} satisfies ChartConfig;
const SENTIMENT_CONFIG = { value: { label: "Fear & Greed", color: "var(--color-amber-warning)" } } satisfies ChartConfig;

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function currency(value: number, quote: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: quote === "USDT" ? "USD" : quote, maximumFractionDigits: value >= 1_000 ? 0 : 2 }).format(value).replace("US$", quote === "USDT" ? "USDT " : "US$");
}

function dateLabel(value: string, withYear = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined });
}

function RangeButtons<T extends string>({ values, value, onChange, label }: { values: readonly T[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {values.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "min-h-8 rounded-lg px-2.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
            value === option && "bg-[var(--surface-selected)] text-[var(--text-primary)]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function CardHeading({ title, label, children, action }: { title: string; label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <CardHeader className="border-b border-[var(--theme-border)] py-4">
      <div className="flex min-w-0 items-center gap-2">
        <CardTitle className="truncate">{title}</CardTitle>
        <InfoTooltip label={label} side="bottom">{children}</InfoTooltip>
      </div>
      {action && <div className="col-start-2 row-start-1">{action}</div>}
    </CardHeader>
  );
}

function ChartState({ loading, error, onRetry }: { loading: boolean; error?: string | null; onRetry?: () => void }) {
  if (loading) return <div role="status" className="grid min-h-72 place-items-center text-sm text-[var(--text-muted)]"><span><Loader2 className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" />Loading analytics</span></div>;
  if (error) return <div role="alert" className="grid min-h-72 place-items-center px-6 text-center text-sm text-[var(--text-muted)]"><div><AlertCircle className="mx-auto mb-2 size-5" /><p>{error}</p>{onRetry && <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><RefreshCw className="size-3.5" />Try again</button>}</div></div>;
  return null;
}

function PriceTooltip({ active, payload, quote }: { active?: boolean; payload?: Array<{ payload: CryptoSeriesPoint }>; quote: string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const distance = point.sma_200 ? ((point.price - point.sma_200) / point.sma_200) * 100 : null;
  return (
    <div className="min-w-56 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] p-3 text-xs shadow-[var(--shadow-tooltip)]">
      <strong>{dateLabel(point.timestamp, true)}</strong>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[var(--text-muted)]">
        <span>Close</span><span className="text-right tabular-nums text-[var(--text-primary)]">{currency(point.price, quote)}</span>
        <span>50-day</span><span className="text-right tabular-nums">{point.sma_50 ? currency(point.sma_50, quote) : "—"}</span>
        <span>100-day</span><span className="text-right tabular-nums">{point.sma_100 ? currency(point.sma_100, quote) : "—"}</span>
        <span>200-day</span><span className="text-right tabular-nums">{point.sma_200 ? currency(point.sma_200, quote) : "—"}</span>
        <span>From 200-day</span><span className={cn("text-right tabular-nums", (distance ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{distance == null ? "—" : `${distance >= 0 ? "+" : ""}${distance.toFixed(1)}%`}</span>
      </div>
    </div>
  );
}

function SentimentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FearGreedPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] p-3 text-xs shadow-[var(--shadow-tooltip)]"><strong>{dateLabel(point.timestamp, true)}</strong><p className="mt-1 text-[var(--text-muted)]"><span className="font-semibold tabular-nums text-[var(--text-primary)]">{point.value}</span> · {point.classification}</p></div>;
}

function SourceLine({ source, updatedAt }: { source: string; updatedAt?: string }) {
  return <p className="border-t border-[var(--theme-border)] px-5 py-3 text-[11px] text-[var(--text-subtle)]">Source: {source}{updatedAt ? ` · Updated ${dateLabel(updatedAt, true)}` : ""}</p>;
}

export default function CryptoAnalytics({ base, quote, overview }: { base: string; quote: string; overview: CryptoOverview | null }) {
  const [seriesRange, setSeriesRange] = useState<SeriesRange>("1Y");
  const [sentimentRange, setSentimentRange] = useState<SentimentRange>("30D");
  const [series, setSeries] = useState<CryptoSeries | null>(null);
  const [context, setContext] = useState<CryptoContext | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(true);
  const [seriesRetry, setSeriesRetry] = useState(0);
  const [contextRetry, setContextRetry] = useState(0);

  useEffect(() => {
    let canceled = false;
    setSeriesLoading(true);
    setSeriesError(null);
    api.cryptoSeries(base, quote, seriesRange)
      .then((value) => { if (!canceled) setSeries(value); })
      .catch(() => { if (!canceled) setSeriesError("Long-term price history is temporarily unavailable. The live price chart above is still available."); })
      .finally(() => { if (!canceled) setSeriesLoading(false); });
    return () => { canceled = true; };
  }, [base, quote, seriesRange, seriesRetry]);

  useEffect(() => {
    let canceled = false;
    setContextLoading(true);
    setContextError(null);
    api.cryptoContext(base, quote, sentimentRange)
      .then((value) => { if (!canceled) setContext(value); })
      .catch(() => { if (!canceled) setContextError("Market context is temporarily unavailable. Try refreshing this section."); })
      .finally(() => { if (!canceled) setContextLoading(false); });
    return () => { canceled = true; };
  }, [base, quote, sentimentRange, contextRetry]);

  const latest = series?.points.at(-1);
  const sentiment = context?.fear_greed;
  const halving = context?.halving;
  const chartMargin = { top: 8, right: 18, bottom: 0, left: 8 };
  const latestMetrics = useMemo(() => [
    { label: "Price", value: latest?.price, color: "var(--color-cyan-secondary)" },
    { label: "50-day", value: latest?.sma_50, color: "var(--color-indigo-primary)" },
    { label: "100-day", value: latest?.sma_100, color: "#a78bfa" },
    { label: "200-day", value: latest?.sma_200, color: "var(--color-red-negative)" },
  ], [latest]);

  return (
    <section aria-labelledby="crypto-analytics-title" className="space-y-4">
      <div>
        <h2 id="crypto-analytics-title" className="text-xl font-semibold">{base === "BTC" ? "Bitcoin analytics" : `${base} analytics`}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{base === "BTC" ? "Long-term trend, market sentiment, and the current issuance cycle." : "Long-term trend and broader crypto-market sentiment."}</p>
      </div>

      {base === "BTC" && <BitcoinContextCards context={context} overview={overview} loading={contextLoading} />}

      <Card className="gap-0 py-0">
        <CardHeading title={`${base} price and moving averages`} label="About moving averages" action={<RangeButtons values={SERIES_RANGES} value={seriesRange} onChange={setSeriesRange} label="Moving-average range" />}>
          <strong>What this shows</strong>
          <p className="mt-1 text-[var(--text-muted)]">Daily price with 50, 100, and 200-day simple moving averages. Shorter averages react faster; longer averages show broader trend. Crossovers provide context, not a recommendation.</p>
          <p className="mt-2 text-[var(--text-subtle)]">CoinGecko with normalized yfinance fallback · Daily history · {quote === "USDT" ? "USD analytics proxy for USDT" : quote}</p>
        </CardHeading>
        <CardContent className="px-3 pb-2 pt-4 sm:px-5">
          {seriesLoading || seriesError ? <ChartState loading={seriesLoading} error={seriesError} onRetry={() => setSeriesRetry((value) => value + 1)} /> : (
            <>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[11px] text-[var(--text-muted)]">
                {latestMetrics.map((metric) => metric.value != null && <span key={metric.label} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: metric.color }} />{metric.label} <b className="tabular-nums text-[var(--text-primary)]">{currency(metric.value, quote)}</b></span>)}
              </div>
              <ChartContainer config={SERIES_CONFIG} className="h-[320px] w-full aspect-auto sm:h-[390px]" initialDimension={{ width: 900, height: 390 }}>
                <LineChart data={series?.points ?? []} margin={chartMargin} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="var(--theme-border)" strokeOpacity={0.7} />
                  <XAxis dataKey="timestamp" tickLine={false} axisLine={false} minTickGap={52} tickFormatter={(value) => dateLabel(String(value))} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(value) => compact(Number(value))} domain={["auto", "auto"]} />
                  <RechartsTooltip content={<PriceTooltip quote={quote} />} cursor={{ stroke: "var(--text-subtle)", strokeDasharray: "4 4" }} />
                  <Line dataKey="price" type="monotone" stroke="var(--color-cyan-secondary)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                  <Line dataKey="sma_50" type="monotone" stroke="var(--color-indigo-primary)" strokeWidth={1.6} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="sma_100" type="monotone" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="sma_200" type="monotone" stroke="var(--color-red-negative)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </>
          )}
        </CardContent>
        <SourceLine source={series?.data_sources.map((source) => source === "yfinance" ? "Yahoo Finance" : "CoinGecko").join(" · ") || "CoinGecko / Yahoo Finance fallback"} updatedAt={series?.updated_at} />
      </Card>

      <div className={cn("grid items-stretch gap-4", base === "BTC" && "xl:grid-cols-2")}>
        <Card className="gap-0 py-0">
          <CardHeading title="Fear & Greed trend" label="About Fear & Greed" action={<RangeButtons values={SENTIMENT_RANGES} value={sentimentRange} onChange={setSentimentRange} label="Sentiment range" />}>
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">A 0–100 summary of crypto-market sentiment. Low values indicate fear and high values indicate greed. It updates daily and can lag fast moves; it is not a buy or sell signal.</p>
            <p className="mt-2 text-[var(--text-subtle)]">Alternative.me · Daily</p>
          </CardHeading>
          <CardContent className="px-3 pb-3 pt-4 sm:px-5">
            {contextLoading || contextError || !sentiment?.points.length ? <ChartState loading={contextLoading} error={contextError ?? (!contextLoading ? "Sentiment history is temporarily unavailable." : null)} onRetry={() => setContextRetry((value) => value + 1)} /> : (
              <>
                <div className="mb-2 flex items-baseline gap-2 px-1"><strong className="text-2xl tabular-nums">{sentiment.current_value}</strong><span className="text-sm text-[var(--text-muted)]">{sentiment.current_classification}</span>{sentiment.daily_change != null && <span className={cn("ml-auto text-xs tabular-nums", sentiment.daily_change >= 0 ? "text-emerald-400" : "text-rose-400")}>{sentiment.daily_change >= 0 ? "+" : ""}{sentiment.daily_change} today</span>}</div>
                <ChartContainer config={SENTIMENT_CONFIG} className="h-[260px] w-full aspect-auto" initialDimension={{ width: 620, height: 260 }}>
                  <LineChart data={sentiment.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke="var(--theme-border)" strokeOpacity={0.7} />
                    <ReferenceArea y1={0} y2={24} fill="var(--color-red-negative)" fillOpacity={0.05} />
                    <ReferenceArea y1={75} y2={100} fill="var(--color-green-positive)" fillOpacity={0.05} />
                    <ReferenceLine y={25} stroke="var(--color-red-negative)" strokeOpacity={0.35} strokeDasharray="4 4" />
                    <ReferenceLine y={75} stroke="var(--color-green-positive)" strokeOpacity={0.35} strokeDasharray="4 4" />
                    <XAxis dataKey="timestamp" tickLine={false} axisLine={false} minTickGap={38} tickFormatter={(value) => dateLabel(String(value))} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={34} />
                    <RechartsTooltip content={<SentimentTooltip />} cursor={{ stroke: "var(--text-subtle)", strokeDasharray: "4 4" }} />
                    <Line dataKey="value" type="monotone" stroke="var(--color-amber-warning)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ChartContainer>
              </>
            )}
          </CardContent>
          <SourceLine source="Alternative.me Fear & Greed Index" updatedAt={sentiment?.updated_at} />
        </Card>

        {base === "BTC" && <Card className="gap-0 py-0">
          <CardHeading title="Halving cycle progress" label="About Bitcoin halvings">
            <strong>What this shows</strong>
            <p className="mt-1 text-[var(--text-muted)]">Bitcoin reduces its block subsidy every 210,000 blocks. Progress is block-based; the next date uses the recent average block interval and is an estimate. Past cycles do not forecast future returns.</p>
            <p className="mt-2 text-[var(--text-subtle)]">Blockchain.com · Refreshed every 15 minutes</p>
          </CardHeading>
          <CardContent className="flex min-h-[330px] flex-col justify-center px-5 py-6">
            {contextLoading || contextError || !halving ? <ChartState loading={contextLoading} error={contextError ?? (!contextLoading ? "Block-height context is temporarily unavailable." : null)} onRetry={() => setContextRetry((value) => value + 1)} /> : (
              <div>
                <div className="flex items-start justify-between gap-4 text-sm">
                  <div><p className="font-medium">Halving 4</p><p className="mt-1 text-xs text-[var(--text-muted)]">{dateLabel(halving.previous_halving_date, true)} · Block {compact(halving.previous_halving_height)}</p></div>
                  <div className="text-right"><p className="font-medium">Estimated halving {halving.next_halving_number}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{dateLabel(halving.estimated_next_halving_date, true)}</p></div>
                </div>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--surface-control)]" role="progressbar" aria-label="Bitcoin halving cycle progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={halving.progress_pct}>
                  <div className="h-full rounded-full bg-indigo-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${halving.progress_pct}%` }} />
                </div>
                <p className="mt-2 text-center text-xs font-semibold tabular-nums">{halving.progress_pct.toFixed(1)}% complete</p>
                <div className="mt-7 grid grid-cols-2 border-y border-[var(--theme-border)] sm:grid-cols-4">
                  {[
                    ["Latest block", compact(halving.latest_block_height)],
                    ["Blocks left", compact(halving.blocks_remaining)],
                    ["Est. days left", halving.estimated_days_remaining.toLocaleString()],
                    ["Avg. block", `${halving.average_block_minutes.toFixed(1)} min`],
                  ].map(([label, value], index) => <div key={label} className={cn("px-3 py-4 text-center", index % 2 !== 0 && "border-l border-[var(--theme-border)]", index >= 2 && "border-t border-[var(--theme-border)] sm:border-t-0", index === 2 && "sm:border-l")}><p className="text-[11px] text-[var(--text-muted)]">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>)}
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]"><Blocks className="size-3.5" />Target block {halving.next_halving_height.toLocaleString()}</p>
              </div>
            )}
          </CardContent>
          <SourceLine source="Blockchain.com" updatedAt={halving?.updated_at} />
        </Card>}
      </div>

    </section>
  );
}
