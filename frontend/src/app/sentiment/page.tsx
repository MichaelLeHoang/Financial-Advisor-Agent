"use client";

import { useState } from "react";
import type { ChangeEvent, ComponentType } from "react";
import { ClipboardList, FileText, TableProperties, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { SentimentResult } from "@/lib/api";
import FinanceDisclaimer from "@/components/common/FinanceDisclaimer";

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

    const uploadHeadlines = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text().catch(() => "");
        const imported = text
            .split(/\r?\n|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .map((line) => line.replace(/^"|"$/g, "").trim())
            .filter(Boolean)
            .slice(0, 25);

        if (imported.length > 0) {
            setHeadlines((prev) => Array.from(new Set([...prev, ...imported])));
        }

        event.target.value = "";
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
    const angle = ((bullish + 1) / 2) * 180;

    return (
        <div className="flex-1 p-8 overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-4xl space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold">Sentiment Analysis</h1>
                    <p className="text-white/40">Powered by FinBERT — analyze market sentiment from financial headlines.</p>
                </div>
                <FinanceDisclaimer />

                {/* Input */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.34),0_0_54px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-colors focus-within:border-indigo-primary/45">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addHeadline()}
                            placeholder='Enter a financial headline...'
                            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/24"
                        />
                        <button
                            onClick={addHeadline}
                            className="rounded-xl bg-indigo-primary px-5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.55),0_8px_22px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:bg-indigo-primary/90 active:scale-[0.98]"
                        >
                            Add
                        </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-2 pt-2">
                        <UploadPill
                            icon={FileText}
                            label="Headlines TXT"
                            accept=".txt,.md"
                            onChange={uploadHeadlines}
                        />
                        <UploadPill
                            icon={TableProperties}
                            label="CSV"
                            accept=".csv,.txt"
                            onChange={uploadHeadlines}
                        />
                        <UploadPill
                            icon={ClipboardList}
                            label="Batch"
                            accept=".csv,.txt,.md"
                            onChange={uploadHeadlines}
                        />
                    </div>
                </div>

                {/* Headline chips */}
                <div className="flex flex-wrap gap-2">
                    {headlines.map((h) => (
                        <div key={h} className="glass px-4 py-2 rounded-full text-sm flex items-center gap-2">
                            {h.length > 50 ? h.slice(0, 50) + "…" : h}
                            <button onClick={() => setHeadlines((prev) => prev.filter((x) => x !== h))}>
                                <X className="w-4 h-4 text-white/40 hover:text-white" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Analyze button */}
                <button
                    onClick={analyze}
                    disabled={headlines.length === 0 || loading}
                    className="w-full rounded-2xl bg-indigo-primary py-5 text-lg font-bold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.55),0_12px_34px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:bg-indigo-primary/90 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.65),0_16px_44px_rgba(99,102,241,0.34),inset_0_1px_0_rgba(255,255,255,0.26)] active:scale-[0.99] disabled:opacity-40"
                >
                    {loading ? "Analyzing…" : `Analyze ${headlines.length} headline${headlines.length !== 1 ? "s" : ""}`}
                </button>

                {/* Results */}
                {mood && (
                    <>
                        {/* Gauge Card */}
                        <div className="flex flex-col items-center py-12 glass rounded-[40px] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-negative via-amber-warning to-green-positive" />

                            <div className="relative w-64 h-32 mb-8">
                                <svg viewBox="0 0 200 110" className="w-full h-full">
                                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
                                    <defs>
                                        <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#f87171" />
                                            <stop offset="50%" stopColor="#fbbf24" />
                                            <stop offset="100%" stopColor="#34d399" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gauge-grad)" strokeWidth="14" strokeLinecap="round" opacity="0.3" />
                                    <line
                                        x1="100" y1="100"
                                        x2={100 + 60 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
                                        y2={100 - 60 * Math.sin((angle * Math.PI) / 180)}
                                        stroke="white" strokeWidth="2.5" strokeLinecap="round"
                                    />
                                    <circle cx="100" cy="100" r="5" fill="white" />
                                    <text x="20" y="118" fontSize="10" fill="#f87171" textAnchor="middle">Bearish</text>
                                    <text x="180" y="118" fontSize="10" fill="#34d399" textAnchor="middle">Bullish</text>
                                </svg>
                            </div>

                            <div className="text-center">
                                <div
                                    className="text-5xl font-bold mb-2"
                                    style={{
                                        color: bullish > 0.1 ? "#34d399" : bullish < -0.1 ? "#f87171" : "#fbbf24",
                                    }}
                                >
                                    {mood.signal}
                                </div>
                                <div className="text-white/40 text-sm">
                                    Bullish score: {bullish > 0 ? "+" : ""}{bullish.toFixed(3)}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-12 mt-12">
                                {Object.entries(mood.breakdown).map(([label, count]) => (
                                    <div key={label} className="text-center">
                                        <div
                                            className="text-2xl font-bold"
                                            style={{
                                                color: label === "positive" ? "#34d399" : label === "negative" ? "#f87171" : "#fbbf24",
                                            }}
                                        >
                                            {count}
                                        </div>
                                        <div className="text-xs text-white/40 capitalize">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Individual results */}
                        <div className="space-y-4">
                            {result!.individual.map((item, i) => (
                                <div key={i} className="glass p-4 rounded-2xl flex justify-between items-center">
                                    <span className="text-white/80">{headlines[i]}</span>
                                    <div
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-xs font-bold uppercase shrink-0 ml-4",
                                            item.label === "positive" ? "bg-green-positive/20 text-green-positive" : item.label === "negative" ? "bg-red-negative/20 text-red-negative" : "bg-white/10 text-white/40"
                                        )}
                                    >
                                        {item.label} {(item.score * 100).toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function UploadPill({
    icon: Icon,
    label,
    accept,
    onChange,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    accept: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label className="group flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 text-xs font-medium text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.075] hover:text-white">
            <Icon className="h-4 w-4 text-white/38 group-hover:text-indigo-primary" />
            <span>{label}</span>
            <input type="file" accept={accept} className="sr-only" onChange={onChange} />
        </label>
    );
}
