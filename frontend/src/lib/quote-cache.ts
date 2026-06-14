import { api } from "@/lib/api";
import type { MarketQuote } from "@/lib/api";

const TTL_MS = 60_000; // 60 s — stays fresh for a typical browsing session

interface Entry {
  data: MarketQuote;
  fetchedAt: number;
}

// Module-level singleton: survives page-to-page navigation in Next.js SPA mode
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<MarketQuote>>();

function cacheKey(ticker: string, period: string, interval: string): string {
  return `${ticker.toUpperCase()}:${period}:${interval}`;
}

function get(ticker: string, period: string, interval: string): MarketQuote | null {
  const entry = cache.get(cacheKey(ticker, period, interval));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(cacheKey(ticker, period, interval));
    return null;
  }
  return entry.data;
}

export function invalidate(ticker: string): void {
  const normalized = ticker.toUpperCase();
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(`${normalized}:`)) cache.delete(key);
  });
}

export function invalidateAll(): void {
  cache.clear();
}

/** Fetch a quote, returning a cached result if still fresh. */
export async function fetchQuote(ticker: string, period = "1mo", interval = "1d"): Promise<MarketQuote> {
  const key = cacheKey(ticker, period, interval);
  const cached = get(ticker, period, interval);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same ticker
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = api
    .marketQuote(ticker, period, interval)
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

/** Prime the cache with data already fetched elsewhere (e.g. the Market page). */
export function primeQuote(data: MarketQuote, period = "1mo", interval = "1d"): void {
  cache.set(cacheKey(data.ticker, period, interval), { data, fetchedAt: Date.now() });
}
