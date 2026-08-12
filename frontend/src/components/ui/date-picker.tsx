"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  buildCalendarMonth,
  clampCalendarDate,
  formatDateValue,
  isSameCalendarDay,
  moveCalendarDate,
  parseDateValue,
  shiftCalendarMonth,
  startOfCalendarMonth,
} from "@/lib/date-picker";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const displayDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const displayMonth = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export interface DatePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function DatePicker({
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
  min,
  max,
  placeholder = "Choose date",
  disabled = false,
  allowClear = false,
}: DatePickerProps) {
  const selectedDate = parseDateValue(value);
  const minDate = min ? parseDateValue(min) : null;
  const maxDate = max ? parseDateValue(max) : null;
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  }, []);
  const initialDate = clampCalendarDate(selectedDate ?? today, minDate, maxDate);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfCalendarMonth(initialDate));
  const [activeDate, setActiveDate] = useState(initialDate);
  const gridRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => buildCalendarMonth(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!open) return;
    const next = clampCalendarDate(selectedDate ?? today, minDate, maxDate);
    setActiveDate(next);
    setViewMonth(startOfCalendarMonth(next));
  }, [open]); // Reset the working month only when a new picker session starts.

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-date="${formatDateValue(activeDate)}"]`)
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDate, open, viewMonth]);

  const dateIsDisabled = (date: Date) => Boolean((minDate && date < minDate) || (maxDate && date > maxDate));

  const selectDate = (date: Date) => {
    if (dateIsDisabled(date)) return;
    onValueChange(formatDateValue(date));
    setOpen(false);
  };

  const moveActiveDate = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = moveCalendarDate(activeDate, event.key);
    if (!next) return;
    event.preventDefault();
    const clamped = clampCalendarDate(next, minDate, maxDate);
    setActiveDate(clamped);
    setViewMonth(startOfCalendarMonth(clamped));
  };

  const changeMonth = (amount: number) => {
    const next = clampCalendarDate(shiftCalendarMonth(activeDate, amount), minDate, maxDate);
    setActiveDate(next);
    setViewMonth(startOfCalendarMonth(next));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <Popover.Trigger
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-left text-sm text-[var(--text-primary)] shadow-[var(--shadow-control)] outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-[var(--surface-control-hover)] focus-visible:border-indigo-primary/55 focus-visible:ring-2 focus-visible:ring-indigo-primary/25 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
            allowClear && selectedDate && "pr-10",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate", !selectedDate && "text-[var(--text-placeholder)]")}>
            {selectedDate ? displayDate.format(selectedDate) : placeholder}
          </span>
        </Popover.Trigger>
        {allowClear && selectedDate ? (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/35"
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="z-[280]">
          <Popover.Popup
            data-slot="date-picker-popup"
            aria-label={`${ariaLabel} calendar`}
            initialFocus={false}
            className="w-[min(21rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-[1.4rem] border border-[var(--theme-border-strong)] bg-[var(--surface-popover)] p-4 text-[var(--text-primary)] opacity-100 shadow-[var(--shadow-popover)] outline-none transition-[opacity,scale] duration-150 ease-out data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">Select date</p>
                <h2 className="mt-1 font-heading text-xl font-semibold">{displayMonth.format(viewMonth)}</h2>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => changeMonth(-1)}
                  className="flex size-9 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/35"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => changeMonth(1)}
                  className="flex size-9 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] text-[var(--text-secondary)] hover:bg-[var(--surface-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/35"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{weekday.slice(0, 1)}</span>
              ))}
            </div>

            <div ref={gridRef} role="grid" aria-label={displayMonth.format(viewMonth)} className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const dateValue = formatDateValue(date);
                const selected = Boolean(selectedDate && isSameCalendarDay(date, selectedDate));
                const isToday = isSameCalendarDay(date, today);
                const outsideMonth = date.getMonth() !== viewMonth.getMonth();
                const inactive = dateIsDisabled(date);
                return (
                  <button
                    key={dateValue}
                    type="button"
                    role="gridcell"
                    data-date={dateValue}
                    tabIndex={isSameCalendarDay(date, activeDate) ? 0 : -1}
                    aria-label={displayDate.format(date)}
                    aria-selected={selected}
                    aria-current={isToday ? "date" : undefined}
                    disabled={inactive}
                    onFocus={() => setActiveDate(date)}
                    onKeyDown={moveActiveDate}
                    onClick={() => selectDate(date)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-indigo-primary/45 motion-reduce:transition-none",
                      outsideMonth ? "text-[var(--text-subtle)]" : "text-[var(--text-secondary)]",
                      !inactive && "hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]",
                      isToday && !selected && "after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-indigo-primary",
                      selected && "theme-accent-surface on-accent text-[var(--primary-foreground)] shadow-[var(--shadow-control)]",
                      inactive && "cursor-not-allowed opacity-25",
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--theme-border)] pt-3">
              <span className="text-xs text-[var(--text-muted)]">{selectedDate ? displayDate.format(selectedDate) : "No date selected"}</span>
              <button
                type="button"
                disabled={dateIsDisabled(today)}
                onClick={() => selectDate(today)}
                className="rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-control-hover)] hover:text-[var(--text-primary)] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/35"
              >
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
