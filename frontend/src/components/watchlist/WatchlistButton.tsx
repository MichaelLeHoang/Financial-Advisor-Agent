"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, type Watchlist, type WatchlistAsset } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function WatchlistButton({ symbol, className }: { symbol: string; className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [assets, setAssets] = useState<Record<string, WatchlistAsset[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || user.is_guest) return;
    let canceled = false;
    setLoading(true);
    api.watchlists()
      .then(async (items) => {
        let resolved = items;
        if (!resolved.length) resolved = [await api.createWatchlist("My Watchlist")];
        const rows = await Promise.all(resolved.map(async (watchlist) => [watchlist.id, await api.watchlistAssets(watchlist.id)] as const));
        if (!canceled) {
          setWatchlists(resolved);
          const nextAssets = Object.fromEntries(rows);
          const nextSelected = new Set(resolved.filter((watchlist) => (nextAssets[watchlist.id] ?? []).some((asset: WatchlistAsset) => asset.symbol.toUpperCase() === symbol.toUpperCase())).map((watchlist) => watchlist.id));
          setAssets(nextAssets);
          setSelectedIds(nextSelected);
          setInitialIds(new Set(nextSelected));
        }
      })
      .catch((error) => toast.error("Watchlists are unavailable", { description: error instanceof Error ? error.message : "Try again shortly." }))
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [open, symbol, user.is_guest]);

  const toggle = (watchlistId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(watchlistId)) next.delete(watchlistId);
      else next.add(watchlistId);
      return next;
    });
  };

  const hasChanges = watchlists.some((watchlist) => selectedIds.has(watchlist.id) !== initialIds.has(watchlist.id));

  const save = async () => {
    const additions = watchlists.filter((watchlist) => selectedIds.has(watchlist.id) && !initialIds.has(watchlist.id));
    const removals = watchlists.filter((watchlist) => !selectedIds.has(watchlist.id) && initialIds.has(watchlist.id));
    if (!additions.length && !removals.length) return setOpen(false);
    setSaving(true);
    try {
      const nextAssets = { ...assets };
      for (const watchlist of additions) {
        const created = await api.addWatchlistAsset(watchlist.id, symbol);
        nextAssets[watchlist.id] = [...(nextAssets[watchlist.id] ?? []), created];
      }
      for (const watchlist of removals) {
        const existing = (nextAssets[watchlist.id] ?? []).find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase());
        if (existing) await api.removeWatchlistAsset(watchlist.id, existing.id);
        nextAssets[watchlist.id] = (nextAssets[watchlist.id] ?? []).filter((asset) => asset.id !== existing?.id);
      }
      setAssets(nextAssets);
      setInitialIds(new Set(selectedIds));
      setOpen(false);
      if (additions.length) {
        const destinations = additions.map((watchlist) => watchlist.name).join(additions.length > 2 ? ", " : " and ");
        toast.success(`${symbol} added to ${destinations}`);
      } else toast.success(`${symbol} watchlists updated`);
    } catch (error) {
      toast.error("Could not update watchlist", { description: error instanceof Error ? error.message : "Try again shortly." });
    } finally { setSaving(false); }
  };

  if (user.is_guest) {
    return <Button type="button" variant="outline" className={cn("rounded-lg", className)} onClick={() => toast.info("Sign in to save symbols to a watchlist.")}><Star className="size-4" /> Add to watchlist</Button>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className={cn("theme-solid-action rounded-lg", className)} />}>
        <Star className="size-4" /> Add to watchlist
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-14">
          <DialogTitle>Add {symbol} to watchlists</DialogTitle>
          <DialogDescription>Choose one or more lists, then save your changes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-6 pb-5 pt-5">
          {loading ? <div className="flex min-h-28 items-center justify-center text-[var(--text-muted)]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading watchlists</div> : watchlists.map((watchlist) => {
            const selected = selectedIds.has(watchlist.id);
            const symbolCount = (assets[watchlist.id] ?? []).length + (selected && !initialIds.has(watchlist.id) ? 1 : !selected && initialIds.has(watchlist.id) ? -1 : 0);
            return (
              <button
                key={watchlist.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggle(watchlist.id)}
                className={cn("flex min-h-16 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", selected ? "border-indigo-primary/50 bg-indigo-primary/10" : "border-[var(--theme-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)]")}
              >
                <span><span className="block font-medium">{watchlist.name}</span><span className="text-xs text-[var(--text-muted)]">{symbolCount} {symbolCount === 1 ? "symbol" : "symbols"}</span></span>
                <span className={cn("flex size-7 items-center justify-center rounded-lg border", selected ? "border-indigo-primary bg-indigo-primary text-white" : "border-[var(--theme-border)] text-[var(--text-muted)]")}>{selected ? <Check className="size-4" /> : <Plus className="size-4" />}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col items-stretch justify-between gap-3 border-t border-[var(--theme-border)] px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-xs text-[var(--text-muted)]">{selectedIds.size ? `${selectedIds.size} ${selectedIds.size === 1 ? "watchlist" : "watchlists"} selected` : "Not saved to a watchlist"}</p>
          <div className="flex gap-2 sm:justify-end"><Button type="button" variant="ghost" className="flex-1 rounded-lg sm:flex-none" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" className="theme-solid-action flex-1 rounded-lg sm:flex-none" disabled={loading || saving || !hasChanges} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />} Save changes</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
