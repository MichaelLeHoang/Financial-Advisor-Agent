"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Watchlist, WatchlistAsset, MarketQuote } from "@/lib/api";
import { fetchQuote, invalidate } from "@/lib/quote-cache";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import MarketIndicesStrip from "@/components/market/MarketIndicesStrip";
import MarketMovers from "@/components/market/MarketMovers";
import MarketNewsFeed from "@/components/market/MarketNewsFeed";
import MarketSummary from "@/components/market/MarketSummary";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

interface AssetRow extends WatchlistAsset {
  quote: MarketQuote | null;
  loading: boolean;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// The market quote API returns `change` as a percentage, not a dollar amount.
function changePct(q: MarketQuote): number {
  return q.change;
}

/* Deterministic monogram avatar color from the ticker, à la Google Finance logos. */
const AVATAR_COLORS = [
  "bg-indigo-500/20 text-indigo-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-rose-500/20 text-rose-300",
  "bg-violet-500/20 text-violet-300",
  "bg-teal-500/20 text-teal-300",
  "bg-orange-500/20 text-orange-300",
];

function avatarColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function TickerAvatar({ symbol }: { symbol: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-tight",
        avatarColor(symbol)
      )}
      aria-hidden="true"
    >
      {symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}
    </div>
  );
}

/* Change pill: arrow + sign so direction never relies on color alone. */
function ChangePill({ pct, positive }: { pct: number; positive: boolean }) {
  const Arrow = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-semibold tabular-nums",
        positive
          ? "bg-green-positive/12 text-green-positive"
          : "bg-red-negative/12 text-red-negative"
      )}
    >
      <Arrow className="h-3 w-3" aria-hidden="true" />
      {fmt(Math.abs(pct))}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Compact watchlist section (sidebar)                                 */
/* ------------------------------------------------------------------ */

function WatchlistSection({
  watchlist,
  onDelete,
  onUpgrade,
}: {
  watchlist: Watchlist;
  onDelete: () => void;
  onUpgrade: (message: string) => void;
}) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback((rows: AssetRow[]) => {
    rows.forEach((a) => {
      fetchQuote(a.symbol)
        .then((quote) => {
          setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, quote, loading: false } : r)));
        })
        .catch(() => {
          setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, loading: false } : r)));
        });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.watchlistAssets(watchlist.id)
      .then((list) => {
        if (cancelled) return;
        const rows: AssetRow[] = list.map((a) => ({ ...a, quote: null, loading: true }));
        setAssets(rows);
        setLoading(false);
        fetchQuotes(rows);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [watchlist.id, fetchQuotes]);

  const addAsset = async (symbol: string) => {
    setAdding(true);
    setError(null);
    try {
      const asset = await api.addWatchlistAsset(watchlist.id, symbol);
      const row: AssetRow = { ...asset, quote: null, loading: true };
      setAssets((prev) => [...prev, row]);
      setTickerInput("");
      fetchQuotes([row]);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) onUpgrade(e.detail.message);
      else setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    try {
      await api.removeWatchlistAsset(watchlist.id, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const refresh = async () => {
    if (refreshing || assets.length === 0) return;
    setRefreshing(true);
    assets.forEach((a) => invalidate(a.symbol));
    const rows = assets.map((a) => ({ ...a, loading: true }));
    setAssets(rows);
    await Promise.allSettled(
      rows.map((a) =>
        fetchQuote(a.symbol)
          .then((quote) => {
            setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, quote, loading: false } : r)));
          })
          .catch(() => {
            setAssets((prev) => prev.map((r) => (r.id === a.id ? { ...r, loading: false } : r)));
          })
      )
    );
    setRefreshing(false);
  };

  const existingSymbols = useMemo(() => assets.map((a) => a.symbol), [assets]);

  return (
    <section aria-label={watchlist.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-white/35 transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold text-white">{watchlist.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-white/30">
            {loading ? "" : assets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || assets.length === 0}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`Refresh quotes for ${watchlist.name}`}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>

        <AlertDialog>
          <AlertDialogTrigger
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-red-negative"
            aria-label={`Delete ${watchlist.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{watchlist.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the watchlist and all its tickers. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-red-negative text-white hover:bg-red-negative/85"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!collapsed && (
        <>
          {/* Add symbol */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            <TickerSuggestionInput
              value={tickerInput}
              onValueChange={setTickerInput}
              onSelect={addAsset}
              existingTickers={existingSymbols}
              placeholder="Add symbol…"
              className="flex-1"
              inputClassName="h-8 border border-white/[0.08] bg-white/[0.03] rounded-lg text-sm focus-visible:ring-0 focus-visible:border-indigo-primary/50"
            />
            {adding && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />}
          </div>

          {error && <p className="px-3 pb-2 text-xs text-red-negative">{error}</p>}

          {/* Symbol rows */}
          {loading ? (
            <div className="space-y-2 px-3 pb-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-12 animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <p className="px-3 pb-4 pt-1 text-xs text-white/30">No symbols yet. Add your first above.</p>
          ) : (
            <ul className="px-1.5 pb-2">
              {assets.map((a) => {
                const q = a.quote;
                const positive = q ? q.change >= 0 : true;
                return (
                  <li key={a.id} className="group">
                    <Link
                      href={`/market?ticker=${encodeURIComponent(a.symbol)}`}
                      className="flex items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.04]"
                    >
                      <TickerAvatar symbol={a.symbol} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{a.symbol}</p>
                        {q ? (
                          <p className="truncate text-xs text-white/35">{q.name}</p>
                        ) : a.loading ? (
                          <p className="mt-1 h-2.5 w-16 animate-pulse rounded bg-white/[0.07]" />
                        ) : (
                          <p className="text-xs text-white/25">Unavailable</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {a.loading ? (
                          <span className="inline-block h-4 w-12 animate-pulse rounded bg-white/[0.07]" />
                        ) : q ? (
                          <>
                            <p className="text-sm font-semibold tabular-nums text-white">${fmt(q.price)}</p>
                            <div className="mt-0.5 flex justify-end">
                              <ChangePill pct={changePct(q)} positive={positive} />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-white/25">—</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          removeAsset(a.id);
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/15 opacity-0 transition-all hover:bg-white/[0.06] hover:text-red-negative focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Remove ${a.symbol} from ${watchlist.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  useEffect(() => {
    api.watchlists()
      .then(setWatchlists)
      .catch(() => {})
      .finally(() => setListsLoading(false));
  }, []);

  const createWatchlist = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreatingList(true);
    setCreateError(null);
    try {
      const w = await api.createWatchlist(name);
      setWatchlists((prev) => [...prev, w]);
      setNewName("");
      setShowNewForm(false);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setCreateError(e.message);
    } finally {
      setCreatingList(false);
    }
  };

  const deleteWatchlist = async (watchlistId: string) => {
    try {
      await api.deleteWatchlist(watchlistId);
      setWatchlists((prev) => prev.filter((w) => w.id !== watchlistId));
    } catch {
      /* deletion failure leaves the list in place */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        {/* Page header */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Markets</h1>
            <p className="mt-1 text-sm text-white/40">Your watchlists, market movers and the latest headlines.</p>
          </div>
        </div>

        {/* On mobile this wrapper scrolls as one; on lg each column scrolls independently. */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* ---------------- Left sidebar: watchlists ---------------- */}
          <aside className="w-full shrink-0 lg:w-80 lg:overflow-y-auto lg:pr-1.5">
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Your lists</h2>
              {!showNewForm && (
                <Button
                  onClick={() => setShowNewForm(true)}
                  size="sm"
                  className="theme-solid-action h-8 rounded-lg px-2.5 text-xs font-semibold"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> New
                </Button>
              )}
            </div>

            {showNewForm && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createWatchlist();
                    if (e.key === "Escape") setShowNewForm(false);
                  }}
                  placeholder="List name"
                  autoFocus
                  className="h-9 flex-1 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
                />
                <Button
                  onClick={createWatchlist}
                  disabled={creatingList || !newName.trim()}
                  size="sm"
                  className="theme-solid-action h-9 rounded-xl px-3 text-xs font-semibold"
                >
                  {creatingList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="text-sm text-white/30 hover:text-white"
                  aria-label="Cancel new list"
                >
                  ✕
                </button>
              </div>
            )}

            {createError && <p className="pb-2 text-xs text-red-negative">{createError}</p>}
            {upgradeMessage && (
              <div className="pb-4">
                <UpgradePrompt message={upgradeMessage} />
              </div>
            )}

            {listsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
                ))}
              </div>
            ) : watchlists.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
                <Star className="h-8 w-8 text-white/10" />
                <div>
                  <p className="text-sm font-medium text-white/40">No watchlists yet</p>
                  <p className="mt-1 text-xs text-white/20">Create a list to track symbols.</p>
                </div>
                <Button
                  onClick={() => setShowNewForm(true)}
                  size="sm"
                  className="theme-solid-action mt-1 h-9 rounded-xl px-4 text-sm font-semibold"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New list
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {watchlists.map((w) => (
                  <WatchlistSection
                    key={w.id}
                    watchlist={w}
                    onDelete={() => deleteWatchlist(w.id)}
                    onUpgrade={setUpgradeMessage}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* ---------------- Main: markets home ---------------- */}
          <main className="min-w-0 flex-1 space-y-8 lg:overflow-y-auto lg:pr-1.5">
            <section>
              <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Market summary</h2>
              <MarketIndicesStrip />
            </section>

            <section>
              <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">US market summary</h2>
              <MarketSummary />
            </section>

            <section>
              <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Market trends</h2>
              <MarketMovers />
            </section>

            <section>
              <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/45">Today's financial news</h2>
              <MarketNewsFeed />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
