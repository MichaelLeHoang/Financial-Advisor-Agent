"use client";

import type { CSSProperties } from "react";
import { X, CheckCircle2 } from "lucide-react";
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
        surface: "rgba(255, 255, 255, 0.05)",
        hover: "rgba(99, 102, 241, 0.12)",
        selected: "rgba(99, 102, 241, 0.18)",
        border: "rgba(99, 102, 241, 0.56)",
        ring: "rgba(99, 102, 241, 0.32)",
        shadow: "0 0 0 1px rgba(99, 102, 241, 0.2), 0 12px 30px rgba(99, 102, 241, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
    },
    {
        name: "White",
        primary: "#f5f6fa",
        secondary: "#3340d1",
        label: "Light",
        surface: "rgba(255, 255, 255, 0.72)",
        hover: "rgba(38, 50, 184, 0.1)",
        selected: "rgba(38, 50, 184, 0.14)",
        border: "rgba(38, 50, 184, 0.44)",
        ring: "rgba(38, 50, 184, 0.24)",
        shadow: "0 0 0 1px rgba(38, 50, 184, 0.12), 0 12px 30px rgba(31, 42, 68, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
    },
    {
        name: "Crimson",
        primary: "#ef4444",
        secondary: "#f97316",
        label: "Red",
        surface: "rgba(255, 230, 232, 0.055)",
        hover: "rgba(239, 68, 68, 0.12)",
        selected: "rgba(239, 68, 68, 0.18)",
        border: "rgba(239, 68, 68, 0.56)",
        ring: "rgba(239, 68, 68, 0.32)",
        shadow: "0 0 0 1px rgba(239, 68, 68, 0.18), 0 12px 30px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 230, 232, 0.1)",
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
                className="relative z-10 w-full max-w-2xl overflow-hidden"
            >
                <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-settings)] py-0 text-white shadow-[var(--shadow-settings)]">

                <CardHeader className="flex flex-row items-center justify-between px-8 pt-8">
                    <CardTitle className="text-3xl font-bold">Settings</CardTitle>
                    <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full text-white/40 hover:bg-white/5 hover:text-white">
                        <X className="w-5 h-5" />
                    </Button>
                </CardHeader>

                <CardContent className="space-y-8 px-8 pb-8">
                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
                    {/* AI Model */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">AI Intelligence</label>
                        <div className="grid grid-cols-2 gap-4">
                            {["Gemini 3 Flash", "Gemini 3.1 Pro"].map((m) => (
                                <Button
                                    key={m}
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSettings({ ...settings, model: m })}
                                    className={cn(
                                        "h-auto flex-col items-start justify-start rounded-2xl border p-4 text-left",
                                        settings.model === m
                                            ? "bg-indigo-primary/20 border-indigo-primary text-white"
                                            : "bg-white/5 border-white/[0.06] text-white/40 hover:border-white/[0.12]"
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
                        <div className="flex gap-4">
                            {THEMES.map((t) => (
                                <Button
                                    key={t.name}
                                    type="button"
                                    variant="outline"
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
                                        "h-auto flex-1 rounded-2xl border p-4 transition-all duration-200 flex flex-col items-center gap-2 bg-[var(--theme-option-surface)] text-white/62 shadow-none hover:-translate-y-0.5 hover:border-[var(--theme-option-border)] hover:bg-[var(--theme-option-hover)] hover:text-white hover:shadow-[var(--theme-option-shadow)] focus-visible:border-[var(--theme-option-border)] focus-visible:ring-2 focus-visible:ring-[var(--theme-option-ring)]",
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
                                    onClick={() => setSettings({ ...settings, quantum: q })}
                                    className={cn(
                                        "h-auto w-full rounded-2xl border p-4 transition-all flex justify-between items-center",
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

                <div className="mt-10 flex gap-4">
                    <Button
                        onClick={onClose}
                        className="h-12 flex-1 rounded-2xl bg-indigo-primary font-bold text-white glow-indigo hover:bg-indigo-primary/90"
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
