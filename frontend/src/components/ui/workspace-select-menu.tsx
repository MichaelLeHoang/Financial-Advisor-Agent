"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type WorkspaceSelectOption = {
  value: string;
  label: string;
};

export default function WorkspaceSelectMenu({
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
  contentClassName,
  align = "start",
}: {
  ariaLabel: string;
  value: string;
  options: WorkspaceSelectOption[];
  onValueChange: (value: string) => void;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 min-w-0 items-center justify-between gap-3 rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-4 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-control)] hover:bg-[var(--surface-card-hover)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
          className,
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? value}</span>
        <ChevronDown
          data-testid={`${ariaLabel.toLowerCase().replaceAll(" ", "-")}-chevron`}
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
        className={cn(
          "w-[var(--anchor-width)] min-w-48 rounded-3xl !border-[var(--theme-border-strong)] !bg-[var(--surface-popover)] p-2",
          contentClassName,
        )}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "h-11 justify-between rounded-2xl px-3 text-base text-[var(--text-primary)] transition-colors duration-150 motion-reduce:transition-none",
              option.value === value && "bg-[var(--surface-selected)]",
            )}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            {option.value === value && <Check aria-hidden="true" className="size-5 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
