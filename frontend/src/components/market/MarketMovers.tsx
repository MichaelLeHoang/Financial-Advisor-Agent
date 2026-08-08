"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchQuotes } from "@/lib/quote-cache";
import type { MarketQuote } from "@/lib/api";

/* A broad, liquid universe so gainers / losers / most-active stay meaningful. */
const UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
  "NFLX", "JPM", "BAC", "XOM", "DIS", "INTC", "BA", "PFE",
  "KO", "WMT", "CRM", "ORCL",
];

interface Row {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number | null;
}

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function MoverList({ title, rows, metric }: { title: string; rows: Row[]; metric: "change" | "volume" }) {
  return (
    <div className="flex-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-4">
      <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="space-y-1">
        {rows.length === 0 && <div className="py-6 text-center text-xs text-[var(--text-subtle)]">Loading…</div>}
        {rows.map((row) => {
          const positive = row.changePct >= 0;
          const Arrow = positive ? ArrowUp : ArrowDown;
          return (
            <Link
              key={row.ticker}
              href={`/discover/markets/stocks/${encodeURIComponent(row.ticker)}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface-card-hover)]"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ticker}</div>
                <div className="truncate text-xs text-[var(--text-subtle)]">{row.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm tabular-nums text-[var(--text-primary)]">${fmtPrice(row.price)}</div>
                {metric === "volume" ? (
                  <div className="text-xs tabular-nums text-[var(--text-subtle)]">{row.volume != null ? compact.format(row.volume) : "—"} vol</div>
                ) : (
                  <div className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", positive ? "text-green-positive" : "text-red-negative")}>
                    <Arrow className="h-3 w-3" aria-hidden="true" />
                    {Math.abs(row.changePct).toFixed(2)}%
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketMovers() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchQuotes(UNIVERSE).then((quotes) => {
      if (cancelled) return;
      const next: Row[] = [];
      UNIVERSE.forEach((ticker) => {
        const q: MarketQuote | undefined = quotes.get(ticker.toUpperCase());
        if (q) next.push({ ticker, name: q.name, price: q.price, changePct: q.change, volume: q.volume ?? null });
      });
      setRows(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const gainers = useMemo(() => [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 5), [rows]);
  const losers = useMemo(() => [...rows].sort((a, b) => a.changePct - b.changePct).slice(0, 5), [rows]);
  const mostActive = useMemo(() => [...rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5), [rows]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MoverList title="Most active" rows={mostActive} metric="volume" />
      <MoverList title="Daily gainers" rows={gainers} metric="change" />
      <MoverList title="Daily losers" rows={losers} metric="change" />
    </div>
  );
}
