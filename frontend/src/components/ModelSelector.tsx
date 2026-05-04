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
                className="flex h-10 items-center gap-2 rounded-full border border-white/[0.06] bg-[#0a0a0c] px-4 text-sm font-semibold text-white/86 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_10px_28px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-[#101016] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <Zap className="size-4 text-indigo-primary" />
                QuanAd 1.0
                <ChevronDown className="size-4 text-white/45" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-12 z-30 w-72 rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.58),0_0_52px_rgba(99,102,241,0.12)]"
                    >
                        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">Models</div>
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-3 text-left"
                        >
                            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
                                <Cpu className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">QuanAd 1.0</div>
                                <div className="text-xs text-white/38">Balanced advisor for market, portfolio, and sentiment work.</div>
                            </div>
                            <Check className="size-4 text-green-positive" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
