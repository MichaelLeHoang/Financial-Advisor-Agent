"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { api } from "@/lib/api";
import { normalizeTicker, searchMarketSymbols } from "@/lib/market-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SymbolMatch {
  ticker: string;
  name: string;
  exchange: string;
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
    const ref = inputRef ?? localRef;
    const [open, setOpen] = useState(false);
    const [apiMatches, setApiMatches] = useState<SymbolMatch[]>([]);
    const [searching, setSearching] = useState(false);

    const normalized = normalizeTicker(value);
    const existing = useMemo(() => new Set(existingTickers.map(normalizeTicker)), [existingTickers]);

    const localMatches = useMemo<SymbolMatch[]>(
        () =>
            searchMarketSymbols(value)
                .filter((m) => !existing.has(m.ticker))
                .map((m) => ({ ticker: m.ticker, name: m.name, exchange: m.exchange })),
        [existing, value]
    );

    // Debounced live search via backend
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
                        results
                            .filter((r) => !existing.has(normalizeTicker(r.ticker)))
                            .map((r) => ({
                                ticker: r.ticker,
                                name: r.name,
                                exchange: r.exchange ?? "Market",
                            }))
                    );
                })
                .catch(() => {
                    if (cancelled) return;
                    setApiMatches([]);
                })
                .finally(() => {
                    if (!cancelled) setSearching(false);
                });
        }, 150);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [value, existing]);

    // Show local results instantly while API loads; replace with API when ready
    const matches: SymbolMatch[] = searching
        ? localMatches
        : apiMatches.length > 0
            ? apiMatches
            : localMatches;

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

    return (
        <div className={cn("relative min-w-[11rem] flex-1", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/32" />
            <Input
                ref={ref}
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
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
            {/* Right-side indicator: spinner while searching, clear button otherwise */}
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                {searching ? (
                    <Loader2 className="size-4 animate-spin text-white/25" />
                ) : value ? (
                    <button
                        type="button"
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
                            className="size-4 opacity-55 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_7px_rgba(255,255,255,0.65)]"
                        />
                    </button>
                ) : null}
            </div>

            {open && normalized && (matches.length > 0 || canAddCustom) && (
                <Card className="absolute left-0 right-0 top-12 z-40 rounded-2xl border-[var(--theme-border)] bg-[var(--surface-panel)] py-2 shadow-[var(--shadow-popover)]">
                    <CardContent className="flex max-h-72 flex-col gap-1 overflow-y-auto px-2 py-0">
                        {matches.map((match) => (
                            <button
                                key={match.ticker}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectTicker(match.ticker)}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[var(--shadow-row-hover)]"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-primary/16 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/24 transition-colors group-hover:bg-indigo-primary/24 group-hover:text-white">
                                    {match.ticker.slice(0, 2)}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white">{match.ticker}</span>
                                        <Badge variant="outline" className="h-5 rounded-md text-[10px]">{match.exchange}</Badge>
                                    </span>
                                    <span className="block truncate text-xs text-white/42">{match.name}</span>
                                </span>
                                <Plus className="size-4 text-white/38" />
                            </button>
                        ))}

                        {canAddCustom && (
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectTicker(value)}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[var(--shadow-row-hover-alt)]"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-secondary/14 text-cyan-secondary ring-1 ring-cyan-secondary/24">
                                    <Plus className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-white">Add {normalized}</span>
                                    <span className="block text-xs text-white/42">Use as custom ticker</span>
                                </span>
                            </button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
