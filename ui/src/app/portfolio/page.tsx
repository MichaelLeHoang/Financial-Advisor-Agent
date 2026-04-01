"use client";

import { useState } from "react";
import { X, Plus, Zap, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import type { OptimizeResult } from "@/lib/api";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

export default function PortfolioPage() {
    const [tickerInput, setTickerInput] = useState("");
    const [tickers, setTickers] = useState<string[]>(["AAPL", "NVDA", "GOOGL"]);
    const [method, setMethod] = useState<"classical" | "quantum">("classical");
    const [risk, setRisk] = useState(1.0);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addTicker = () => {
        const t = tickerInput.trim().toUpperCase();
        if (t && !tickers.includes(t)) setTickers((prev) => [...prev, t]);
        setTickerInput("");
    };

    const optimize = async () => {
        if (tickers.length < 2) { setError("Add at least 2 tickers"); return; }
        setLoading(true); setError(null);
        try {
            setResult(await api.optimize(tickers, method, risk));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const pieData = result?.weights
        ? Object.entries(result.weights).map(([name, value]) => ({ name, value: Math.round(value * 1000) / 10 }))
        : [];

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold glow-text mb-1">Portfolio Optimizer</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Classical Markowitz or Quantum QAOA optimization.</p>

            {/* Ticker tags */}
            <div className="glass rounded-2xl p-4 mb-4">
                <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>TICKERS</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {tickers.map((t) => (
                        <span key={t} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: "var(--accent)", color: "white" }}>
                            {t}
                            <button onClick={() => setTickers((prev) => prev.filter((x) => x !== t))}>
                                <X className="w-3 h-3 opacity-70" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-transparent text-sm outline-none px-3 py-2 rounded-xl border"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                        placeholder="Add ticker (e.g. TSLA)"
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && addTicker()}
                    />
                    <button onClick={addTicker} className="glass px-3 py-2 rounded-xl text-sm" style={{ color: "var(--accent)" }}>
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Method + Risk */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>METHOD</p>
                    <div className="flex gap-2">
                        {(["classical", "quantum"] as const).map((m) => (
                            <button key={m} onClick={() => setMethod(m)}
                                className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all capitalize"
                                style={{
                                    background: method === m ? "var(--accent)" : "transparent",
                                    border: "1px solid",
                                    borderColor: method === m ? "var(--accent)" : "var(--border)",
                                    color: method === m ? "white" : "var(--text-muted)",
                                }}>
                                {m === "quantum" ? "⚛️ " : "📊 "}{m}
                            </button>
                        ))}
                    </div>
                </div>
                {method === "classical" && (
                    <div className="glass rounded-2xl p-4">
                        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                            RISK TOLERANCE — {risk.toFixed(1)}
                        </p>
                        <input type="range" min="0.1" max="3" step="0.1" value={risk}
                            onChange={(e) => setRisk(parseFloat(e.target.value))}
                            className="w-full accent-indigo-500" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            <span>Conservative</span><span>Aggressive</span>
                        </div>
                    </div>
                )}
            </div>

            {error && <p className="text-sm mb-3" style={{ color: "var(--accent-red)" }}>{error}</p>}

            <button onClick={optimize} disabled={loading}
                className="w-full py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", boxShadow: "0 0 20px var(--accent-glow)" }}>
                {loading ? "Optimizing…" : "Optimize Portfolio"}
            </button>

            {/* Results */}
            {result && (
                <div className="mt-6 flex flex-col gap-4">

                    {/* Classical: metrics + donut */}
                    {result.weights && (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: "Expected Return", value: `${((result.expected_annual_return ?? 0) * 100).toFixed(1)}%`, color: "var(--accent-green)" },
                                    { label: "Volatility", value: `${((result.annual_volatility ?? 0) * 100).toFixed(1)}%`, color: "var(--accent-amber)" },
                                    { label: "Sharpe Ratio", value: (result.sharpe_ratio ?? 0).toFixed(2), color: "var(--accent)" },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="glass rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="glass rounded-2xl p-4" style={{ height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                            paddingAngle={3} dataKey="value" isAnimationActive>
                                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `${v}%`}
                                            contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }} />
                                        <Legend formatter={(v) => <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{v}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}

                    {/* Quantum: selected stocks + probability bars */}
                    {result.selected_stocks && (
                        <div className="glass rounded-2xl p-4 flex flex-col gap-4">
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>⚛️ QAOA Selected Stocks</p>
                            <div className="flex gap-2 flex-wrap">
                                {result.selected_stocks.map((t) => (
                                    <span key={t} className="px-3 py-1 rounded-full text-sm font-medium"
                                        style={{ background: "var(--accent)", color: "white" }}>{t}</span>
                                ))}
                            </div>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Best probability: {((result.best_probability ?? 0) * 100).toFixed(1)}%
                            </p>

                            {/* Top quantum states */}
                            {result.top_states && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>TOP STATES</p>
                                    {result.top_states.map((state, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-xs font-mono w-24 shrink-0" style={{ color: "var(--text-muted)" }}>{state.bitstring}</span>
                                            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                                <div className="h-full rounded-full transition-all"
                                                    style={{ width: `${state.probability * 100}%`, background: COLORS[i % COLORS.length] }} />
                                            </div>
                                            <span className="text-xs w-12 text-right" style={{ color: "var(--text-secondary)" }}>
                                                {(state.probability * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
