"use client";

import { useEffect, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_APPEARANCE_OPTIONS, type AppAppearancePreference } from "@/lib/app-theme";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: { model: string; theme: string; appearance: AppAppearancePreference; risk: string; quantum: string };
    setSettings: (s: { model: string; theme: string; appearance: AppAppearancePreference; risk: string; quantum: string }) => void;
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
    {
        name: "System",
        primary: "#a3a3a3",
        secondary: "#fafafa",
        label: "System",
        surface: "var(--surface-card)",
        hover: "var(--surface-card-hover)",
        selected: "var(--surface-selected)",
        border: "var(--theme-border-strong)",
        ring: "rgba(99, 102, 241, 0.32)",
        shadow: "var(--shadow-control)",
    },
];

const APPEARANCE_DESCRIPTIONS: Record<AppAppearancePreference, string> = {
    Solid: "Crisp opaque surfaces",
    Glass: "Translucent, softly blurred panels",
};

export default function SettingsModal({ isOpen, onClose, settings, setSettings }: SettingsModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
            >
                <Card className="flex max-h-full w-full flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-settings)] py-0 text-white shadow-[var(--shadow-settings)]">
                    <CardHeader className="flex shrink-0 flex-row items-center justify-between px-5 pt-5 sm:px-8 sm:pt-8">
                        <CardTitle id="settings-title" className="text-2xl font-bold sm:text-3xl">Settings</CardTitle>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close settings"
                            className="group inline-flex size-9 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                        >
                            <img src="/close-svgrepo-com.svg" alt="" aria-hidden="true" className="size-5 opacity-70 transition-opacity duration-200 group-hover:opacity-100" />
                        </button>
                    </CardHeader>

                    <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-8 sm:pb-8">
                        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-1 sm:space-y-8 sm:pr-2">
                    {/* Theme */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">Visual Theme</h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                            {THEMES.map((t) => (
                                <Button
                                    key={t.name}
                                    type="button"
                                    variant="outline"
                                    data-selected={settings.theme === t.name}
                                    aria-pressed={settings.theme === t.name}
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

                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">Surface Style</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {APP_APPEARANCE_OPTIONS.map((appearance) => {
                                const selected = settings.appearance === appearance.name;
                                return (
                                    <Button
                                        key={appearance.name}
                                        type="button"
                                        variant="outline"
                                        data-selected={selected}
                                        aria-pressed={selected}
                                        onClick={() => setSettings({ ...settings, appearance: appearance.name })}
                                        className={cn(
                                            "theme-section-button h-auto justify-start rounded-2xl border px-4 py-3 text-left",
                                            selected
                                                ? "border-indigo-primary/55 bg-indigo-primary/14 text-[var(--text-primary)] shadow-[var(--shadow-control)]"
                                                : "border-[var(--theme-border)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)]",
                                        )}
                                    >
                                        <span aria-hidden="true" className={cn(
                                            "mr-3 block size-10 shrink-0 rounded-xl border",
                                            appearance.name === "Glass"
                                                ? "border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md"
                                                : "border-[var(--theme-border-strong)] bg-[var(--surface-panel)]",
                                        )} />
                                        <span>
                                            <span className="block text-sm font-bold">{appearance.label}</span>
                                            <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">{APPEARANCE_DESCRIPTIONS[appearance.name]}</span>
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                </div>

                        <div className="mt-5 flex shrink-0 gap-4 sm:mt-8">
                            <Button
                                onClick={onClose}
                                className="on-accent theme-accent-surface h-12 flex-1 rounded-2xl font-bold"
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
