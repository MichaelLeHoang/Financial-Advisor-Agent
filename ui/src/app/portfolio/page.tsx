"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { OptimizeResult } from "@/lib/api";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

export default function PortfolioPage() {
    const [tickers, setTickers] = useState(["AAPL", "NVDA", "GOOGL"]);
    const [input, setInput] = useState("");
    const [mode, setMode] = useState<"classical" | "quantum">("classical");
    const [risk, setRisk] = useState(1.0);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addTicker = () => {
        const t = input.trim().toUpperCase();
        if (t && !tickers.includes(t)) setTickers((prev) => [...prev, t]);
        setInput("");
    };

    const optimize = async () => {
        if (tickers.length < 2) { setError("Add at least 2 tickers"); return; }
        setLoading(true); setError(null);
        try {
            setResult(await api.optimize(tickers, mode, risk));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const pieData = result?.weights
        ? Object.entries(result.weights).map(([name, value]) => ({ name, value: Math.round(value * 1000) / 10, color: COLORS[Object.keys(result.weights!).indexOf(name) % COLORS.length] }))
        : [];

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-10">
                <h1 className="text-4xl font-bold">Portfolio Optimizer</h1>

                {/* Config card */}
                <div className="glass p-8 rounded-[32px] space-y-8">
                    <div className="space-y-4">
                        <label className="text-sm text-white/40">Target Assets</label>
                        <div className="flex flex-wrap gap-3 p-4 glass rounded-2xl">
                            {tickers.map((t) => (
                                <div key={t} className="bg-indigo-primary/20 text-indigo-primary px-4 py-2 rounded-xl flex items-center gap-2 font-bold">
                                    {t}
                                    <button onClick={() => setTickers((prev) => prev.filter((x) => x !== t))}>
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === "Enter" && addTicker()}
                                placeholder="Add ticker..."
                                className="bg-transparent focus:outline-none text-sm w-24"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-sm text-white/40">Optimization Strategy</label>
                            <div className="flex p-1 glass rounded-2xl">
                                <button
                                    onClick={() => setMode("classical")}
                                    className={cn("flex-1 py-3 rounded-xl transition-all", mode === "classical" ? "bg-white/10 text-white" : "text-white/40")}
                                >
                                    Classical
                                </button>
                                <button
                                    onClick={() => setMode("quantum")}
                                    className={cn("flex-1 py-3 rounded-xl transition-all", mode === "quantum" ? "bg-indigo-primary text-white glow-indigo" : "text-white/40")}
                                >
                                    Quantum
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="text-sm text-white/40">Risk Tolerance — {risk.toFixed(1)}</label>
                            <div className="px-4 py-6">
                                <input
                                    type="range" min="0.1" max="3" step="0.1" value={risk}
                                    onChange={(e) => setRisk(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-primary"
                                />
                                <div className="flex justify-between mt-2 text-xs text-white/40">
                                    <span>Conservative</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-negative">{error}</p>}

                    <button
                        onClick={optimize}
                        disabled={loading}
                        className="w-full bg-indigo-primary py-5 rounded-2xl font-bold text-lg glow-indigo hover:scale-[1.01] transition-transform disabled:opacity-40"
                    >
                        {loading ? "Optimizing…" : "Optimize Portfolio"}
                    </button>
                </div>

                {/* Results */}
                {result && (
                    <>
                        {/* Metrics */}
                        {result.weights && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { label: "Expected Return", value: `${((result.expected_annual_return ?? 0) * 100).toFixed(1)}%`, color: "text-green-positive" },
                                        { label: "Volatility", value: `${((result.annual_volatility ?? 0) * 100).toFixed(1)}%`, color: "text-amber-warning" },
                                        { label: "Sharpe Ratio", value: (result.sharpe_ratio ?? 0).toFixed(2), color: "text-indigo-primary" },
                                    ].map((m) => (
                                        <div key={m.label} className="glass p-6 rounded-3xl text-center">
                                            <div className="text-white/40 text-sm mb-2">{m.label}</div>
                                            <div className={cn("text-4xl font-bold", m.color)}>{m.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pie chart + legend */}
                                <div className="glass p-10 rounded-[40px] flex flex-col md:flex-row items-center gap-12">
                                    <div className="w-64 h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={pieData}
                                                    innerRadius={80}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-6 w-full">
                                        {pieData.map((d) => (
                                            <div key={d.name} className="flex items-center justify-between p-4 glass rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                                    <span className="font-bold">{d.name}</span>
                                                </div>
                                                <span className="text-white/60">{d.value}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Quantum results */}
                        {result.selected_stocks && (
                            <div className="glass p-8 rounded-[32px] space-y-6">
                                <h3 className="text-xl font-bold">⚛️ QAOA Selected Portfolio</h3>
                                <div className="flex gap-3 flex-wrap">
                                    {result.selected_stocks.map((t) => (
                                        <span key={t} className="px-4 py-2 rounded-xl text-sm font-bold bg-cyan-secondary text-space-black">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                                {result.best_probability && (
                                    <p className="text-white/40 text-sm">Best probability: {(result.best_probability * 100).toFixed(1)}%</p>
                                )}
                                {result.top_states && (
                                    <div className="space-y-3 mt-4">
                                        <h4 className="text-sm text-white/40 font-bold">Top Quantum States</h4>
                                        {result.top_states.map((s, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <span className="font-mono text-xs w-20 shrink-0 text-white/40">|{s.bitstring}⟩</span>
                                                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{ width: `${s.probability * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                                                    />
                                                </div>
                                                <span className="text-xs text-white/40 w-12 text-right">{(s.probability * 100).toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
