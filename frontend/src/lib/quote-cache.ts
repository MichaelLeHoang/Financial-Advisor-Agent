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

function get(ticker: string): MarketQuote | null {
  const entry = cache.get(ticker);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(ticker);
    return null;
  }
  return entry.data;
}

export function invalidate(ticker: string): void {
  cache.delete(ticker);
}

export function invalidateAll(): void {
  cache.clear();
}

/** Fetch a quote, returning a cached result if still fresh. */
export async function fetchQuote(ticker: string): Promise<MarketQuote> {
  const cached = get(ticker);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same ticker
  const existing = inflight.get(ticker);
  if (existing) return existing;

  const promise = api
    .marketQuote(ticker)
    .then((data) => {
      cache.set(ticker, { data, fetchedAt: Date.now() });
      inflight.delete(ticker);
      return data;
    })
    .catch((err) => {
      inflight.delete(ticker);
      throw err;
    });

  inflight.set(ticker, promise);
  return promise;
}

/** Prime the cache with data already fetched elsewhere (e.g. the Market page). */
export function primeQuote(data: MarketQuote): void {
  cache.set(data.ticker, { data, fetchedAt: Date.now() });
}
