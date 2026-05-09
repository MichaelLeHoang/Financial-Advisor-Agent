"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Cpu, Zap } from "lucide-react";

export default function ModelSelector() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--surface-control-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <Zap className="size-4 text-indigo-primary" />
                QuanAd 1.0
                <ChevronDown className="size-4 text-[var(--text-subtle)]" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-12 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]"
                    >
                        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">Models</div>
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-xl bg-[var(--surface-selected)] px-3 py-3 text-left text-[var(--text-primary)] shadow-[var(--shadow-control)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary-action-hover)]"
                        >
                            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
                                <Cpu className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-[var(--text-primary)]">QuanAd 1.0</div>
                                <div className="text-xs text-[var(--text-muted)]">Balanced advisor for market, portfolio, and sentiment work.</div>
                            </div>
                            <Check className="size-4 text-green-positive" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
