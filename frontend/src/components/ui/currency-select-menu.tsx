"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

export type CurrencySelectOption = {
  code: string;
  name: string;
};

export default function CurrencySelectMenu({
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
  align = "end",
}: {
  ariaLabel: string;
  value: string;
  options: CurrencySelectOption[];
  onValueChange: (value: string) => void;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedValue = value.trim().toUpperCase();
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.code.toLowerCase().includes(normalizedQuery)
      || option.name.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          APP_RADIUS.control,
          "inline-flex h-10 min-w-28 items-center justify-between gap-3 border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm font-semibold text-[var(--text-primary)] outline-none transition-[border-color,background-color] duration-150 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-control-hover)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none",
          className,
        )}
      >
        <span>{normalizedValue}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align={align}
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-3xl !border-[var(--theme-border-strong)] !bg-[var(--surface-popover)] p-2"
      >
        <label className={cn(APP_RADIUS.control, "flex h-11 items-center gap-2 border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-[var(--text-muted)] focus-within:border-[var(--theme-border-strong)] focus-within:ring-2 focus-within:ring-indigo-primary/40")}>
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Search currency</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search currency"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]"
          />
        </label>
        <div className="mt-2 max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--theme-border-strong)] [&::-webkit-scrollbar-track]:bg-transparent">
          {visibleOptions.length ? visibleOptions.map((option) => {
            const selected = option.code === normalizedValue;
            return (
              <DropdownMenuItem
                key={option.code}
                onClick={() => onValueChange(option.code)}
                className={cn(
                  "h-12 justify-between gap-3 rounded-xl px-3",
                  selected && "bg-[var(--surface-selected)] text-[var(--text-primary)]",
                )}
              >
                <span className="font-semibold text-[var(--text-primary)]">{option.code}</span>
                <span className="min-w-0 flex-1 truncate text-right text-sm text-[var(--text-muted)]">{option.name}</span>
                {selected ? <Check aria-hidden="true" className="size-5 shrink-0 text-emerald-400" /> : <span className="size-5 shrink-0" />}
              </DropdownMenuItem>
            );
          }) : (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">No matching currency.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
