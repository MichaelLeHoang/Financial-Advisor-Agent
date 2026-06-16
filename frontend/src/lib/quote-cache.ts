import { api } from "@/lib/api";
import type { MarketQuote } from "@/lib/api";

const TTL_MS = 120_000; // Fresh enough for portfolio hydration without feeling stale.
const STORAGE_KEY = "market.quoteCache.v1";

interface Entry {
  data: MarketQuote;
  fetchedAt: number;
}

// Module-level singleton: survives page-to-page navigation in Next.js SPA mode
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<MarketQuote>>();
let storageHydrated = false;

function cacheKey(ticker: string, period: string, interval: string): string {
  return `${ticker.toUpperCase()}:${period}:${interval}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function hydrateFromStorage() {
  if (storageHydrated || !canUseStorage()) return;
  storageHydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Array<[string, Entry]>;
    const now = Date.now();
    entries.forEach(([key, entry]) => {
      if (entry?.data && now - entry.fetchedAt <= TTL_MS) cache.set(key, entry);
    });
  } catch {
    // Persistent cache is an optimization only.
  }
}

function persistToStorage() {
  if (!canUseStorage()) return;

  try {
    const now = Date.now();
    const entries = Array.from(cache.entries()).filter(([, entry]) => now - entry.fetchedAt <= TTL_MS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota/private-mode failures.
  }
}

function get(ticker: string, period: string, interval: string): MarketQuote | null {
  hydrateFromStorage();
  const entry = cache.get(cacheKey(ticker, period, interval));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(cacheKey(ticker, period, interval));
    persistToStorage();
    return null;
  }
  return entry.data;
}

export function invalidate(ticker: string): void {
  const normalized = ticker.toUpperCase();
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(`${normalized}:`)) cache.delete(key);
  });
  persistToStorage();
}

export function invalidateAll(): void {
  cache.clear();
  persistToStorage();
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
      persistToStorage();
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
  persistToStorage();
}
