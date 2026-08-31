"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { motion } from "motion/react";

import { api } from "@/lib/api";
import { normalizeTicker, searchMarketSymbols } from "@/lib/market-data";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SymbolMatch {
  ticker: string;
  name: string;
  exchange: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
}

function uniqueSymbolMatches(matches: SymbolMatch[]): SymbolMatch[] {
    const seen = new Set<string>();
    const unique: SymbolMatch[] = [];
    for (const match of matches) {
        const key = normalizeTicker(match.ticker);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(match);
    }
    return unique;
}

export default function TickerSuggestionInput({
    value,
    onValueChange,
    onSelect,
    existingTickers = [],
    placeholder = "Add ticker...",
    className,
    inputClassName,
    inputRef,
}: {
    value: string;
    onValueChange: (value: string) => void;
    onSelect: (ticker: string) => void;
    existingTickers?: string[];
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    inputRef?: RefObject<HTMLInputElement | null>;
}) {
    const localRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const ref = inputRef ?? localRef;

    const [open, setOpen] = useState(false);
    const [apiMatches, setApiMatches] = useState<SymbolMatch[]>([]);
    const [searching, setSearching] = useState(false);
    const [dropdownRect, setDropdownRect] = useState<DropdownRect | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const normalized = normalizeTicker(value);
    const existing = useMemo(() => new Set(existingTickers.map(normalizeTicker)), [existingTickers]);

    const localMatches = useMemo<SymbolMatch[]>(
        () =>
            uniqueSymbolMatches(
                searchMarketSymbols(value)
                    .filter((m) => !existing.has(m.ticker))
                    .map((m) => ({ ticker: m.ticker, name: m.name, exchange: m.exchange }))
            ),
        [existing, value]
    );

    useEffect(() => {
        const q = value.trim();
        if (!q) {
            setApiMatches([]);
            setSearching(false);
            return;
        }

        let cancelled = false;
        setSearching(true);

        const timer = window.setTimeout(() => {
            api.marketSearch(q, 12)
                .then((results) => {
                    if (cancelled) return;
                    setApiMatches(
                        uniqueSymbolMatches(results
                            .filter((r) => !existing.has(normalizeTicker(r.ticker)))
                            .map((r) => ({
                                ticker: r.ticker,
                                name: r.name,
                                exchange: r.exchange ?? "Market",
                            })))
                    );
                })
                .catch(() => { if (!cancelled) setApiMatches([]); })
                .finally(() => { if (!cancelled) setSearching(false); });
        }, 150);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [value, existing]);

    const updateRect = () => {
        if (!wrapperRef.current) return;
        const r = wrapperRef.current.getBoundingClientRect();
        setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };

    useEffect(() => {
        if (!open) { setDropdownRect(null); return; }
        updateRect();
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);
        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                wrapperRef.current?.contains(target) ||
                dropdownRef.current?.contains(target)
            ) {
                return;
            }
            if (wrapperRef.current) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const matches: SymbolMatch[] = searching
        ? localMatches
        : apiMatches.length > 0 ? apiMatches : localMatches;

    const canAddCustom =
        normalized.length > 0 &&
        !existing.has(normalized) &&
        !matches.some((m) => m.ticker === normalized);

    const selectTicker = (ticker: string) => {
        const next = normalizeTicker(ticker);
        if (!next || existing.has(next)) return;
        onSelect(next);
        onValueChange("");
        setOpen(false);
        setApiMatches([]);
    };

    const showDropdown = open && normalized && (matches.length > 0 || canAddCustom);

    const dropdown = showDropdown && dropdownRect && mounted
        ? createPortal(
            <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    position: "fixed",
                    top: dropdownRect.top,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                    maxWidth: "calc(100vw - 1rem)",
                    zIndex: 9999,
                }}
                onMouseDown={(e) => e.preventDefault()}
            >
                <div className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-panel)] py-2 shadow-[var(--shadow-popover)]">
                    <div className="flex max-h-72 min-w-0 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2 py-0 [scrollbar-color:var(--text-subtle)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
                        {matches.map((match, index) => (
                            <motion.div
                                key={`${match.ticker}-${match.exchange}-${index}`}
                                initial={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.18), ease: [0.16, 1, 0.3, 1] }}
                                className="group flex min-w-0 w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--surface-selected)] hover:shadow-[var(--shadow-row-hover)]"
                            >
                                <button
                                    type="button"
                                    onClick={() => selectTicker(match.ticker)}
                                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-primary/16 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/24 transition-colors group-hover:bg-indigo-primary/24 group-hover:text-[var(--text-primary)]"
                                    aria-label={`Choose ${match.ticker}`}
                                >
                                    {match.ticker.slice(0, 2)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectTicker(match.ticker)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span className="min-w-0 truncate rounded-md px-1 py-0.5 text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:bg-indigo-primary/18 group-hover:text-indigo-primary">
                                            {match.ticker}
                                        </span>
                                        <Badge variant="outline" className="market-exchange-badge max-w-[7rem] shrink-0 truncate h-5 rounded-md text-[10px]">{match.exchange}</Badge>
                                    </span>
                                    <span className="block truncate text-xs text-[var(--text-muted)]">{match.name}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectTicker(match.ticker)}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)]"
                                    aria-label={`Add ${match.ticker}`}
                                >
                                    <Plus className="size-4" />
                                </button>
                            </motion.div>
                        ))}

                        {canAddCustom && (
                            <motion.button
                                type="button"
                                initial={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                                onClick={() => selectTicker(value)}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--surface-selected)]"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-secondary/14 text-cyan-secondary ring-1 ring-cyan-secondary/24">
                                    <Plus className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-[var(--text-primary)]">Add {normalized}</span>
                                    <span className="block text-xs text-[var(--text-muted)]">Use as custom ticker</span>
                                </span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </motion.div>,
            document.body
        )
        : null;

    return (
        <div ref={wrapperRef} className={cn("relative min-w-[11rem] flex-1", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--text-placeholder)]" />
            <Input
                ref={ref}
                aria-label={placeholder}
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => { setOpen(true); updateRect(); }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        selectTicker(matches[0]?.ticker ?? value);
                    }
                    if (event.key === "Escape") setOpen(false);
                }}
                placeholder={placeholder}
                className={cn("h-10 rounded-xl pl-9 pr-9 text-sm", inputClassName)}
            />
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                {searching ? (
                    <Loader2 className="size-4 animate-spin text-white/25" />
                ) : value ? (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            onValueChange("");
                            setApiMatches([]);
                            setOpen(false);
                            ref.current?.focus();
                        }}
                        className="group flex size-7 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                        aria-label="Clear ticker search"
                    >
                        <img
                            src="/close-svgrepo-com.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-4 opacity-55 transition-opacity duration-200 group-hover:opacity-100"
                        />
                    </button>
                ) : null}
            </div>

            {dropdown}
        </div>
    );
}
