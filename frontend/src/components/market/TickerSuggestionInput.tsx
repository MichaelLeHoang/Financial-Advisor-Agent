"use client";

import { type RefObject, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { normalizeTicker, searchMarketSymbols } from "@/lib/market-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    const normalized = normalizeTicker(value);
    const existing = useMemo(() => new Set(existingTickers.map(normalizeTicker)), [existingTickers]);
    const matches = useMemo(
        () => searchMarketSymbols(value).filter((match) => !existing.has(match.ticker)),
        [existing, value]
    );
    const canAddCustom = normalized.length > 0
        && !existing.has(normalized)
        && !matches.some((match) => match.ticker === normalized);

    const selectTicker = (ticker: string) => {
        const next = normalizeTicker(ticker);
        if (!next || existing.has(next)) return;
        onSelect(next);
        onValueChange("");
        setOpen(false);
    };

    return (
        <div className={cn("relative min-w-[11rem] flex-1", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/32" />
            <Input
                ref={ref}
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value.toUpperCase());
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
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onValueChange("");
                        setOpen(false);
                        ref.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-white/32 transition-colors hover:bg-white/[0.06] hover:text-white"
                    aria-label="Clear ticker search"
                >
                    <X className="size-4" />
                </button>
            )}

            {open && normalized && (matches.length > 0 || canAddCustom) && (
                <Card className="absolute left-0 right-0 top-12 z-40 rounded-2xl border-white/[0.06] bg-[#090a0f] py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_22px_64px_rgba(0,0,0,0.58),0_0_44px_rgba(99,102,241,0.1)]">
                    <CardContent className="flex max-h-72 flex-col gap-1 overflow-y-auto px-2 py-0">
                        {matches.map((match) => (
                            <button
                                key={match.ticker}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectTicker(match.ticker)}
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_34px_rgba(99,102,241,0.12)]"
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
                                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.11] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_34px_rgba(34,211,238,0.12)]"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-secondary/14 text-cyan-secondary ring-1 ring-cyan-secondary/24">
                                    <Plus className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-white">Add {normalized}</span>
                                    <span className="block text-xs text-white/42">Create a custom ticker</span>
                                </span>
                            </button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
