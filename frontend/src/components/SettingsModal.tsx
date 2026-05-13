"use client";

import type { CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: { model: string; theme: string; risk: string; quantum: string };
    setSettings: (s: { model: string; theme: string; risk: string; quantum: string }) => void;
}

const THEMES = [
    {
        name: "Deep Space",
        primary: "#6366f1",
        secondary: "#22d3ee",
        label: "Dark",
        surface: "var(--surface-card)",
        hover: "rgba(99, 102, 241, 0.12)",
        selected: "rgba(99, 102, 241, 0.18)",
        border: "rgba(99, 102, 241, 0.56)",
        ring: "rgba(99, 102, 241, 0.32)",
        shadow: "0 0 0 1px rgba(99, 102, 241, 0.2), 0 12px 30px rgba(99, 102, 241, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
    },
    {
        name: "White",
        primary: "#fbfcff",
        secondary: "#7c3aed",
        label: "Light",
        surface: "var(--surface-card)",
        hover: "rgba(255, 255, 255, 0.18)",
        selected: "rgba(124, 58, 237, 0.13)",
        border: "rgba(255, 255, 255, 0.74)",
        ring: "rgba(124, 58, 237, 0.3)",
        shadow: "0 0 0 1px rgba(255, 255, 255, 0.78), 0 12px 30px rgba(255, 255, 255, 0.38), 0 10px 28px rgba(124, 58, 237, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.96)",
    },
    {
        name: "Crimson",
        primary: "#ef4444",
        secondary: "#f97316",
        label: "Red",
        surface: "var(--surface-card)",
        hover: "rgba(239, 68, 68, 0.13)",
        selected: "rgba(239, 68, 68, 0.2)",
        border: "rgba(239, 68, 68, 0.56)",
        ring: "rgba(239, 68, 68, 0.32)",
        shadow: "0 0 0 1px rgba(239, 68, 68, 0.2), 0 12px 30px rgba(239, 68, 68, 0.22), inset 0 1px 0 rgba(255, 230, 232, 0.11)",
    },
];

export default function SettingsModal({ isOpen, onClose, settings, setSettings }: SettingsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-[var(--surface-settings-backdrop)] backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
            >
                <Card className="flex max-h-full w-full flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-settings)] py-0 text-white shadow-[var(--shadow-settings)]">
                    <CardHeader className="flex shrink-0 flex-row items-center justify-between px-5 pt-5 sm:px-8 sm:pt-8">
                        <CardTitle className="text-2xl font-bold sm:text-3xl">Settings</CardTitle>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close settings"
                            className="group inline-flex size-9 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                        >
                            <img src="/close-svgrepo-com.svg" alt="" aria-hidden="true" className="size-5 opacity-70 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                        </button>
                    </CardHeader>

                    <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-8 sm:pb-8">
                        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-1 sm:space-y-8 sm:pr-2">
                    {/* AI Model */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">AI Intelligence</label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                            {["Gemini 3 Flash", "Gemini 3.1 Pro"].map((m) => (
                                <Button
                                    key={m}
                                    type="button"
                                    variant="outline"
                                    data-selected={settings.model === m}
                                    onClick={() => setSettings({ ...settings, model: m })}
                                    className={cn(
                                        "theme-section-button h-auto flex-col items-start justify-start rounded-2xl border p-4 text-left hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary-action-hover)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                        settings.model === m
                                            ? "border-indigo-primary bg-indigo-primary/20 text-white shadow-[var(--shadow-primary-action)]"
                                            : "border-white/[0.06] bg-white/5 text-white/40 hover:border-indigo-primary/50 hover:bg-indigo-primary/10 hover:text-white"
                                    )}
                                >
                                    <div className="font-bold">{m}</div>
                                    <div className="text-xs opacity-60">{m.includes("Pro") ? "High reasoning" : "Fast & efficient"}</div>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Theme */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Visual Theme</label>
                        <div className="grid grid-cols-3 gap-3 sm:gap-4">
                            {THEMES.map((t) => (
                                <Button
                                    key={t.name}
                                    type="button"
                                    variant="outline"
                                    data-selected={settings.theme === t.name}
                                    onClick={() => setSettings({ ...settings, theme: t.name })}
                                    style={{
                                        "--theme-option-surface": t.surface,
                                        "--theme-option-hover": t.hover,
                                        "--theme-option-selected": t.selected,
                                        "--theme-option-border": t.border,
                                        "--theme-option-ring": t.ring,
                                        "--theme-option-shadow": t.shadow,
                                    } as CSSProperties}
                                    className={cn(
                                        "theme-section-button h-auto rounded-2xl border p-3 flex flex-col items-center gap-2 bg-[var(--theme-option-surface)] text-white/62 shadow-none hover:-translate-y-0.5 hover:border-[var(--theme-option-border)] hover:bg-[var(--theme-option-hover)] hover:text-white hover:shadow-[var(--theme-option-shadow)] focus-visible:border-[var(--theme-option-border)] focus-visible:ring-2 focus-visible:ring-[var(--theme-option-ring)] sm:p-4",
                                        settings.theme === t.name
                                            ? "border-[var(--theme-option-border)] bg-[var(--theme-option-selected)] text-white shadow-[var(--theme-option-shadow)]"
                                            : "border-white/[0.06]"
                                    )}
                                >
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.secondary }} />
                                    </div>
                                    <span className="text-xs font-bold">{t.label}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Default Risk Profile</label>
                        <select
                            value={settings.risk}
                            onChange={(e) => setSettings({ ...settings, risk: e.target.value })}
                            className="w-full glass bg-white/5 border-white/[0.06] rounded-2xl p-4 focus:outline-none focus:border-indigo-primary/50"
                        >
                            <option value="conservative" className="bg-space-black">Conservative</option>
                            <option value="moderate" className="bg-space-black">Moderate</option>
                            <option value="aggressive" className="bg-space-black">Aggressive</option>
                        </select>
                    </div>

                    {/* Quantum Backend */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Quantum Backend</label>
                        <div className="space-y-2">
                            {["IonQ Forte (11 Qubits)", "Rigetti Aspen-M-3", "IBM Eagle (127 Qubits)"].map((q) => (
                                <Button
                                    key={q}
                                    type="button"
                                    variant="outline"
                                    data-selected={settings.quantum === q}
                                    onClick={() => setSettings({ ...settings, quantum: q })}
                                    className={cn(
                                        "theme-section-button h-auto w-full rounded-2xl border p-4 flex justify-between items-center",
                                        settings.quantum === q
                                            ? "bg-cyan-secondary/20 border-cyan-secondary text-white"
                                            : "bg-white/5 border-white/[0.06] text-white/40 hover:border-white/[0.12]"
                                    )}
                                >
                                    <span className="font-bold">{q}</span>
                                    {settings.quantum === q && <CheckCircle2 className="w-5 h-5 text-cyan-secondary" />}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                        <div className="mt-5 flex shrink-0 gap-4 sm:mt-8">
                            <Button
                                onClick={onClose}
                                className="on-accent accent-gradient-surface h-12 flex-1 rounded-2xl font-bold glow-indigo hover:shadow-[var(--shadow-primary-action-hover)]"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
