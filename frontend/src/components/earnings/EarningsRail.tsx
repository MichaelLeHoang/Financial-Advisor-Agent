"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { api, type EarningsCalendarEvent, type MarketQuote } from "@/lib/api";
import { addCalendarDays, buildCalendarDays, buildEarningsEvents, buildEarningsEventsFromCalendar, toDateKey } from "@/lib/earnings-calendar";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

const markTones = [
  "bg-[var(--surface-control)] text-[var(--text-primary)]",
  "bg-[var(--surface-control-hover)] text-[var(--text-primary)]",
  "bg-[var(--surface-selected)] text-[var(--text-primary)]",
];

export function EarningsSymbolMark({ symbol, logoUrl, className }: { symbol: string; logoUrl?: string | null; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const tone = markTones[symbol.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % markTones.length];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--background)] text-[9px] font-bold", tone, className)}
    >
      {logoUrl && !imageFailed ? <img src={logoUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full rounded-full bg-white object-contain p-1" onError={() => setImageFailed(true)} /> : symbol.replace(".TO", "").slice(0, 4)}
    </span>
  );
}

export default function EarningsRail({ quotes }: { quotes: MarketQuote[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [calendarEvents, setCalendarEvents] = useState<EarningsCalendarEvent[]>([]);
  const today = useMemo(() => {
    const next = new Date();
    next.setHours(12, 0, 0, 0);
    return next;
  }, []);
  const symbols = useMemo(() => quotes.map((quote) => quote.ticker.toUpperCase()), [quotes]);
  useEffect(() => {
    if (!symbols.length) return;
    let canceled = false;
    api.earningsCalendar(toDateKey(today), toDateKey(addCalendarDays(today, 20)), symbols)
      .then((response) => { if (!canceled) setCalendarEvents(response.events); })
      .catch(() => { if (!canceled) setCalendarEvents([]); });
    return () => { canceled = true; };
  }, [symbols, today]);
  const events = useMemo(() => calendarEvents.length
    ? buildEarningsEventsFromCalendar(calendarEvents, [], symbols, quotes)
    : buildEarningsEvents(quotes, [], symbols), [calendarEvents, quotes, symbols]);
  const days = useMemo(() => buildCalendarDays(today, 21, events), [events, today]);

  const pageRail = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(railRef.current.clientWidth * 0.86, 280),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section aria-labelledby="watchlist-earnings-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/discover/earnings" className="group inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">
          <CalendarDays className="size-4 text-indigo-primary" aria-hidden="true" />
          <h3 id="watchlist-earnings-title" className="font-heading text-xl font-semibold">Earnings</h3>
          <ChevronRight className="size-4 text-[var(--text-muted)] transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
        <div className="flex gap-1">
          <button type="button" aria-label="Earlier earnings dates" onClick={() => pageRail(-1)} className="inline-flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 active:scale-[0.98] motion-reduce:transition-none"><ArrowLeft className="size-4" /></button>
          <button type="button" aria-label="Later earnings dates" onClick={() => pageRail(1)} className="inline-flex size-10 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 active:scale-[0.98] motion-reduce:transition-none"><ArrowRight className="size-4" /></button>
        </div>
      </div>

      <div ref={railRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((day, index) => {
          const date = addCalendarDays(today, index);
          const isToday = day.date === toDateKey(today);
          return (
            <Link
              key={day.date}
              href={`/discover/earnings?view=list&date=${day.date}`}
              aria-label={`${isToday ? "Today, " : ""}${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}: ${day.events.length} scheduled earnings`}
              className={cn(APP_RADIUS.surface, "group flex min-h-36 min-w-[132px] snap-start flex-col border border-[var(--theme-border)] bg-[var(--surface-card)] p-4 transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transform-none motion-reduce:transition-none sm:min-w-[148px]")}
            >
              <span className="text-2xl font-semibold tabular-nums">{date.getDate()}</span>
              <span className="mt-0.5 text-sm text-[var(--text-muted)]">{isToday ? "Today" : date.toLocaleDateString("en-US", { month: "short" })}</span>
              <span className="mt-auto flex min-h-8 items-center pt-4">
                {day.events.length ? (
                  <span className="flex -space-x-2">
                    {day.events.slice(0, 3).map((event) => <EarningsSymbolMark key={event.id} symbol={event.symbol} logoUrl={event.logoUrl} />)}
                    {day.events.length > 3 && <span className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--background)] bg-[var(--surface-control)] text-[9px] font-semibold text-[var(--text-muted)]">+{day.events.length - 3}</span>}
                  </span>
                ) : <span className="text-xl text-[var(--text-subtle)]">—</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
