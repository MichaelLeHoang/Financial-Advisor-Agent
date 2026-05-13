"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { OptimizeResult, Portfolio } from "@/lib/api";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

export default function PortfolioPage() {
    const [tickers, setTickers] = useState(["AAPL", "NVDA", "GOOGL"]);
    const [input, setInput] = useState("");
    const [mode, setMode] = useState<"classical" | "quantum">("classical");
    const [risk, setRisk] = useState(1.0);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [portfolioName, setPortfolioName] = useState("Core Portfolio");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

    const addTicker = (value = input) => {
        const t = value.trim().toUpperCase();
        if (t && !tickers.includes(t)) setTickers((prev) => [...prev, t]);
        setInput("");
    };

    const refreshPortfolios = async () => setPortfolios(await api.portfolios());

    useEffect(() => {
        void refreshPortfolios();
    }, []);

    const createPortfolio = async () => {
        if (!portfolioName.trim()) return;
        setLoading(true);
        setError(null);
        setUpgradeMessage(null);
        try {
            await api.createPortfolio(portfolioName.trim(), "USD");
            setPortfolioName("");
            await refreshPortfolios();
        } catch (e: any) {
            if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
            else setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const optimize = async () => {
        if (tickers.length < 2) { setError("Add at least 2 tickers"); return; }
        setLoading(true); setError(null); setUpgradeMessage(null);
        try {
            setResult(await api.optimize(tickers, mode, risk));
        } catch (e: any) {
            if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
            else setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const pieData = result?.weights
        ? Object.entries(result.weights).map(([name, value]) => ({ name, value: Math.round(value * 1000) / 10, color: COLORS[Object.keys(result.weights!).indexOf(name) % COLORS.length] }))
        : [];
    const riskProgress = `${((risk - 0.1) / (3 - 0.1)) * 100}%`;

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-10">
                <h1 className="text-4xl font-bold gradient-highlight">Portfolio Optimizer</h1>
                {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

                <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                    <CardContent className="space-y-5 p-6">
                        <div className="flex flex-col gap-3 md:flex-row">
                        <Input
                            value={portfolioName}
                            onChange={(event) => setPortfolioName(event.target.value)}
                            placeholder="Portfolio name"
                            className="h-11 flex-1 rounded-xl border-white/[0.06] bg-white/[0.035] px-4 text-sm text-white placeholder:text-white/24"
                        />
                        <Button
                            onClick={createPortfolio}
                            disabled={loading}
                            className="theme-solid-action h-11 rounded-xl px-4 text-sm font-semibold"
                        >
                            Create Portfolio
                        </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                        {portfolios.map((portfolio) => (
                            <div key={portfolio.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] p-4">
                                <div className="font-semibold">{portfolio.name}</div>
                                <div className="mt-1 text-xs text-white/35">{portfolio.base_currency}</div>
                            </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Config card */}
                <div className="portfolio-config-surface glass p-8 rounded-[32px] space-y-8">
                    <div className="space-y-4">
                        <label className="portfolio-label text-sm text-white/40">Target Assets</label>
                        <div className="portfolio-control-panel flex flex-wrap gap-3 rounded-2xl border border-white/[0.06] p-4">
                            {tickers.map((t) => (
                                <div key={t} className="portfolio-token bg-indigo-primary/20 text-indigo-primary px-4 py-2 rounded-xl flex items-center gap-2 font-bold">
                                    {t}
                                    <button
                                        type="button"
                                        onClick={() => setTickers((prev) => prev.filter((x) => x !== t))}
                                        className="group inline-flex size-5 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                                        aria-label={`Remove ${t}`}
                                    >
                                        <img
                                            src="/close-svgrepo-com.svg"
                                            alt=""
                                            aria-hidden="true"
                                            className="size-4 opacity-70 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_7px_rgba(255,255,255,0.65)]"
                                        />
                                    </button>
                                </div>
                            ))}
                            <TickerSuggestionInput
                                value={input}
                                onValueChange={setInput}
                                onSelect={addTicker}
                                existingTickers={tickers}
                                placeholder="Add ticker..."
                                className="max-w-72"
                                inputClassName="portfolio-input border-transparent bg-transparent shadow-none focus-visible:ring-0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="portfolio-label text-sm text-white/40">Optimization Strategy</label>
                            <div className="portfolio-control-panel flex rounded-2xl border border-white/[0.06] p-1">
                                <button
                                    onClick={() => setMode("classical")}
                                    data-selected={mode === "classical"}
                                    className={cn("portfolio-segment flex-1 py-3 rounded-xl transition-all", mode === "classical" ? "bg-white/10 text-white" : "text-white/40")}
                                >
                                    Classical
                                </button>
                                <button
                                    onClick={() => setMode("quantum")}
                                    data-selected={mode === "quantum"}
                                    className={cn("portfolio-segment flex-1 py-3 rounded-xl transition-all", mode === "quantum" ? "bg-indigo-primary text-white glow-indigo" : "text-white/40")}
                                >
                                    Quantum
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="portfolio-label text-sm text-white/40">Risk Tolerance — {risk.toFixed(1)}</label>
                            <div className="portfolio-control-panel rounded-2xl border border-white/[0.06] px-4 py-6">
                                <input
                                    type="range" min="0.1" max="3" step="0.1" value={risk}
                                    onChange={(e) => setRisk(parseFloat(e.target.value))}
                                    style={{ "--risk-progress": riskProgress } as CSSProperties}
                                    className="portfolio-range w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-primary"
                                />
                                <div className="portfolio-label flex justify-between mt-2 text-xs text-white/40">
                                    <span>Conservative</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-negative">{error}</p>}

                    <Button
                        onClick={optimize}
                        disabled={loading}
                        className="on-accent accent-gradient-surface h-auto w-full rounded-2xl py-5 text-lg font-bold shadow-[var(--shadow-primary-wide)] transition-transform hover:scale-[1.01] hover:shadow-[var(--shadow-primary-wide-hover)] disabled:opacity-40"
                    >
                        {loading ? "Optimizing…" : "Optimize Portfolio"}
                    </Button>
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
                                    <div className="w-64 h-64 min-w-0 min-h-64">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
