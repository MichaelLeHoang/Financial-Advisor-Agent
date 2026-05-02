"use client";

import { useState } from "react";
import { Atom, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { OptimizeResult } from "@/lib/api";
import FinanceDisclaimer from "@/components/common/FinanceDisclaimer";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { useAuth } from "@/components/auth/AuthProvider";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171"];

export default function QuantumPage() {
    const { user } = useAuth();
    const [input, setInput] = useState("");
    const [tickers, setTickers] = useState(["AAPL", "NVDA", "GOOGL", "TSLA", "AMZN"]);
    const [targetAssets, setTargetAssets] = useState(3);
    const [result, setResult] = useState<OptimizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
    const isLocked = !["quant", "execution_addon"].includes(user.plan);

    const add = () => {
        const t = input.trim().toUpperCase();
        if (t && !tickers.includes(t)) setTickers((p) => [...p, t]);
        setInput("");
    };

    const run = async () => {
        if (isLocked) {
            setUpgradeMessage("Quantum optimization is available on the Quant plan.");
            return;
        }
        setLoading(true);
        setUpgradeMessage(null);
        try {
            setResult(await api.optimize(tickers, "quantum", 1.0, targetAssets));
        } catch (error) {
            if (isUpgradeRequiredError(error)) setUpgradeMessage(error.detail.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Quantum QAOA</h1>
                        <p className="text-white/40">Quantum Approximate Optimization Algorithm for discrete asset selection.</p>
                    </div>
                    <div className="glass px-4 py-2 rounded-xl text-xs text-cyan-secondary border-cyan-secondary/30">
                        Quantum Processor: PennyLane Simulator
                    </div>
                </div>
                <FinanceDisclaimer />
                {(isLocked || upgradeMessage) && (
                    <UpgradePrompt
                        message={upgradeMessage ?? "Quantum optimization is available on the Quant plan."}
                    />
                )}

                {/* Quantum Circuit Visualization */}
                <div className="glass p-10 rounded-[40px] overflow-x-auto">
                    <div className="min-w-[800px] space-y-8">
                        {tickers.map((t) => (
                            <div key={t} className="flex items-center gap-6">
                                <div className="w-16 font-mono text-sm text-white/40">{t}</div>
                                <div className="flex-1 h-[2px] bg-white/10 relative flex items-center gap-12 px-12">
                                    <div className="w-10 h-10 rounded bg-indigo-primary flex items-center justify-center text-xs font-bold glow-indigo">H</div>
                                    <div className="w-10 h-10 rounded bg-cyan-secondary flex items-center justify-center text-xs font-bold glow-cyan">Rz</div>
                                    <div className="w-10 h-10 rounded bg-indigo-primary flex items-center justify-center text-xs font-bold glow-indigo">H</div>
                                    <div className="ml-auto w-8 h-8 rounded-full border-2 border-amber-warning flex items-center justify-center">
                                        <div className="w-1 h-4 bg-amber-warning rotate-45" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Parameters */}
                    <div className="glass p-8 rounded-[32px] space-y-6">
                        <h3 className="text-xl font-bold">Parameters</h3>
                        <div className="space-y-4">
                            <label className="text-sm text-white/40">
                                Select {targetAssets} of {tickers.length} stocks
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={Math.max(1, tickers.length - 1)}
                                value={targetAssets}
                                onChange={(e) => setTargetAssets(parseInt(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-secondary"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tickers.map((t) => (
                                <div key={t} className="px-3 py-1 glass rounded-lg text-xs font-bold flex items-center gap-1.5">
                                    {t}
                                    <button onClick={() => setTickers((p) => p.filter((x) => x !== t))}>
                                        <X className="w-3 h-3 text-white/40" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 glass rounded-xl px-3 py-2 text-sm outline-none"
                                placeholder="Add ticker…"
                                value={input}
                                onChange={(e) => setInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === "Enter" && add()}
                            />
                            <button onClick={add} className="glass px-3 rounded-xl" style={{ color: "#22d3ee" }}>
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={run}
                            disabled={loading || tickers.length < 2}
                            className="w-full bg-gradient-to-r from-indigo-primary to-cyan-secondary py-4 rounded-2xl font-bold glow-indigo disabled:opacity-40"
                        >
                            {loading ? "Running QAOA…" : "Run Quantum Optimization"}
                        </button>
                    </div>

                    {/* Results */}
                    <div className="glass p-8 rounded-[32px] space-y-6">
                        <h3 className="text-xl font-bold">Top 5 Quantum States</h3>
                        {result?.top_states ? (
                            <>
                                <div className="space-y-4">
                                    {result.top_states.map((s, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-mono">|{s.bitstring}⟩</span>
                                                <span className="text-white/40">{(s.probability * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${s.probability * 100}%` }}
                                                    className="h-full rounded-full"
                                                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {result.selected_stocks && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <p className="text-sm text-white/40 mb-2">Selected Portfolio</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {result.selected_stocks.map((t) => (
                                                <span key={t} className="px-3 py-1 rounded-full text-sm font-bold bg-cyan-secondary text-space-black">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-white/20 text-sm text-center py-12">
                                Run the quantum optimizer to see results
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
