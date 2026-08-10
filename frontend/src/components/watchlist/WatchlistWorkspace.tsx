"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, isUpgradeRequiredError, type Alert, type MarketQuote, type Watchlist, type WatchlistAsset } from "@/lib/api";
import { fetchQuotes } from "@/lib/quote-cache";
import { cn } from "@/lib/utils";
import { marketDetailsHref } from "@/lib/market-routes";
import WatchlistMarketContext from "@/components/watchlist/WatchlistMarketContext";

type Row = WatchlistAsset & { quote: MarketQuote | null };
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function WatchlistWorkspace() {
  const { user } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("");
  const [newListName, setNewListName] = useState("");
  const [alertTarget, setAlertTarget] = useState<{ symbol: string; alert?: Alert } | null>(null);

  const loadLists = useCallback(async () => {
    if (user.is_guest) return;
    setLoading(true);
    try {
      let items = await api.watchlists();
      if (!items.length) items = [await api.createWatchlist("My Watchlist")];
      setWatchlists(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0].id);
      setAlerts(await api.alerts().catch(() => []));
    } catch (error) {
      toast.error("Watchlists are unavailable", { description: error instanceof Error ? error.message : "Try again shortly." });
    } finally {
      setLoading(false);
    }
  }, [user.is_guest]);

  useEffect(() => { void loadLists(); }, [loadLists]);
  useEffect(() => {
    if (!selectedId) return;
    let canceled = false;
    setLoading(true);
    api.watchlistAssets(selectedId)
      .then(async (assets) => {
        const quotes = await fetchQuotes(assets.map((asset) => asset.symbol), "5d", "1d");
        if (!canceled) setRows(assets.map((asset) => ({ ...asset, quote: quotes.get(asset.symbol.toUpperCase()) ?? null })));
      })
      .catch((error) => toast.error("Could not load watchlist", { description: error instanceof Error ? error.message : "Try again shortly." }))
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [selectedId]);

  const alertsBySymbol = useMemo(() => new Map(alerts.filter((alert) => alert.symbol).map((alert) => [alert.symbol!.toUpperCase(), alert])), [alerts]);

  const addSymbol = async () => {
    const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
    if (!selectedId || !normalized) return;
    if (rows.some((row) => row.symbol.toUpperCase() === normalized)) return toast.info(`${normalized} is already in this watchlist.`);
    try {
      const asset = await api.addWatchlistAsset(selectedId, normalized);
      const quotes = await fetchQuotes([normalized], "5d", "1d");
      setRows((current) => [...current, { ...asset, quote: quotes.get(normalized) ?? null }]);
      setSymbol("");
      toast.success(`${normalized} added to ${watchlists.find((item) => item.id === selectedId)?.name ?? "watchlist"}`);
    } catch (error) {
      toast.error("Could not add symbol", { description: error instanceof Error ? error.message : "Try again shortly." });
    }
  };

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const created = await api.createWatchlist(name);
      setWatchlists((current) => [...current, created]);
      setSelectedId(created.id);
      setRows([]);
      setNewListName("");
    } catch (error) {
      toast.error("Could not create watchlist", { description: error instanceof Error ? error.message : "Try again shortly." });
    }
  };

  const removeSymbol = async (row: Row) => {
    if (!selectedId) return;
    await api.removeWatchlistAsset(selectedId, row.id);
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  if (user.is_guest) return <main className="flex min-h-full items-center justify-center p-6"><div className="max-w-md text-center"><Star className="mx-auto size-9 text-indigo-primary" /><h1 className="mt-4 text-2xl font-semibold">Build your watchlists</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Sign in to save symbols, compare live market context, and create durable price alerts.</p></div></main>;

  return (
    <main className="min-h-full bg-[var(--background)] px-4 py-5 text-[var(--text-primary)] lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--theme-border)] pb-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">Monitoring</p><h1 className="mt-1 text-3xl font-semibold">Watchlists & alerts</h1></div>
          <div className="flex flex-wrap gap-2"><Input value={newListName} onChange={(event) => setNewListName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createList(); }} placeholder="New watchlist name" className="w-48 rounded-lg" /><Button variant="outline" className="rounded-lg" onClick={() => void createList()}><Plus className="size-4" /> New list</Button></div>
        </header>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Watchlists">
          {watchlists.map((watchlist) => <button key={watchlist.id} type="button" role="tab" aria-selected={selectedId === watchlist.id} onClick={() => setSelectedId(watchlist.id)} className={cn("shrink-0 rounded-lg border px-3 py-2 text-sm", selectedId === watchlist.id ? "border-indigo-primary/50 bg-indigo-primary/15 text-[var(--text-primary)]" : "border-[var(--theme-border)] text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)]")}>{watchlist.name}</button>)}
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)]" aria-labelledby="watchlist-table-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] p-4"><div className="flex min-w-0 items-center gap-2"><h2 id="watchlist-table-title" className="font-semibold">{watchlists.find((item) => item.id === selectedId)?.name ?? "Watchlist"}</h2><span aria-hidden="true" className="text-[var(--text-subtle)]">·</span><p className="text-sm text-[var(--text-muted)]">{rows.length} tracked symbols</p></div><div className="flex gap-2"><Input value={symbol} onChange={(event) => setSymbol(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addSymbol(); }} placeholder="Add symbol, e.g. AAPL" className="w-48 rounded-lg uppercase" /><Button className="theme-solid-action rounded-lg" onClick={() => void addSymbol()}><Plus className="size-4" /> Add stock</Button></div></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-[var(--surface-panel)] text-xs uppercase tracking-wide text-[var(--text-subtle)]"><tr>{["Company", "Symbol", "Price", "Change", "Market cap", "P/E ratio", "Alert", ""].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} className="h-40 text-center text-[var(--text-muted)]"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading live quotes</td></tr> : rows.length ? rows.map((row) => {
                    const quote = row.quote;
                    const alert = alertsBySymbol.get(row.symbol.toUpperCase());
                    return <tr key={row.id} className="border-t border-[var(--theme-border)] hover:bg-[var(--surface-card-hover)]"><td className="px-4 py-3 font-medium"><Link href={marketDetailsHref(row.symbol, row.asset_type)} className="hover:text-indigo-300">{quote?.name || row.symbol}</Link></td><td className="px-4 py-3 text-[var(--text-muted)]">{row.symbol}</td><td className="px-4 py-3 tabular-nums">{quote ? money.format(quote.price) : "—"}</td><td className={cn("px-4 py-3 tabular-nums", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{quote ? `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}%` : "—"}</td><td className="px-4 py-3 tabular-nums">{quote?.market_cap ? `$${compact.format(quote.market_cap)}` : "—"}</td><td className="px-4 py-3 tabular-nums">{row.asset_type === "crypto" ? "—" : quote?.pe_ratio ? quote.pe_ratio.toFixed(1) : "—"}</td><td className="px-4 py-3"><Button size="sm" variant="outline" className="rounded-lg" onClick={() => setAlertTarget({ symbol: row.symbol, alert })}><Bell className="size-3.5" />{alert ? "Edit" : "Add"}</Button></td><td className="px-4 py-3"><Button size="icon" variant="ghost" aria-label={`Remove ${row.symbol}`} className="rounded-lg text-[var(--text-muted)] hover:text-rose-300" onClick={() => void removeSymbol(row)}><Trash2 className="size-4" /></Button></td></tr>;
                  }) : <tr><td colSpan={8} className="h-44 text-center"><p className="font-medium">No symbols yet</p><p className="mt-1 text-sm text-[var(--text-muted)]">Add a ticker above to start this watchlist.</p></td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)]" aria-labelledby="alerts-title">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] p-4"><div className="flex min-w-0 items-center"><h2 id="alerts-title" className="font-semibold">Active alerts</h2></div><Button size="sm" className="theme-solid-action rounded-lg" onClick={() => setAlertTarget({ symbol: rows[0]?.symbol ?? "AAPL" })}><Plus className="size-4" /> Create</Button></div>
            <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
              {alerts.length ? alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onEdit={() => setAlertTarget({ symbol: alert.symbol || "AAPL", alert })} onDelete={async () => { await api.deleteAlert(alert.id); setAlerts((current) => current.filter((item) => item.id !== alert.id)); }} />) : <div className="py-16 text-center text-sm text-[var(--text-muted)]"><Bell className="mx-auto mb-3 size-6" />No alerts yet. Add one from a watchlist row.</div>}
            </div>
          </aside>
        </div>
        <WatchlistMarketContext watchlistQuotes={rows.flatMap((row) => row.quote ? [row.quote] : [])} />
      </div>
      <PriceAlertDialog target={alertTarget} onClose={() => setAlertTarget(null)} onSaved={(saved) => { setAlerts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setAlertTarget(null); }} />
    </main>
  );
}

function AlertCard({ alert, onEdit, onDelete }: { alert: Alert; onEdit: () => void; onDelete: () => Promise<void> }) {
  const price = Number(alert.condition.price ?? alert.condition.value ?? 0);
  const operator = alert.condition.operator === "below" ? "<" : ">";
  const cooldown = Number(alert.condition.cooldown_minutes ?? 1440);
  return <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-panel)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{alert.symbol || alert.name}</p><p className="mt-1 text-sm text-[var(--text-muted)]">Price {operator} {money.format(price)}</p></div><span className={cn("mt-1 size-2 rounded-full", alert.is_active ? "bg-emerald-400" : "bg-[var(--text-subtle)]")} /></div><div className="mt-4 flex items-center justify-between"><span className="text-xs text-[var(--text-subtle)]">{cooldown >= 1440 ? "Once per day" : cooldown >= 60 ? "Once per hour" : "Once per minute"}</span><span className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${alert.name}`} className="size-8 rounded-lg" onClick={onEdit}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${alert.name}`} className="size-8 rounded-lg hover:text-rose-300" onClick={() => void onDelete()}><Trash2 className="size-3.5" /></Button></span></div></div>;
}

function PriceAlertDialog({ target, onClose, onSaved }: { target: { symbol: string; alert?: Alert } | null; onClose: () => void; onSaved: (alert: Alert) => void }) {
  const [operator, setOperator] = useState("above");
  const [price, setPrice] = useState("");
  const [cooldown, setCooldown] = useState("1440");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!target) return; setOperator(String(target.alert?.condition.operator ?? "above")); setPrice(String(target.alert?.condition.price ?? "")); setCooldown(String(target.alert?.condition.cooldown_minutes ?? 1440)); }, [target]);
  const save = async () => {
    if (!target || !(Number(price) > 0)) return;
    setSaving(true);
    const payload = { name: `${target.symbol} ${operator} ${price}`, alert_type: "price", symbol: target.symbol, condition: { operator, price: Number(price), cooldown_minutes: Number(cooldown) }, channels: [], is_active: true };
    try {
      const saved = target.alert ? await api.updateAlert(target.alert.id, payload) : await api.createAlert(payload);
      onSaved(saved);
    } catch (error) {
      toast.error(isUpgradeRequiredError(error) ? "Alerts require a paid plan" : "Could not save alert", { description: error instanceof Error ? error.message : "Try again shortly." });
    } finally { setSaving(false); }
  };
  return <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{target?.alert ? "Edit" : "Create"} price alert</DialogTitle><DialogDescription>Quanfora will evaluate this condition durably and record each trigger.</DialogDescription></DialogHeader><div className="space-y-4 px-6 pb-6 pt-4"><label className="block text-sm font-medium">Symbol<Input value={target?.symbol ?? ""} readOnly className="mt-1 rounded-lg" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Condition<select value={operator} onChange={(event) => setOperator(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card)] px-3"><option value="above">Price above</option><option value="below">Price below</option></select></label><label className="block text-sm font-medium">Price<Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 rounded-lg" /></label></div><label className="block text-sm font-medium">Repeat<select value={cooldown} onChange={(event) => setCooldown(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card)] px-3"><option value="1">Once per minute</option><option value="60">Once per hour</option><option value="1440">Once per day</option></select></label><Button className="theme-solid-action w-full rounded-lg" disabled={saving || !(Number(price) > 0)} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />} Save alert</Button></div></DialogContent></Dialog>;
}
