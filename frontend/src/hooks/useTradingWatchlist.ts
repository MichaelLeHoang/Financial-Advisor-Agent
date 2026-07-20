"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type MarketQuote, type WatchlistAsset } from "@/lib/api";

const DEFAULT_SYMBOLS = ["AMD", "NVDA", "AAPL"];

export interface TradingWatchlistItem {
  id?: string;
  symbol: string;
  quote?: MarketQuote;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, "");
}

export function useTradingWatchlist(ownerScope: string, isGuest: boolean) {
  const storageKey = `quanfora.trade-watchlist.${ownerScope}`;
  const [watchlistId, setWatchlistId] = useState<string | null>(null);
  const [assets, setAssets] = useState<WatchlistAsset[]>([]);
  const [guestSymbols, setGuestSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbols = useMemo(
    () => isGuest ? guestSymbols : assets.map((asset) => asset.symbol),
    [assets, guestSymbols, isGuest],
  );

  const loadQuotes = useCallback(async (nextSymbols: string[]) => {
    if (!nextSymbols.length) {
      setQuotes({});
      return;
    }
    const results = await Promise.allSettled(nextSymbols.map((symbol) => api.marketQuote(symbol, "5d", "1h")));
    const next: Record<string, MarketQuote> = {};
    results.forEach((result, index) => {
      if (result.status === "fulfilled") next[nextSymbols[index]] = result.value;
    });
    setQuotes(next);
  }, []);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    if (isGuest) {
      try {
        const stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null") as string[] | null;
        const next = Array.isArray(stored)
          ? [...new Set(stored.map(normalizeSymbol).filter(Boolean))]
          : DEFAULT_SYMBOLS;
        setGuestSymbols(next);
        void loadQuotes(next);
      } catch {
        setGuestSymbols(DEFAULT_SYMBOLS);
        void loadQuotes(DEFAULT_SYMBOLS);
      } finally {
        setLoading(false);
      }
      return () => { canceled = true; };
    }

    api.watchlists()
      .then(async (watchlists) => {
        const watchlist = watchlists.find((item) => item.name === "Trading Watchlist")
          ?? watchlists[0]
          ?? await api.createWatchlist("Trading Watchlist");
        if (canceled) return;
        setWatchlistId(watchlist.id);
        let nextAssets = await api.watchlistAssets(watchlist.id);
        if (!nextAssets.length) {
          const seeded = await Promise.all(DEFAULT_SYMBOLS.map((symbol) => api.addWatchlistAsset(watchlist.id, symbol)));
          nextAssets = seeded;
        }
        if (canceled) return;
        setAssets(nextAssets);
        await loadQuotes(nextAssets.map((asset) => asset.symbol));
      })
      .catch((reason) => {
        if (!canceled) setError(reason instanceof Error ? reason.message : "Watchlist could not load.");
      })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [isGuest, loadQuotes, storageKey]);

  useEffect(() => {
    if (!isGuest) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(guestSymbols));
  }, [guestSymbols, isGuest, storageKey]);

  const add = useCallback(async (rawSymbol: string) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol || symbols.includes(symbol)) return;
    setError(null);
    if (isGuest) {
      const next = [...guestSymbols, symbol];
      setGuestSymbols(next);
      await loadQuotes(next);
      return;
    }
    if (!watchlistId) throw new Error("Watchlist is unavailable.");
    const asset = await api.addWatchlistAsset(watchlistId, symbol);
    const next = [...assets, asset];
    setAssets(next);
    await loadQuotes(next.map((item) => item.symbol));
  }, [assets, guestSymbols, isGuest, loadQuotes, symbols, watchlistId]);

  const remove = useCallback(async (symbol: string) => {
    setError(null);
    if (isGuest) {
      const next = guestSymbols.filter((item) => item !== symbol);
      setGuestSymbols(next);
      await loadQuotes(next);
      return;
    }
    if (!watchlistId) return;
    const asset = assets.find((item) => item.symbol === symbol);
    if (!asset) return;
    await api.removeWatchlistAsset(watchlistId, asset.id);
    const next = assets.filter((item) => item.id !== asset.id);
    setAssets(next);
    await loadQuotes(next.map((item) => item.symbol));
  }, [assets, guestSymbols, isGuest, loadQuotes, watchlistId]);

  const refresh = useCallback(() => loadQuotes(symbols), [loadQuotes, symbols]);
  const items = symbols.map((symbol) => ({
    id: assets.find((asset) => asset.symbol === symbol)?.id,
    symbol,
    quote: quotes[symbol],
  }));

  return { items, symbols, loading, error, add, remove, refresh };
}
