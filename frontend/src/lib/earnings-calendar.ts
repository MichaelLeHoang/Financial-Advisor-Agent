import type { EarningsCalendarEvent, EarningsPoint, MarketQuote } from "./api";

export type EarningsCountry = "US" | "CA" | "Other";
export type EarningsMarketCap = "mega" | "large" | "mid" | "small" | "unknown";
export type EarningsSession = "pre" | "post" | "unknown";

export interface EarningsEvent {
  id: string;
  symbol: string;
  name: string;
  date: string;
  country: EarningsCountry;
  marketCap: number | null;
  marketCapTier: EarningsMarketCap;
  session: EarningsSession;
  currency: string;
  logoUrl: string | null;
  point: EarningsPoint;
  history: EarningsPoint[];
  isHolding: boolean;
  isWatchlist: boolean;
}

export interface EarningsDay {
  date: string;
  events: EarningsEvent[];
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, Math.max(0, (month || 1) - 1), day || 1, 12);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfCalendarWeek(date: Date): Date {
  return addCalendarDays(date, -date.getDay());
}

export function buildCalendarDays(start: Date, count: number, events: EarningsEvent[]): EarningsDay[] {
  const byDate = new Map<string, EarningsEvent[]>();
  events.forEach((event) => byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]));
  return Array.from({ length: count }, (_, index) => {
    const date = toDateKey(addCalendarDays(start, index));
    return { date, events: byDate.get(date) ?? [] };
  });
}

export function buildMonthGrid(month: Date): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const gridStart = startOfCalendarWeek(first);
  return Array.from({ length: 42 }, (_, index) => toDateKey(addCalendarDays(gridStart, index)));
}

export function marketCapTier(value: number | null | undefined): EarningsMarketCap {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (value >= 100_000_000_000) return "mega";
  if (value >= 10_000_000_000) return "large";
  if (value >= 1_000_000_000) return "mid";
  return "small";
}

function countryForQuote(quote: MarketQuote): EarningsCountry {
  const exchange = quote.exchange?.toLowerCase() ?? "";
  if (quote.ticker.toUpperCase().endsWith(".TO") || exchange.includes("toronto") || exchange.includes("tsx")) return "CA";
  if ((quote.currency ?? "USD").toUpperCase() === "USD") return "US";
  return "Other";
}

export function buildEarningsEvents(
  quotes: Iterable<MarketQuote>,
  holdingSymbols: Iterable<string> = [],
  watchlistSymbols: Iterable<string> = [],
): EarningsEvent[] {
  const holdings = new Set(Array.from(holdingSymbols, (symbol) => symbol.toUpperCase()));
  const watchlist = new Set(Array.from(watchlistSymbols, (symbol) => symbol.toUpperCase()));
  const events = new Map<string, EarningsEvent>();

  for (const quote of quotes) {
    const symbol = quote.ticker.toUpperCase();
    const history = (quote.earnings ?? [])
      .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))
      .sort((left, right) => left.date.localeCompare(right.date));

    history.forEach((point) => {
      const id = `${symbol}-${point.date}`;
      events.set(id, {
        id,
        symbol,
        name: quote.name || symbol,
        date: point.date,
        country: countryForQuote(quote),
        marketCap: quote.market_cap ?? null,
        marketCapTier: marketCapTier(quote.market_cap),
        session: point.session ?? "unknown",
        currency: quote.currency || "USD",
        logoUrl: quote.logo_url ?? null,
        point,
        history,
        isHolding: holdings.has(symbol),
        isWatchlist: watchlist.has(symbol),
      });
    });
  }

  return Array.from(events.values()).sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
}

export function buildEarningsEventsFromCalendar(
  calendarEvents: Iterable<EarningsCalendarEvent>,
  holdingSymbols: Iterable<string> = [],
  watchlistSymbols: Iterable<string> = [],
  quotes: Iterable<MarketQuote> = [],
): EarningsEvent[] {
  const holdings = new Set(Array.from(holdingSymbols, (symbol) => symbol.toUpperCase()));
  const watchlist = new Set(Array.from(watchlistSymbols, (symbol) => symbol.toUpperCase()));
  const quoteMap = new Map(Array.from(quotes, (quote) => [quote.ticker.toUpperCase(), quote]));
  const historyBySymbol = new Map<string, EarningsPoint[]>();
  const sourceEvents = Array.from(calendarEvents);

  sourceEvents.forEach((event) => {
    const symbol = event.symbol.toUpperCase();
    const point: EarningsPoint = {
      date: event.date,
      session: event.session,
      eps_actual: event.eps_actual,
      eps_estimate: event.eps_estimate,
      beat_pct: event.beat_pct,
      revenue_actual: event.revenue_actual,
      revenue_estimate: event.revenue_estimate,
      revenue_beat_pct: event.revenue_beat_pct,
    };
    historyBySymbol.set(symbol, [...(historyBySymbol.get(symbol) ?? []), point]);
  });
  quoteMap.forEach((quote, symbol) => {
    const combined = [...(historyBySymbol.get(symbol) ?? []), ...(quote.earnings ?? [])];
    const unique = new Map(combined.map((point) => [point.date, point]));
    historyBySymbol.set(symbol, Array.from(unique.values()).sort((left, right) => left.date.localeCompare(right.date)));
  });

  return sourceEvents.map((event) => {
    const symbol = event.symbol.toUpperCase();
    const quote = quoteMap.get(symbol);
    const point = historyBySymbol.get(symbol)?.find((candidate) => candidate.date === event.date) ?? event;
    const marketCap = event.market_cap ?? quote?.market_cap ?? null;
    return {
      id: `${symbol}-${event.date}`,
      symbol,
      name: event.name && event.name !== symbol ? event.name : quote?.name || symbol,
      date: event.date,
      country: event.country,
      marketCap,
      marketCapTier: marketCapTier(marketCap),
      session: event.session ?? "unknown",
      currency: quote?.currency || "USD",
      logoUrl: event.logo_url ?? quote?.logo_url ?? null,
      point,
      history: historyBySymbol.get(symbol) ?? [point],
      isHolding: holdings.has(symbol),
      isWatchlist: watchlist.has(symbol),
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
}

export function filterEarningsEvents(events: EarningsEvent[], options: {
  country?: EarningsCountry | "All";
  minimumMarketCap?: EarningsMarketCap | "all";
  holdingsOnly?: boolean;
  watchlistOnly?: boolean;
  holdingSymbols?: Set<string>;
  watchlistSymbols?: Set<string>;
}): EarningsEvent[] {
  const capRank: Record<EarningsMarketCap, number> = { unknown: -1, small: 0, mid: 1, large: 2, mega: 3 };
  return events.filter((event) => {
    if (options.country && options.country !== "All" && event.country !== options.country) return false;
    if (options.minimumMarketCap && options.minimumMarketCap !== "all" && capRank[event.marketCapTier] < capRank[options.minimumMarketCap]) return false;
    if (options.holdingsOnly || options.watchlistOnly) {
      const inHoldingScope = options.holdingsOnly && event.isHolding;
      const inWatchlistScope = options.watchlistOnly && event.isWatchlist;
      if (!inHoldingScope && !inWatchlistScope) return false;
    }
    if (options.holdingSymbols?.size && event.isHolding && !options.holdingSymbols.has(event.symbol)) return false;
    if (options.watchlistSymbols?.size && event.isWatchlist && !options.watchlistSymbols.has(event.symbol)) return false;
    return true;
  });
}
