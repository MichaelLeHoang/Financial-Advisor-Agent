"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { fetchQuotes } from "@/lib/quote-cache";
import type { MarketQuote } from "@/lib/api";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

/* Google-Finance-style market summary strip: a row of index cards with
   value, percent change and a mini sparkline. yfinance index symbols. */
const INDICES: { ticker: string; label: string }[] = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "^DJI", label: "Dow Jones" },
  { ticker: "^IXIC", label: "Nasdaq" },
  { ticker: "^RUT", label: "Russell 2000" },
  { ticker: "^VIX", label: "VIX" },
];

interface IndexState {
  ticker: string;
  label: string;
  quote: MarketQuote | null;
  loading: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniSparkline({ history, positive }: { history: { price: number }[]; positive: boolean }) {
  if (history.length < 2) return <div className="h-full w-full" />;
  return (
    <div className={cn("h-full w-full", positive ? "text-green-positive" : "text-red-negative")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`idx-${positive ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.3} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke="currentColor"
            strokeWidth={1.5}
            fill={`url(#idx-${positive ? "up" : "dn"})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function MarketIndicesStrip() {
  const [indices, setIndices] = useState<IndexState[]>(
    INDICES.map((i) => ({ ...i, quote: null, loading: true }))
  );

  useEffect(() => {
    let cancelled = false;
    fetchQuotes(INDICES.map((index) => index.ticker)).then((quotes) => {
      if (cancelled) return;
      setIndices(
        INDICES.map((index) => ({
          ...index,
          quote: quotes.get(index.ticker.toUpperCase()) ?? null,
          loading: false,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HorizontalScroll className="-mx-1 flex gap-3 px-1 pb-1">
      {indices.map((index) => {
        const q = index.quote;
        const pct = q ? q.change : 0;
        const positive = pct >= 0;
        const Arrow = positive ? ArrowUp : ArrowDown;
        return (
          <div
            key={index.ticker}
            className="flex min-w-[180px] flex-1 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/45">{index.label}</p>
              {index.loading ? (
                <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-white/[0.07]" />
              ) : q ? (
                <>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-white">{fmt(q.price)}</p>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
                      positive ? "text-green-positive" : "text-red-negative"
                    )}
                  >
                    <Arrow className="h-3 w-3" aria-hidden="true" />
                    {fmt(Math.abs(pct))}%
                  </span>
                </>
              ) : (
                <p className="mt-1 text-xs text-white/25">Unavailable</p>
              )}
            </div>
            <div className="h-12 w-20 shrink-0">
              {q && q.history.length > 1 && <MiniSparkline history={q.history} positive={positive} />}
            </div>
          </div>
        );
      })}
    </HorizontalScroll>
  );
}
