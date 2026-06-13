"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Watchlist, WatchlistAsset, MarketQuote } from "@/lib/api";
import { fetchQuote, invalidate } from "@/lib/quote-cache";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
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

type SortKey =
  | "symbol"
  | "price"
  | "change"
  | "changePct"
  | "open"
  | "high"
  | "low"
  | "marketCap";

interface SortState {
  key: SortKey;
  dir: 1 | -1;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function changePct(q: MarketQuote): number {
  const prev = q.price - q.change;
  return prev !== 0 ? (q.change / prev) * 100 : 0;
}

function sortValue(row: AssetRow, key: SortKey): number | string | null {
  if (key === "symbol") return row.symbol;
  const q = row.quote;
  if (!q) return null;
  switch (key) {
    case "price": return q.price;
    case "change": return q.change;
    case "changePct": return changePct(q);
    case "open": return q.open_price ?? null;
    case "high": return q.day_high ?? null;
    case "low": return q.day_low ?? null;
    case "marketCap": return q.market_cap ?? null;
    default: return null;
  }
}

function sortRows(rows: AssetRow[], sort: SortState | null): AssetRow[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // missing data always last
    if (vb === null) return -1;
    if (typeof va === "string" && typeof vb === "string") {
      return va.localeCompare(vb) * sort.dir;
    }
    return ((va as number) - (vb as number)) * sort.dir;
  });
}

/* ------------------------------------------------------------------ */
/* Sparkline (currentColor so theme overrides recolor it)              */
/* ------------------------------------------------------------------ */

function Sparkline({ history, positive, id }: { history: { price: number }[]; positive: boolean; id: string }) {
  if (history.length < 2) return null;
  return (
    <div className={cn("h-full w-full", positive ? "text-green-positive" : "text-red-negative")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke="currentColor"
            strokeWidth={1.5}
            fill={`url(#sg-${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Change pill: arrow + sign so direction never relies on color alone  */
/* ------------------------------------------------------------------ */

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
/* Sortable column header                                              */
/* ------------------------------------------------------------------ */

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "price", label: "Price" },
  { key: "change", label: "Change", className: "hidden md:table-cell" },
  { key: "changePct", label: "% Change" },
  { key: "open", label: "Open", className: "hidden lg:table-cell" },
  { key: "high", label: "High", className: "hidden lg:table-cell" },
  { key: "low", label: "Low", className: "hidden lg:table-cell" },
  { key: "marketCap", label: "Mkt Cap", className: "hidden xl:table-cell" },
];

function SortHeader({
  label,
  active,
  dir,
  align = "right",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/sort inline-flex items-center gap-1 text-xs font-medium transition-colors",
        align === "right" && "flex-row-reverse",
        active ? "text-white/80" : "text-white/35 hover:text-white/65"
      )}
    >
      {label}
      <ArrowUp
        className={cn(
          "h-3 w-3 transition-all",
          active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-40",
          active && dir === -1 && "rotate-180"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One watchlist section                                               */
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
  const [sort, setSort] = useState<SortState | null>(null);
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

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === 1 ? { key, dir: -1 } : null
        : { key, dir: 1 }
    );
  };

  const existingSymbols = useMemo(() => assets.map((a) => a.symbol), [assets]);
  const sorted = useMemo(() => sortRows(assets, sort), [assets, sort]);

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none";

  return (
    <section aria-label={watchlist.name}>
      {/* Section header */}
      <div className="group/head flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-white/35 transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <span className="truncate text-base font-semibold text-white">{watchlist.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-white/30">
            {loading ? "" : `${assets.length} ${assets.length === 1 ? "symbol" : "symbols"}`}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          {error && <p className="mr-1 max-w-60 truncate text-xs text-red-negative">{error}</p>}

          {!collapsed && (
            <div className="flex items-center gap-1.5">
              <TickerSuggestionInput
                value={tickerInput}
                onValueChange={setTickerInput}
                onSelect={addAsset}
                existingTickers={existingSymbols}
                placeholder="Add symbol…"
                className="w-48 sm:w-56"
                inputClassName="h-8 border border-white/[0.08] bg-white/[0.03] rounded-lg text-sm focus-visible:ring-0 focus-visible:border-indigo-primary/50"
              />
              {adding && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />}
            </div>
          )}

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || assets.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:pointer-events-none disabled:opacity-40"
            aria-label={`Refresh quotes for ${watchlist.name}`}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>

          <AlertDialog>
            <AlertDialogTrigger
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-red-negative"
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
      </div>

      {/* Table */}
      {!collapsed && (
        loading ? (
          <SkeletonRows />
        ) : assets.length === 0 ? (
          <div className="flex items-center gap-3 border-t border-white/[0.05] py-8 pl-6">
            <Star className="h-5 w-5 shrink-0 text-white/12" />
            <p className="text-sm text-white/30">No symbols yet. Use the search above to add your first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th scope="col" aria-sort={ariaSort("symbol")} className="py-2 pl-6 pr-3 text-left">
                    <SortHeader
                      label="Symbol"
                      align="left"
                      active={sort?.key === "symbol"}
                      dir={sort?.dir ?? 1}
                      onClick={() => toggleSort("symbol")}
                    />
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={ariaSort(col.key)}
                      className={cn("px-3 py-2 text-right", col.className)}
                    >
                      <SortHeader
                        label={col.label}
                        active={sort?.key === col.key}
                        dir={sort?.dir ?? 1}
                        onClick={() => toggleSort(col.key)}
                      />
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-white/35">
                    7-day
                  </th>
                  <th scope="col" className="w-10 py-2 pl-1 pr-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const q = a.quote;
                  const positive = q ? q.change >= 0 : true;
                  return (
                    <tr
                      key={a.id}
                      className="group border-b border-white/[0.04] transition-colors last:border-b-0 hover:bg-white/[0.025]"
                    >
                      {/* Symbol + name */}
                      <td className="max-w-48 py-3 pl-6 pr-3">
                        <p className="text-sm font-semibold text-white">{a.symbol}</p>
                        {q ? (
                          <p className="truncate text-xs text-white/35">{q.name}</p>
                        ) : a.loading ? (
                          <p className="mt-1 h-3 w-24 animate-pulse rounded bg-white/[0.07]" />
                        ) : (
                          <p className="text-xs text-white/25">Quote unavailable</p>
                        )}
                      </td>

                      {/* Price */}
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {a.loading ? (
                          <span className="inline-block h-4 w-16 animate-pulse rounded bg-white/[0.07]" />
                        ) : q ? (
                          <span className="text-sm font-semibold tabular-nums text-white">${fmt(q.price)}</span>
                        ) : (
                          <span className="text-xs text-white/25">—</span>
                        )}
                      </td>

                      {/* Change $ */}
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right md:table-cell">
                        {q && (
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              positive ? "text-green-positive" : "text-red-negative"
                            )}
                          >
                            {positive ? "+" : "-"}${fmt(Math.abs(q.change))}
                          </span>
                        )}
                      </td>

                      {/* Change % pill */}
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {q && <ChangePill pct={changePct(q)} positive={positive} />}
                      </td>

                      {/* Open / High / Low */}
                      {(["open_price", "day_high", "day_low"] as const).map((field) => (
                        <td key={field} className="hidden whitespace-nowrap px-3 py-3 text-right lg:table-cell">
                          {q?.[field] != null ? (
                            <span className="text-sm tabular-nums text-white/55">${fmt(q[field]!)}</span>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>
                      ))}

                      {/* Mkt Cap */}
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right xl:table-cell">
                        {q?.market_cap != null ? (
                          <span className="text-sm tabular-nums text-white/55">{compact.format(q.market_cap)}</span>
                        ) : (
                          <span className="text-xs text-white/20">—</span>
                        )}
                      </td>

                      {/* Sparkline */}
                      <td className="px-3 py-2">
                        <div className="ml-auto h-9 w-24">
                          {q && q.history.length > 1 ? (
                            <Sparkline history={q.history} positive={positive} id={a.id} />
                          ) : a.loading ? (
                            <div className="h-full w-full animate-pulse rounded bg-white/[0.04]" />
                          ) : null}
                        </div>
                      </td>

                      {/* Remove */}
                      <td className="py-3 pl-1 pr-2">
                        <button
                          type="button"
                          onClick={() => removeAsset(a.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/15 opacity-0 transition-all hover:bg-white/[0.06] hover:text-red-negative focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={`Remove ${a.symbol} from ${watchlist.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="border-t border-white/[0.05]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-white/[0.04] py-3 pl-6 last:border-b-0">
          <div className="space-y-1.5">
            <div className="h-3.5 w-14 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-28 animate-pulse rounded bg-white/[0.05]" />
          </div>
          <div className="ml-auto flex items-center gap-6 pr-6">
            <div className="h-3.5 w-16 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.05]" />
            <div className="h-8 w-24 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Page header */}
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Watchlists</h1>
            <p className="mt-1 text-sm text-white/40">Track symbols across your lists with live quotes.</p>
          </div>

          <div className="ml-auto">
            {showNewForm ? (
              <div className="flex items-center gap-2">
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
                  className="h-9 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
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
            ) : (
              <Button
                onClick={() => setShowNewForm(true)}
                size="sm"
                className="theme-solid-action h-9 rounded-xl px-3.5 text-sm font-semibold"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New list
              </Button>
            )}
          </div>
        </div>

        {createError && <p className="pb-2 text-xs text-red-negative">{createError}</p>}
        {upgradeMessage && (
          <div className="pb-4">
            <UpgradePrompt message={upgradeMessage} />
          </div>
        )}

        {/* List sections */}
        {listsLoading ? (
          <div className="divide-y divide-white/[0.06]">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="py-4">
                <div className="mb-4 h-5 w-36 animate-pulse rounded bg-white/[0.07]" />
                <SkeletonRows />
              </div>
            ))}
          </div>
        ) : watchlists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-white/[0.06] py-20 text-center">
            <Star className="h-10 w-10 text-white/10" />
            <div>
              <p className="text-sm font-medium text-white/40">No watchlists yet</p>
              <p className="mt-1 text-xs text-white/20">Create a list to start tracking symbols you care about.</p>
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
          <div className="divide-y divide-white/[0.06]">
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
      </div>
    </div>
  );
}
