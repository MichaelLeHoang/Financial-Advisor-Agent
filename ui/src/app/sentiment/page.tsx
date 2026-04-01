"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { api } from "@/lib/api";
import type { SentimentResult } from "@/lib/api";

export default function SentimentPage() {
  const [input, setInput] = useState("");
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const addHeadline = () => {
    if (input.trim() && !headlines.includes(input.trim())) {
      setHeadlines((prev) => [...prev, input.trim()]);
      setInput("");
    }
  };

  const analyze = async () => {
    if (headlines.length === 0) return;
    setLoading(true);
    try {
      setResult(await api.sentiment(headlines));
    } finally {
      setLoading(false);
    }
  };

  const mood = result?.market_mood;
  const bullish = mood ? mood.bullish_score : 0;
  // Map -1..1 to 0..180 degrees for the gauge
  const angle = ((bullish + 1) / 2) * 180;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold glow-text mb-1">Sentiment Analysis</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Powered by FinBERT — add financial headlines and analyze market mood.
      </p>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 glass rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
          style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
          placeholder='e.g. "Apple beats earnings expectations"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHeadline()}
        />
        <button
          onClick={addHeadline}
          className="glass px-4 py-2 rounded-xl text-sm font-medium transition-all hover:border-[var(--accent)]"
          style={{ color: "var(--accent)" }}
        >
          Add
        </button>
      </div>

      {/* Headline chips */}
      <div className="flex flex-wrap gap-2 mb-4 min-h-8">
        {headlines.map((h) => (
          <span
            key={h}
            className="glass flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {h.length > 40 ? h.slice(0, 40) + "…" : h}
            <button onClick={() => setHeadlines((prev) => prev.filter((x) => x !== h))}>
              <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            </button>
          </span>
        ))}
      </div>

      <button
        onClick={analyze}
        disabled={headlines.length === 0 || loading}
        className="w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
        style={{ background: "var(--accent)", boxShadow: "0 0 20px var(--accent-glow)" }}
      >
        {loading ? "Analyzing…" : `Analyze ${headlines.length} headline${headlines.length !== 1 ? "s" : ""}`}
      </button>

      {/* Results */}
      {mood && (
        <div className="mt-8 flex flex-col gap-4">
          {/* Arc Gauge */}
          <div className="glass rounded-2xl p-6 flex flex-col items-center gap-4">
            <svg viewBox="0 0 200 110" className="w-56">
              {/* Background arc */}
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
              {/* Colored arc (red → green) */}
              <defs>
                <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent-red)" />
                  <stop offset="50%" stopColor="var(--accent-amber)" />
                  <stop offset="100%" stopColor="var(--accent-green)" />
                </linearGradient>
              </defs>
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
              {/* Needle */}
              <line
                x1="100" y1="100"
                x2={100 + 60 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
                y2={100 - 60 * Math.sin((angle * Math.PI) / 180)}
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="100" cy="100" r="5" fill="white" />
              <text x="10" y="118" fontSize="10" fill="var(--accent-red)" textAnchor="middle">Bearish</text>
              <text x="190" y="118" fontSize="10" fill="var(--accent-green)" textAnchor="middle">Bullish</text>
            </svg>

            <div className="text-center">
              <p
                className="text-3xl font-bold"
                style={{ color: bullish > 0.1 ? "var(--accent-green)" : bullish < -0.1 ? "var(--accent-red)" : "var(--accent-amber)" }}
              >
                {mood.signal}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Bullish score: {bullish > 0 ? "+" : ""}{bullish.toFixed(3)}
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-4 w-full">
              {Object.entries(mood.breakdown).map(([label, count]) => (
                <div key={label} className="text-center">
                  <p className="text-xl font-bold" style={{
                    color: label === "positive" ? "var(--accent-green)" : label === "negative" ? "var(--accent-red)" : "var(--text-muted)"
                  }}>{count}</p>
                  <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Individual results */}
          <div className="flex flex-col gap-2">
            {result!.individual.map((item, i) => (
              <div
                key={i}
                className="glass rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
              >
                <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                  {headlines[i]}
                </p>
                <span
                  className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: item.label === "positive" ? "rgba(52,211,153,0.15)" : item.label === "negative" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)",
                    color: item.label === "positive" ? "var(--accent-green)" : item.label === "negative" ? "var(--accent-red)" : "var(--text-muted)",
                  }}
                >
                  {item.label} {(item.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
