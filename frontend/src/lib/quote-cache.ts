import { api } from "@/lib/api";
import type { MarketQuote } from "@/lib/api";

const DEFAULT_TTL_MS = 120_000; // Fresh enough for portfolio hydration without feeling stale.
const INTRADAY_TTL_MS = 20_000;
const QUOTE_TIMEOUT_MS = 12_000;
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

function ttlFor(period: string, interval: string): number {
  if (period === "1d" || interval.endsWith("m")) return INTRADAY_TTL_MS;
  return DEFAULT_TTL_MS;
}

function periodAndIntervalFromKey(key: string): [string, string] {
  const parts = key.split(":");
  const interval = parts.pop() ?? "";
  const period = parts.pop() ?? "";
  return [period, interval];
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
      const [period, interval] = periodAndIntervalFromKey(key);
      if (entry?.data && now - entry.fetchedAt <= ttlFor(period ?? "", interval ?? "")) cache.set(key, entry);
    });
  } catch {
    // Persistent cache is an optimization only.
  }
}

function persistToStorage() {
  if (!canUseStorage()) return;

  try {
    const now = Date.now();
    const entries = Array.from(cache.entries()).filter(([key, entry]) => {
      const [period, interval] = periodAndIntervalFromKey(key);
      return now - entry.fetchedAt <= ttlFor(period ?? "", interval ?? "");
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota/private-mode failures.
  }
}

function get(ticker: string, period: string, interval: string): MarketQuote | null {
  hydrateFromStorage();
  const entry = cache.get(cacheKey(ticker, period, interval));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlFor(period, interval)) {
    cache.delete(cacheKey(ticker, period, interval));
    persistToStorage();
    return null;
  }
  return entry.data;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      });
  });
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

  const promise = withTimeout(
    api.marketQuote(ticker, period, interval),
    QUOTE_TIMEOUT_MS,
    `${ticker.toUpperCase()} quote`
  )
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

export async function fetchQuotes(tickers: string[], period = "1mo", interval = "1d"): Promise<Map<string, MarketQuote>> {
  const uniqueTickers = Array.from(new Set(tickers.map((ticker) => ticker.trim()).filter(Boolean)));
  const results = await Promise.allSettled(uniqueTickers.map((ticker) => fetchQuote(ticker, period, interval)));
  const quotes = new Map<string, MarketQuote>();

  results.forEach((result, index) => {
    if (result.status === "fulfilled") quotes.set(uniqueTickers[index].toUpperCase(), result.value);
  });

  return quotes;
}

/** Prime the cache with data already fetched elsewhere (e.g. the Market page). */
export function primeQuote(data: MarketQuote, period = "1mo", interval = "1d"): void {
  cache.set(cacheKey(data.ticker, period, interval), { data, fetchedAt: Date.now() });
  persistToStorage();
}
