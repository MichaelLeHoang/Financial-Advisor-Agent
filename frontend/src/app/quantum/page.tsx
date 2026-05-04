"use client";

import { useState } from "react";
import { Atom, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { OptimizeResult } from "@/lib/api";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

    const add = (value = input) => {
        const t = value.trim().toUpperCase();
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
                    <Badge variant="outline" className="h-9 rounded-xl border-cyan-secondary/30 bg-cyan-secondary/10 px-4 text-cyan-secondary">
                        Quantum Processor: PennyLane Simulator
                    </Badge>
                </div>
                {(isLocked || upgradeMessage) && (
                    <UpgradePrompt
                        message={upgradeMessage ?? "Quantum optimization is available on the Quant plan."}
                    />
                )}

                {/* Quantum Circuit Visualization */}
                <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                  <CardContent className="overflow-x-auto p-10">
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
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Parameters */}
                    <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                      <CardHeader className="px-8 pt-8">
                        <CardTitle className="text-xl font-bold">Parameters</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 p-8 pt-0">
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
                                <Badge key={t} variant="outline" className="h-7 rounded-lg border-white/[0.06] bg-white/[0.045] text-white">
                                    {t}
                                    <button onClick={() => setTickers((p) => p.filter((x) => x !== t))}>
                                        <X className="w-3 h-3 text-white/40" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <TickerSuggestionInput
                                className="flex-1"
                                inputClassName="h-10 rounded-xl border-white/[0.06] bg-white/[0.045] text-sm text-white placeholder:text-white/24"
                                placeholder="Add ticker…"
                                value={input}
                                onValueChange={setInput}
                                onSelect={add}
                                existingTickers={tickers}
                            />
                            <Button onClick={() => add()} variant="outline" size="icon" className="h-10 w-10 rounded-xl border-white/[0.06] bg-white/[0.045] text-cyan-secondary hover:bg-white/[0.08] hover:text-cyan-secondary">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            onClick={run}
                            disabled={loading || tickers.length < 2}
                            className="h-12 w-full rounded-2xl bg-gradient-to-r from-indigo-primary to-cyan-secondary font-bold text-white glow-indigo disabled:opacity-40"
                        >
                            {loading ? "Running QAOA…" : "Run Quantum Optimization"}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Results */}
                    <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                      <CardHeader className="px-8 pt-8">
                        <CardTitle className="text-xl font-bold">Top 5 Quantum States</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6 p-8 pt-0">
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
                                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
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
                      </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
