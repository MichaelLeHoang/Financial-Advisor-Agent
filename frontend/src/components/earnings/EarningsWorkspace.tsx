"use client";

/**
 * THESIS: Earnings should feel like a working market ledger, not a promotional dashboard.
 * OWN-WORLD: Quanfora's near-black canvas, quiet semantic surfaces, compact controls, and one indigo focus accent.
 * STORY: Scan the reporting horizon, isolate owned or watched names, then open evidence without losing calendar context.
 * FIRST VIEWPORT: Date navigation and scope controls frame either a two-column agenda or a full-width six-week calendar.
 * FORM: Dense calendar workspace, directly shaped from the supplied reference and adapted to the established app system.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  List,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import { EarningsSymbolMark } from "@/components/earnings/EarningsRail";
import { api, type EarningsCalendarEvent } from "@/lib/api";
import {
  addCalendarDays,
  buildCalendarDays,
  buildEarningsEvents,
  buildEarningsEventsFromCalendar,
  buildMonthGrid,
  filterEarningsEvents,
  parseDateKey,
  startOfCalendarWeek,
  toDateKey,
  type EarningsCountry,
  type EarningsEvent,
  type EarningsMarketCap,
} from "@/lib/earnings-calendar";
import { marketDetailsHref } from "@/lib/market-routes";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type ViewMode = "list" | "month";
type CalendarLoadState = { kind: "ok"; sources: string[] } | { kind: "error" } | null;

type Filters = {
  country: EarningsCountry | "All";
  minimumMarketCap: EarningsMarketCap | "all";
  holdingsOnly: boolean;
  watchlistOnly: boolean;
  holdingSymbols: Set<string>;
  watchlistSymbols: Set<string>;
};

const EMPTY_FILTERS: Filters = {
  country: "All",
  minimumMarketCap: "large",
  holdingsOnly: false,
  watchlistOnly: false,
  holdingSymbols: new Set(),
  watchlistSymbols: new Set(),
};

function validDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseDateKey(value);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

export default function EarningsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace = useInvestmentWorkspace();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const requestedDate = validDateParam(searchParams.get("date")) ?? todayKey;
  const requestedView: ViewMode = searchParams.get("view") === "month" ? "month" : "list";
  const [view, setView] = useState<ViewMode>(requestedView);
  const [anchorDate, setAnchorDate] = useState(() => parseDateKey(requestedDate));
  const [calendarEvents, setCalendarEvents] = useState<EarningsCalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [calendarLoadState, setCalendarLoadState] = useState<CalendarLoadState>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const holdingSymbols = useMemo(() => Array.from(new Set(workspace.allHoldings.map(({ holding }) => holding.symbol.toUpperCase()))), [workspace.allHoldings]);
  const watchlistSymbols = useMemo(() => Array.from(new Set(workspace.watchlistAssets.map((asset) => asset.symbol.toUpperCase()))), [workspace.watchlistAssets]);
  const scopeSymbols = useMemo(() => Array.from(new Set([...holdingSymbols, ...watchlistSymbols])), [holdingSymbols, watchlistSymbols]);
  const calendarRange = useMemo(() => {
    if (view === "month") {
      const dates = buildMonthGrid(anchorDate);
      return { from: dates[0], to: dates[dates.length - 1] };
    }
    const start = startOfCalendarWeek(anchorDate);
    return { from: toDateKey(start), to: toDateKey(addCalendarDays(start, 13)) };
  }, [anchorDate, view]);

  const loadCalendar = useCallback(async () => {
    setLoadingCalendar(true);
    try {
      const [market, scoped] = await Promise.all([
        api.earningsCalendar(calendarRange.from, calendarRange.to),
        scopeSymbols.length ? api.earningsCalendar(calendarRange.from, calendarRange.to, scopeSymbols) : Promise.resolve(null),
      ]);
      const merged = new Map<string, EarningsCalendarEvent>();
      [...market.events, ...(scoped?.events ?? [])].forEach((event) => merged.set(`${event.symbol}-${event.date}`, event));
      setCalendarEvents(Array.from(merged.values()));
      setCalendarLoadState({ kind: "ok", sources: Array.from(new Set([...market.data_sources, ...(scoped?.data_sources ?? [])])) });
    } catch {
      setCalendarLoadState({ kind: "error" });
    } finally {
      setLoadingCalendar(false);
    }
  }, [calendarRange.from, calendarRange.to, scopeSymbols]);

  useEffect(() => { void loadCalendar(); }, [loadCalendar]);
  useEffect(() => {
    setView(requestedView);
    setAnchorDate(parseDateKey(requestedDate));
  }, [requestedDate, requestedView]);

  const quotes = useMemo(() => Array.from(workspace.quotes.values()), [workspace.quotes]);
  const allEvents = useMemo(() => calendarEvents.length
    ? buildEarningsEventsFromCalendar(calendarEvents, holdingSymbols, watchlistSymbols, quotes)
    : buildEarningsEvents(quotes, holdingSymbols, watchlistSymbols), [calendarEvents, holdingSymbols, quotes, watchlistSymbols]);
  const events = useMemo(() => {
    const filtered = filterEarningsEvents(allEvents, filters);
    const selected = new Set([...filters.holdingSymbols, ...filters.watchlistSymbols]);
    return selected.size ? filtered.filter((event) => selected.has(event.symbol)) : filtered;
  }, [allEvents, filters]);

  const setLocation = useCallback((nextView: ViewMode, nextDate: Date) => {
    const date = toDateKey(nextDate);
    setView(nextView);
    setAnchorDate(nextDate);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const changeView = (next: ViewMode) => setLocation(next, anchorDate);
  const shiftPeriod = (direction: -1 | 1) => {
    const next = new Date(anchorDate);
    if (view === "month") next.setMonth(next.getMonth() + direction, 1);
    else next.setDate(next.getDate() + direction * 7);
    setLocation(view, next);
    setExpandedEvent(null);
  };

  const selectedLabel = view === "month"
    ? anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : anchorDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const activeFilterCount = [
    filters.country !== "All",
    filters.minimumMarketCap !== "all",
    filters.holdingsOnly,
    filters.watchlistOnly,
    filters.holdingSymbols.size > 0,
    filters.watchlistSymbols.size > 0,
  ].filter(Boolean).length;

  return (
    <main className="min-h-full bg-[var(--background)] px-4 pb-8 pt-20 text-[var(--text-primary)] md:pt-6 lg:px-8">
      <div className="mx-auto max-w-[1680px]">
        <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-indigo-primary" />
            <h1 className="font-heading text-2xl font-semibold">Earnings</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {view === "month" && <ScopeToggles filters={filters} setFilters={setFilters} />}
            <button type="button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} className={cn("relative inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border)] transition-colors duration-150 hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", filtersOpen && "bg-[var(--surface-control)]")} aria-label="Open earnings filters"><Filter className="size-4" />{activeFilterCount > 0 && <span className="absolute -right-0.5 -top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-indigo-primary text-[9px] font-bold text-[var(--background)]">{activeFilterCount}</span>}</button>
            <ViewToggle value={view} onChange={changeView} />
          </div>
        </header>

        <div className="relative mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" aria-label={view === "month" ? "Previous month" : "Previous week"} onClick={() => shiftPeriod(-1)} className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--surface-control)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><ArrowLeft className="size-4" /></button>
              <button type="button" aria-label={view === "month" ? "Next month" : "Next week"} onClick={() => shiftPeriod(1)} className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--surface-control)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><ArrowRight className="size-4" /></button>
            </div>
            <h2 className="font-heading text-xl font-semibold sm:text-2xl">{selectedLabel}</h2>
            <button type="button" onClick={() => void loadCalendar()} disabled={loadingCalendar} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--theme-border)] px-3 text-sm font-semibold text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={cn("size-4", loadingCalendar && "animate-spin motion-reduce:animate-none")} />Refresh</button>
          </div>

          {calendarLoadState?.kind === "error" && !loadingCalendar && (
            <div role="alert" className={cn(APP_RADIUS.surface, "mt-5 flex flex-wrap items-center gap-3 border border-red-negative/30 bg-red-negative/10 px-4 py-3 text-sm text-red-negative")}>
              <AlertTriangle className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">Live earnings providers are temporarily unavailable. Cached symbol data is shown when available.</span>
              <button type="button" onClick={() => void loadCalendar()} className="rounded-lg px-2 py-1 font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">Retry</button>
            </div>
          )}

          {view === "list" ? (
            <ListView
              anchorDate={anchorDate}
              events={events}
              loading={loadingCalendar || workspace.loading}
              expandedEvent={expandedEvent}
              onExpand={setExpandedEvent}
              filters={filters}
              setFilters={setFilters}
              holdings={holdingSymbols}
              watchlist={watchlistSymbols}
              onSelectDate={(date) => setLocation("list", parseDateKey(date))}
            />
          ) : (
            <MonthView
              month={anchorDate}
              events={events}
              today={todayKey}
              loading={loadingCalendar || workspace.loading}
              onSelectDate={(date) => setLocation("list", parseDateKey(date))}
            />
          )}
        </div>
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" showCloseButton={false} className="max-w-[420px] overflow-y-auto p-5">
          <SheetTitle className="sr-only">Earnings filters</SheetTitle>
          <SheetDescription className="sr-only">Filter the earnings calendar by country, market capitalization, holdings, and watchlist.</SheetDescription>
          <FilterPanel filters={filters} setFilters={setFilters} holdings={holdingSymbols} watchlist={watchlistSymbols} onClose={() => setFiltersOpen(false)} compact />
        </SheetContent>
      </Sheet>
    </main>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div role="tablist" aria-label="Earnings view" className="inline-flex h-10 rounded-full border border-[var(--theme-border)] bg-[var(--surface-panel)] p-1">
      <button type="button" role="tab" aria-selected={value === "list"} onClick={() => onChange("list")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", value === "list" ? "bg-[var(--surface-control-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}><List className="size-3.5" />List</button>
      <button type="button" role="tab" aria-selected={value === "month"} onClick={() => onChange("month")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", value === "month" ? "bg-[var(--surface-control-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}><CalendarDays className="size-3.5" />Month</button>
    </div>
  );
}

function ScopeToggles({ filters, setFilters }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>> }) {
  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-[var(--theme-border)] bg-[var(--surface-panel)] px-1">
      {(["watchlist", "holdings"] as const).map((scope) => {
        const active = scope === "watchlist" ? filters.watchlistOnly : filters.holdingsOnly;
        return <button key={scope} type="button" aria-pressed={active} onClick={() => setFilters((current) => ({ ...current, [scope === "watchlist" ? "watchlistOnly" : "holdingsOnly"]: !active }))} className="inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium capitalize text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><span>{scope}</span><span className={cn("relative h-4 w-7 rounded-full bg-[var(--surface-control-hover)] transition-colors duration-150", active && "bg-green-positive")}><span className={cn("absolute left-0.5 top-0.5 size-3 rounded-full bg-[var(--text-primary)] transition-transform duration-150", active && "translate-x-3")} /></span></button>;
      })}
    </div>
  );
}

function ListView({ anchorDate, events, loading, expandedEvent, onExpand, filters, setFilters, holdings, watchlist, onSelectDate }: {
  anchorDate: Date;
  events: EarningsEvent[];
  loading: boolean;
  expandedEvent: string | null;
  onExpand: (id: string | null) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  holdings: string[];
  watchlist: string[];
  onSelectDate: (date: string) => void;
}) {
  const weekStart = startOfCalendarWeek(anchorDate);
  const week = buildCalendarDays(weekStart, 7, events);
  const range = buildCalendarDays(weekStart, 14, events);
  const visibleDays = range.filter((day) => day.events.length > 0 || day.date === toDateKey(anchorDate));

  return (
    <div className="mt-5 grid items-start gap-7 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="sticky top-5 hidden xl:block">
        <WeekStrip days={week} selected={toDateKey(anchorDate)} onSelect={onSelectDate} />
        <div className="mt-7 border-t border-[var(--theme-border)] pt-6"><FilterPanel filters={filters} setFilters={setFilters} holdings={holdings} watchlist={watchlist} /></div>
      </aside>
      <section aria-label="Earnings agenda" className="min-w-0">
        {loading && !events.length ? <LoadingAgenda /> : visibleDays.length ? visibleDays.map((day) => (
          <DayAgenda key={day.date} day={day} expandedEvent={expandedEvent} onExpand={onExpand} />
        )) : <EarningsEmpty />}
      </section>
    </div>
  );
}

function WeekStrip({ days, selected, onSelect }: { days: ReturnType<typeof buildCalendarDays>; selected: string; onSelect: (date: string) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">This week</p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const date = parseDateKey(day.date);
          const active = day.date === selected;
          return <button key={day.date} type="button" aria-pressed={active} onClick={() => onSelect(day.date)} className={cn("flex min-h-20 flex-col items-center justify-center rounded-xl bg-[var(--surface-card)] text-xs transition-colors duration-150 hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", active && "ring-1 ring-[var(--theme-border-strong)]")}><span className="text-[10px] text-[var(--text-muted)]">{date.toLocaleDateString("en-US", { weekday: "narrow" })}</span><strong className={cn("mt-2 inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums", active && "bg-[var(--text-primary)] text-[var(--background)]")}>{date.getDate()}</strong>{day.events.length > 0 && <span className="mt-1 size-1 rounded-full bg-indigo-primary" />}</button>;
        })}
      </div>
    </div>
  );
}

function DayAgenda({ day, expandedEvent, onExpand }: { day: ReturnType<typeof buildCalendarDays>[number]; expandedEvent: string | null; onExpand: (id: string | null) => void }) {
  const date = parseDateKey(day.date);
  const groups = [
    { session: "pre", label: "Pre-market" },
    { session: "post", label: "Post-market" },
    { session: "unknown", label: "Timing unavailable" },
  ].map((group) => ({ ...group, events: day.events.filter((event) => event.session === group.session) })).filter((group) => group.events.length > 0);
  return (
    <section className="mb-9" aria-labelledby={`date-${day.date}`}>
      <h3 id={`date-${day.date}`} className="mb-4 font-heading text-lg font-semibold">{date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</h3>
      {day.events.length ? <div className="space-y-6">{groups.map((group) => <div key={group.session}><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{group.label}</p><div className="space-y-2">{group.events.map((event) => <EarningsRow key={event.id} event={event} expanded={expandedEvent === event.id} onToggle={() => onExpand(expandedEvent === event.id ? null : event.id)} />)}</div></div>)}</div> : <div className={cn(APP_RADIUS.surface, "border border-dashed border-[var(--theme-border)] py-12 text-center text-sm text-[var(--text-muted)]")}>No scheduled reports for this day.</div>}
    </section>
  );
}

function EarningsRow({ event, expanded, onToggle }: { event: EarningsEvent; expanded: boolean; onToggle: () => void }) {
  const actual = event.point.eps_actual;
  const estimated = event.point.eps_estimate;
  const reported = actual != null;
  const primaryValue = reported ? actual : estimated;
  return (
    <article className={cn(APP_RADIUS.surface, "overflow-hidden border border-[var(--theme-border)] bg-[var(--surface-card)]")}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-primary/50 sm:px-5">
        <EarningsSymbolMark symbol={event.symbol} logoUrl={event.logoUrl} className="size-9" />
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{event.name}</strong><span className="mt-1 block text-xs text-[var(--text-muted)]">{event.symbol} · {event.isHolding ? "Holding" : event.isWatchlist ? "Watchlist" : "Market"}</span></span>
        <span className="text-right"><strong className="block text-sm tabular-nums">{primaryValue == null ? "EPS —" : `${primaryValue.toFixed(2)} EPS`}</strong><span className="mt-1 inline-flex rounded-full bg-[var(--surface-control)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">{reported ? "Reported" : "Estimated"}</span></span>
        {expanded ? <ChevronUp className="size-4 shrink-0 text-[var(--text-muted)]" /> : <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" />}
      </button>
      {expanded && <EarningsDetail event={event} />}
    </article>
  );
}

function EarningsDetail({ event }: { event: EarningsEvent }) {
  const points = event.history.slice(-5);
  const values = points.flatMap((point) => [point.eps_estimate, point.eps_actual]).filter((value): value is number => value != null && Number.isFinite(value));
  const max = Math.max(...values.map(Math.abs), 1);
  const chartDescriptionId = `earnings-values-${event.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="border-t border-[var(--theme-border)] px-4 pb-5 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">Earnings history</p><p className="mt-1 text-xs text-[var(--text-muted)]">Estimate versus reported EPS. Future values remain unfilled.</p></div>
        <Link href={marketDetailsHref(event.symbol)} className="theme-solid-action inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">Research {event.symbol}</Link>
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs text-[var(--text-muted)]" aria-hidden="true"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-primary" />Estimate</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-green-positive" />Actual</span></div>
      <div className="relative mt-4 h-52 border-b border-[var(--theme-border)] px-2" role="img" aria-describedby={chartDescriptionId} aria-label={`Earnings estimate and actual history for ${event.symbol}. Bars above the center line are positive and bars below it are negative.`}>
        <div className="pointer-events-none absolute inset-x-2 top-[80px] border-t border-dashed border-[var(--theme-border-strong)]" />
        <div className="absolute inset-0 flex gap-4 px-2 sm:gap-8">
          {points.map((point) => {
            const estimateHeight = point.eps_estimate == null ? 0 : Math.max(4, Math.abs(point.eps_estimate) / max * 68);
            const actualHeight = point.eps_actual == null ? 0 : Math.max(4, Math.abs(point.eps_actual) / max * 68);
            return <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center"><div className="relative h-40 w-full max-w-16"><ChartBar value={point.eps_estimate} height={estimateHeight} side="left" tone="estimate" />{point.eps_actual == null ? <span title="Actual not reported" className="absolute left-1/2 top-[77px] h-1 w-5 rounded border-t border-dashed border-[var(--theme-border-strong)] sm:w-7" /> : <ChartBar value={point.eps_actual} height={actualHeight} side="right" tone="actual" />}</div><span className="mt-2 truncate text-[10px] text-[var(--text-muted)]">{parseDateKey(point.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span><span className="mt-0.5 text-[9px] tabular-nums text-[var(--text-subtle)]">E {point.eps_estimate == null ? "—" : point.eps_estimate.toFixed(2)} · A {point.eps_actual == null ? "—" : point.eps_actual.toFixed(2)}</span></div>;
          })}
        </div>
      </div>
      <ul id={chartDescriptionId} className="sr-only" aria-label={`${event.symbol} earnings values`}>{points.map((point) => <li key={point.date}>{point.date}: estimate {point.eps_estimate ?? "unavailable"}, actual {point.eps_actual ?? "not reported"}</li>)}</ul>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SummaryBox title="Earnings" estimate={event.point.eps_estimate} actual={event.point.eps_actual} format={(value) => value.toFixed(2)} />
        <SummaryBox title="Revenue" estimate={event.point.revenue_estimate} actual={event.point.revenue_actual} format={formatCompactCurrency} />
      </div>
    </div>
  );
}

function ChartBar({ value, height, side, tone }: { value: number | null; height: number; side: "left" | "right"; tone: "estimate" | "actual" }) {
  if (value == null) return null;
  return <span title={`${tone === "estimate" ? "Estimate" : "Actual"} ${value}`} className={cn("absolute w-[calc(50%-2px)]", side === "left" ? "left-0" : "right-0", tone === "estimate" ? "bg-indigo-primary/75" : "bg-green-positive/75", value >= 0 ? "rounded-t" : "rounded-b")} style={value >= 0 ? { height, bottom: 80 } : { height, top: 80 }} />;
}

function SummaryBox({ title, estimate, actual, format }: { title: string; estimate: number | null; actual: number | null; format: (value: number) => string }) {
  const surprise = estimate != null && actual != null && estimate !== 0 ? ((actual - estimate) / Math.abs(estimate)) * 100 : null;
  return <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-panel)] p-4"><p className="font-semibold">{title}</p><dl className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><dt className="text-[var(--text-muted)]">Estimate</dt><dd className="mt-1 font-semibold tabular-nums">{estimate == null ? "—" : format(estimate)}</dd></div><div><dt className="text-[var(--text-muted)]">Actual</dt><dd className="mt-1 font-semibold tabular-nums">{actual == null ? "—" : format(actual)}</dd></div><div><dt className="text-[var(--text-muted)]">Surprise</dt><dd className={cn("mt-1 font-semibold tabular-nums", surprise != null && surprise >= 0 ? "text-green-positive" : surprise != null ? "text-red-negative" : "")}>{surprise == null ? "—" : `${surprise >= 0 ? "+" : ""}${surprise.toFixed(1)}%`}</dd></div></dl></div>;
}

function MonthView({ month, events, today, loading, onSelectDate }: { month: Date; events: EarningsEvent[]; today: string; loading: boolean; onSelectDate: (date: string) => void }) {
  const dates = buildMonthGrid(month);
  const grouped = new Map<string, EarningsEvent[]>();
  events.forEach((event) => grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]));
  return (
    <section className={cn(APP_RADIUS.surface, "mt-5 overflow-x-auto border border-[var(--theme-border)] bg-[var(--surface-panel)]")} aria-label={`${month.toLocaleDateString("en-US", { month: "long", year: "numeric" })} earnings calendar`}>
      <div className="min-w-[980px]">
        <div className="grid grid-cols-7 border-b border-[var(--theme-border)] text-center text-xs text-[var(--text-muted)]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-3">{day}</div>)}</div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const parsed = parseDateKey(date);
            const dayEvents = grouped.get(date) ?? [];
            const inMonth = parsed.getMonth() === month.getMonth();
            const isToday = date === today;
            return <div key={date} className={cn("min-h-40 border-b border-r border-[var(--theme-border)] p-2 last:border-r-0", !inMonth && "bg-[var(--background)] opacity-55", isToday && "ring-1 ring-inset ring-[var(--theme-border-strong)]")}><button type="button" onClick={() => onSelectDate(date)} className="flex w-full items-center justify-between rounded-md px-1 text-xs text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><span>{parsed.getDate() === 1 ? parsed.toLocaleDateString("en-US", { month: "short" }) : ""}</span><span className={cn("inline-flex size-6 items-center justify-center rounded-full tabular-nums", isToday && "bg-[var(--text-primary)] text-[var(--background)]")}>{parsed.getDate()}</span></button><div className="mt-2 space-y-1">{dayEvents.slice(0, 4).map((event) => <button key={event.id} type="button" onClick={() => onSelectDate(date)} className="flex h-7 w-full items-center gap-1.5 rounded-lg bg-[var(--surface-card)] px-1.5 text-left text-[10px] transition-colors duration-150 hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><EarningsSymbolMark symbol={event.symbol} logoUrl={event.logoUrl} className="size-5 text-[7px]" /><strong>{event.symbol}</strong><span className="ml-auto truncate text-[var(--text-muted)]">{earningsStatus(event)}</span></button>)}{dayEvents.length > 4 && <button type="button" onClick={() => onSelectDate(date)} className="px-1 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">+{dayEvents.length - 4} more</button>}</div></div>;
          })}
        </div>
      </div>
      {loading && <div className="flex items-center justify-center gap-2 border-t border-[var(--theme-border)] py-3 text-xs text-[var(--text-muted)]"><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />Refreshing calendar</div>}
    </section>
  );
}

function earningsStatus(event: EarningsEvent) {
  if (event.point.eps_actual == null) return event.session === "pre" ? "Pre-market" : event.session === "post" ? "Post-market" : "Timing unavailable";
  if (event.point.eps_estimate == null) return "Reported";
  return event.point.eps_actual >= event.point.eps_estimate ? "Beat" : "Miss";
}

function FilterPanel({ filters, setFilters, holdings, watchlist, onClose, compact = false }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; holdings: string[]; watchlist: string[]; onClose?: () => void; compact?: boolean }) {
  const clear = () => setFilters({ ...EMPTY_FILTERS, holdingSymbols: new Set(), watchlistSymbols: new Set() });
  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h3 className="font-heading text-xl font-semibold">Filters</h3><div className="flex items-center gap-1"><button type="button" onClick={clear} className="h-9 rounded-full border border-[var(--theme-border)] px-3 text-xs font-semibold text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">Clear</button>{onClose && <button type="button" onClick={onClose} aria-label="Close filters" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><X className="size-4" /></button>}</div></div>
      <div className="mt-5 space-y-2 border-t border-[var(--theme-border)] pt-4">
        <FilterDisclosure title="Country" value={filters.country} defaultOpen={!compact}>
          {(["All", "US", "CA", "Other"] as const).map((country) => <RadioRow key={country} label={country === "US" ? "U.S." : country === "CA" ? "Canada" : country} selected={filters.country === country} onSelect={() => setFilters((current) => ({ ...current, country }))} />)}
        </FilterDisclosure>
        <FilterDisclosure title="Minimum market cap" value={capLabel(filters.minimumMarketCap)} defaultOpen={!compact}>
          {(["all", "mega", "large", "mid", "small"] as const).map((cap) => <RadioRow key={cap} label={capLabel(cap)} detail={cap === "mega" ? ">$100B" : cap === "large" ? ">$10B" : cap === "mid" ? ">$1B" : cap === "small" ? ">$250M" : undefined} selected={filters.minimumMarketCap === cap} onSelect={() => setFilters((current) => ({ ...current, minimumMarketCap: cap }))} />)}
        </FilterDisclosure>
        <SymbolDisclosure title="Holdings" symbols={holdings} selected={filters.holdingSymbols} onChange={(holdingSymbols) => setFilters((current) => ({ ...current, holdingSymbols }))} />
        <SymbolDisclosure title="Watchlist" symbols={watchlist} selected={filters.watchlistSymbols} onChange={(watchlistSymbols) => setFilters((current) => ({ ...current, watchlistSymbols }))} />
      </div>
      <p className="mt-6 border-t border-[var(--theme-border)] pt-5 text-xs leading-5 text-[var(--text-muted)]">Earnings dates and estimates are informational only and may change before the report.</p>
    </div>
  );
}

function FilterDisclosure({ title, value, children, defaultOpen = false }: { title: string; value: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div><button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={cn("flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm font-semibold hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", open && "bg-[var(--surface-control)]")}><span>{title}</span><span className="ml-auto rounded-full bg-[var(--surface-control-hover)] px-2 py-1 text-[10px] text-[var(--text-muted)]">{value}</span>{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>{open && <div className="space-y-1 px-2 py-2">{children}</div>}</div>;
}

function SymbolDisclosure({ title, symbols, selected, onChange }: { title: string; symbols: string[]; selected: Set<string>; onChange: (symbols: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = symbols.filter((symbol) => symbol.includes(query.trim().toUpperCase()));
  const toggle = (symbol: string) => { const next = new Set(selected); if (next.has(symbol)) next.delete(symbol); else next.add(symbol); onChange(next); };
  return <div><button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex min-h-12 w-full items-center justify-between rounded-lg px-2 text-sm font-semibold hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><span>{title}</span><span className="ml-auto mr-3 text-[10px] font-medium text-[var(--text-muted)]">{selected.size ? `${selected.size} selected` : `${symbols.length} symbols`}</span>{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>{open && <div className="px-2 pb-3"><label className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--surface-control)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--text-subtle)] focus:ring-2 focus:ring-indigo-primary/50" /></label><div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{visible.length ? visible.map((symbol) => <button key={symbol} type="button" aria-pressed={selected.has(symbol)} onClick={() => toggle(symbol)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-[var(--surface-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><EarningsSymbolMark symbol={symbol} className="size-6 text-[7px]" /><span className="font-semibold">{symbol}</span><span className={cn("ml-auto inline-flex size-5 items-center justify-center rounded-md border border-[var(--theme-border-strong)]", selected.has(symbol) && "border-indigo-primary bg-indigo-primary text-[var(--background)]")}>{selected.has(symbol) && <Check className="size-3" />}</span></button>) : <p className="py-4 text-center text-xs text-[var(--text-muted)]">No matching symbols.</p>}</div></div>}</div>;
}

function RadioRow({ label, detail, selected, onSelect }: { label: string; detail?: string; selected: boolean; onSelect: () => void }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="flex min-h-10 w-full items-center rounded-lg px-2 text-left text-sm hover:bg-[var(--surface-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><span><span className="block">{label}</span>{detail && <span className="block text-xs text-[var(--text-muted)]">{detail}</span>}</span><span className={cn("ml-auto inline-flex size-5 items-center justify-center rounded-full border-2 border-[var(--theme-border-strong)]", selected && "border-[var(--text-primary)]")}><span className={cn("size-2 rounded-full", selected && "bg-[var(--text-primary)]")} /></span></button>;
}

function LoadingAgenda() {
  return <div className="space-y-3" aria-label="Loading earnings calendar"><div className="h-6 w-40 animate-pulse rounded bg-[var(--surface-control)] motion-reduce:animate-none" />{Array.from({ length: 5 }, (_, index) => <div key={index} className={cn(APP_RADIUS.surface, "h-20 animate-pulse border border-[var(--theme-border)] bg-[var(--surface-card)] motion-reduce:animate-none")} />)}</div>;
}

function EarningsEmpty() {
  return <div className={cn(APP_RADIUS.surface, "border border-dashed border-[var(--theme-border)] px-5 py-16 text-center")}><CalendarDays className="mx-auto size-7 text-[var(--text-subtle)]" /><h3 className="mt-4 font-semibold">No earnings dates in this range</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">Try another week, clear a filter, or refresh when your market-data provider publishes its next calendar update.</p></div>;
}

function capLabel(value: EarningsMarketCap | "all") {
  if (value === "all") return "All";
  return `${value[0].toUpperCase()}${value.slice(1)}-cap`;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}
