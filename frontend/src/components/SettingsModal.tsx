"use client";

import { X, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: { model: string; theme: string; risk: string; quantum: string };
    setSettings: (s: any) => void;
}

export default function SettingsModal({ isOpen, onClose, settings, setSettings }: SettingsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-space-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative z-10 w-full max-w-2xl overflow-hidden"
            >
              <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.055] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.5),0_0_70px_rgba(99,102,241,0.12)] backdrop-blur-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-primary to-cyan-secondary" />

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
                            {[
                                { name: "Deep Space", primary: "#6366f1", secondary: "#22d3ee" },
                                { name: "Emerald", primary: "#10b981", secondary: "#34d399" },
                                { name: "Crimson", primary: "#ef4444", secondary: "#f87171" },
                            ].map((t) => (
                                <Button
                                    key={t.name}
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSettings({ ...settings, theme: t.name })}
                                    className={cn(
                                        "h-auto flex-1 rounded-2xl border p-4 transition-all flex flex-col items-center gap-2",
                                        settings.theme === t.name
                                            ? "bg-white/10 border-white/30"
                                            : "bg-white/5 border-white/[0.06] opacity-60 hover:opacity-100"
                                    )}
                                >
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.secondary }} />
                                    </div>
                                    <span className="text-xs font-bold">{t.name}</span>
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
