"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const TICKERS = ["AAPL", "NVDA", "GOOGL", "MSFT", "TSLA", "AMZN", "META"];

interface StockData {
  ticker: string;
  price: number | null;
  change: number | null;
  loading: boolean;
  error?: string;
}

// Parse the plain-text response from get_stock_info tool format
function parseStockText(text: string, ticker: string): Partial<StockData> {
  const priceMatch = text.match(/Latest Close: \$([0-9.]+)/);
  const changeMatch = text.match(/Daily Change: ([+-]?[0-9.]+)%/);
  return {
    price: priceMatch ? parseFloat(priceMatch[1]) : null,
    change: changeMatch ? parseFloat(changeMatch[1]) : null,
  };
}

export default function MarketPage() {
  const [stocks, setStocks] = useState<StockData[]>(
    TICKERS.map((t) => ({ ticker: t, price: null, change: null, loading: true }))
  );

  const fetchAll = async () => {
    setStocks((prev) => prev.map((s) => ({ ...s, loading: true, error: undefined })));

    await Promise.all(
      TICKERS.map(async (ticker, i) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/agent/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: `get_stock_info for ${ticker}`, remember: false, session_id: "market-page" }),
            }
          );

          // Use the direct predict endpoint for raw data instead
          const directRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/predict`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticker, model_type: "random_forest", sequence_length: 5 }),
            }
          );
          const data = await directRes.json();
          setStocks((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, loading: false, price: null, change: null }
                : s
            )
          );
        } catch {
          setStocks((prev) =>
            prev.map((s, idx) => idx === i ? { ...s, loading: false, error: "Failed" } : s)
          );
        }
      })
    );
  };

  useEffect(() => { fetchAll(); }, []);

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold glow-text">Market Overview</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Real-time stock data via yfinance</p>
          </div>
          <button
            onClick={fetchAll}
            className="glass flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:border-[var(--accent)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Ticker grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {TICKERS.map((ticker) => (
            <StockCard key={ticker} ticker={ticker} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual stock card — fetches its own data
function StockCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<{ price: number | null; change: number | null; loading: boolean }>({
    price: null, change: null, loading: true,
  });

  useEffect(() => {
    // We'll use the agent chat API with a specific stock info request
    const load = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/agent/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Use the get_stock_info tool to get current data for ${ticker}. Reply ONLY with the raw tool output, no extra text.`,
              remember: false,
              session_id: `market-${ticker}`,
            }),
          }
        );
        const json = await res.json();
        const parsed = parseStockText(json.response, ticker);
        setData({ ...parsed, loading: false } as any);
      } catch {
        setData({ price: null, change: null, loading: false });
      }
    };
    load();
  }, [ticker]);

  const up = (data.change ?? 0) >= 0;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2 transition-all hover:border-[var(--border-hover)]">
      <div className="flex items-center justify-between">
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>{ticker}</span>
        {!data.loading && data.change !== null && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: up ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
              color: up ? "var(--accent-green)" : "var(--accent-red)",
            }}
          >
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? "+" : ""}{data.change?.toFixed(2)}%
          </span>
        )}
      </div>

      {data.loading ? (
        <div className="h-8 w-24 rounded-md animate-pulse" style={{ background: "var(--bg-card)" }} />
      ) : (
        <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {data.price ? `$${data.price.toFixed(2)}` : "—"}
        </p>
      )}

      {/* Sparkline placeholder (solid bar) */}
      <div className="h-12 mt-1 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div
          className="h-full"
          style={{
            background: up
              ? "linear-gradient(to right, transparent, rgba(52,211,153,0.2))"
              : "linear-gradient(to right, transparent, rgba(248,113,113,0.2))",
          }}
        />
      </div>
    </div>
  );
}
