"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, Download, Eye, EyeOff, ListFilter, Loader2, Plus, Rows3, Search } from "lucide-react";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";
import { api } from "@/lib/api";
import { fetchCurrencyRate } from "@/lib/currency";
import { fetchQuote } from "@/lib/quote-cache";
import { cn } from "@/lib/utils";

type PurchaseMode = "amount" | "shares";
type Frequency = "daily" | "weekly" | "monthly" | "yearly";
type HoldingFilter = "all" | "needs_review" | "concentrated";
type HoldingGroup = "none" | "portfolio" | "security";

export default function InvestmentHoldingsPage() {
  const workspace = useInvestmentWorkspace();
  const { portfolios, investmentHoldings, theses, quotes, currencyRates, recurringBuys, watchlistAssets, preferences, setPreference, loading, refresh } = workspace;
  const [symbol, setSymbol] = useState("");
  const [account, setAccount] = useState("");
  const [mode, setMode] = useState<PurchaseMode>("amount");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(preferences.displayCurrency);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [time, setTime] = useState("09:30");
  const [day, setDay] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [group, setGroup] = useState<HoldingGroup>("none");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadPortfolioIds, setDownloadPortfolioIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addAverageCost, setAddAverageCost] = useState("");
  const [addCurrency, setAddCurrency] = useState(preferences.displayCurrency);
  const [addPortfolioId, setAddPortfolioId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const thesisByHolding = useMemo(() => new Map(theses.map((thesis) => [thesis.holding_id, thesis])), [theses]);
  const selectedPortfolio = preferences.portfolioScope === "all" ? portfolios[0] : portfolios.find((item) => item.id === preferences.portfolioScope) ?? portfolios[0];
  const holdings = investmentHoldings.map((record) => {
    const quote = quotes.get(record.holding.symbol.toUpperCase());
    const quoteCurrency = (quote?.currency || record.holding.cost_currency || "USD").toUpperCase();
    const value = record.holding.quantity * (quote?.price || record.holding.average_cost) * (currencyRates.get(quoteCurrency) ?? 1);
    return { record, quote, value };
  });
  const totalValue = holdings.reduce((sum, item) => sum + item.value, 0);
  const visibleHoldings = holdings.filter(({ record, value }) => {
    if (filter === "needs_review") return thesisStatus(thesisByHolding.get(record.holding.id)) !== "Healthy";
    if (filter === "concentrated") return totalValue > 0 && (value / totalValue) * 100 > 10;
    return true;
  }).sort((a, b) => group === "portfolio" ? a.record.portfolio.name.localeCompare(b.record.portfolio.name) : group === "security" ? a.record.holding.symbol.localeCompare(b.record.holding.symbol) : b.value - a.value);

  const downloadCsv = () => {
    const selected = downloadPortfolioIds.length ? holdings.filter(({ record }) => downloadPortfolioIds.includes(record.portfolio.id)) : holdings;
    const rows = [["Security", "Portfolio", "Currency", "Quantity", "Value", "Weight", "Today return", "Purpose", "Thesis"], ...selected.map(({ record, quote, value }) => [
      record.holding.symbol,
      record.portfolio.name,
      quote?.currency || record.holding.cost_currency || preferences.displayCurrency,
      String(record.holding.quantity),
      value.toFixed(2),
      (totalValue ? (value / totalValue) * 100 : 0).toFixed(2),
      ((quote?.change ?? 0) * record.holding.quantity).toFixed(2),
      "Investment",
      thesisStatus(thesisByHolding.get(record.holding.id)),
    ])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "quanfora-investment-holdings.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
  };

  const openAddHolding = () => {
    setAddPortfolioId(selectedPortfolio?.id ?? portfolios[0]?.id ?? "");
    setAddCurrency(selectedPortfolio?.base_currency ?? preferences.displayCurrency);
    setAddError(null);
    setAddOpen(true);
  };

  const addHolding = async () => {
    const ticker = addSymbol.trim().toUpperCase();
    const quantity = Number(addQuantity);
    const averageCost = Number(addAverageCost);
    if (!addPortfolioId || !ticker || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(averageCost) || averageCost <= 0) {
      setAddError("Choose a portfolio and enter a symbol, positive quantity, and positive average cost.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const holding = await api.addHolding(addPortfolioId, ticker, quantity, averageCost, addCurrency);
      try {
        await api.classifyHolding(addPortfolioId, holding.id, "investment");
      } catch (cause) {
        await api.removeHolding(addPortfolioId, holding.id).catch(() => undefined);
        throw cause;
      }
      setAddOpen(false);
      setAddSymbol("");
      setAddQuantity("");
      setAddAverageCost("");
      setNotice(`${ticker} was added to Investment Holdings.`);
      await refresh();
    } catch (cause) {
      setAddError(cause instanceof Error ? cause.message : "The holding could not be added.");
    } finally {
      setAdding(false);
    }
  };

  const recordPurchase = async () => {
    const ticker = symbol.trim().toUpperCase();
    const entered = Number(amount);
    if (!selectedPortfolio || !ticker || !Number.isFinite(entered) || entered <= 0) {
      setError("Choose a portfolio, symbol, and positive amount or share quantity.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const quote = await fetchQuote(ticker);
      if (!quote.price || quote.price <= 0) throw new Error(`A current ${ticker} price is unavailable.`);
      const fillCurrency = (quote.currency || selectedPortfolio.base_currency).toUpperCase();
      const exchangeRate = await fetchCurrencyRate(fillCurrency, currency);
      const enteredAmount = mode === "amount" ? entered : entered * quote.price * exchangeRate;
      const filledQuantity = mode === "amount" ? entered / exchangeRate / quote.price : entered;
      await api.addRecurringBuy(selectedPortfolio.id, {
        symbol: ticker,
        account: account.trim() || selectedPortfolio.name,
        status: "completed",
        purchase_mode: mode,
        entered_amount: enteredAmount,
        entered_currency: currency,
        filled_quantity: filledQuantity,
        fill_price: quote.price,
        fill_currency: fillCurrency,
        exchange_rate: exchangeRate,
        recurrence_frequency: frequency,
        schedule_time: time,
        schedule_day_of_week: frequency === "weekly" ? Number(day) : null,
        schedule_day_of_month: frequency === "monthly" || frequency === "yearly" ? Number(day) : null,
        schedule_month: frequency === "yearly" ? 1 : null,
        executed_at: new Date().toISOString(),
      });
      setNotice(`${ticker} was priced and recorded in ${selectedPortfolio.name}.`);
      setSymbol("");
      setAmount("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The completed purchase could not be recorded.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[var(--theme-bg)] px-4 py-4 text-[var(--text-primary)] lg:px-6">
      <div className="mx-auto max-w-[1720px]">
        <header className="border-b border-[var(--theme-border)] pb-4">
          <Link href="/invest" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"><ArrowLeft className="size-3.5" /> Investment overview</Link>
          <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div><h1 className="font-heading text-2xl font-semibold">Investment Holdings</h1><p className="mt-1 text-sm text-[var(--text-muted)]">{holdings.length} positions · {preferences.privacyMode ? "Values hidden" : formatMoney(totalValue, preferences.displayCurrency)}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarTip label="Filter holdings"><DropdownMenu>
                <DropdownMenuTrigger aria-label="Filter holdings" className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] hover:bg-[var(--surface-card-hover)]"><ListFilter className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="w-72 rounded-3xl p-4"><p className="px-2 pb-3 text-base font-semibold">Filter holdings</p>{([{ value: "all", label: "All positions" }, { value: "needs_review", label: "Needs thesis review" }, { value: "concentrated", label: "Above 10% weight" }] as const).map((option) => <DropdownMenuItem key={option.value} onClick={() => setFilter(option.value)} className="justify-between"><span>{option.label}</span>{filter === option.value && <Check className="size-4" />}</DropdownMenuItem>)}</DropdownMenuContent>
              </DropdownMenu></ToolbarTip>
              <ToolbarTip label="Group holdings"><DropdownMenu>
                <DropdownMenuTrigger aria-label="Group holdings" className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] hover:bg-[var(--surface-card-hover)]"><Rows3 className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="w-64 rounded-3xl p-4"><p className="px-2 pb-3 text-base font-semibold">Group by</p>{([{ value: "none", label: "No grouping" }, { value: "security", label: "Security" }, { value: "portfolio", label: "Portfolio" }] as const).map((option) => <DropdownMenuItem key={option.value} onClick={() => setGroup(option.value)} className="justify-between"><span>{option.label}</span>{group === option.value && <Check className="size-4" />}</DropdownMenuItem>)}</DropdownMenuContent>
              </DropdownMenu></ToolbarTip>
              <ToolbarTip label="Download holdings"><button type="button" aria-label="Download holdings" onClick={() => setDownloadOpen(true)} className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] hover:bg-[var(--surface-card-hover)]"><Download className="size-4" /></button></ToolbarTip>
              <ToolbarTip label="Add investment holding"><button type="button" aria-label="Add investment holding" onClick={openAddHolding} className="theme-solid-action inline-flex size-10 items-center justify-center rounded-full"><Plus className="size-4" /></button></ToolbarTip>
              <div role="tablist" aria-label="Holdings table mode" className="flex h-10 rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-1">
                {(["holdings", "watchlist"] as const).map((mode) => <button key={mode} type="button" role="tab" aria-selected={preferences.railMode === mode} onClick={() => setPreference("railMode", mode)} className={cn("rounded-full px-4 text-sm font-semibold capitalize text-[var(--text-muted)]", preferences.railMode === mode && "bg-white/[0.11] text-[var(--text-primary)]")}>{mode}</button>)}
              </div>
              <ToolbarTip label={preferences.privacyMode ? "Show portfolio values" : "Hide portfolio values"}><button type="button" aria-label="Toggle portfolio privacy" aria-pressed={preferences.privacyMode} onClick={() => setPreference("privacyMode", !preferences.privacyMode)} className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] hover:bg-[var(--surface-card-hover)]">{preferences.privacyMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></ToolbarTip>
            </div>
          </div>
        </header>

        <section className="mt-4">
          <div className="hidden overflow-hidden rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] md:block">
            <HorizontalScroll className="w-full">
              {preferences.railMode === "holdings" ? <table className="w-full min-w-[1120px] table-fixed text-xs sm:text-sm">
                <thead><tr className="border-b border-white/10 text-xs text-white/60"><th className="w-[18%] px-3 py-3 text-left font-medium">Holdings</th><th className="w-[12%] px-3 py-3 text-left font-medium">Portfolio</th><th className="w-[9%] px-3 py-3 text-left font-medium">Currency</th><th className="w-[10%] px-3 py-3 text-right font-medium">Quantity</th><th className="w-[12%] px-3 py-3 text-right font-medium">Value</th><th className="w-[9%] px-3 py-3 text-right font-medium">Weight</th><th className="w-[13%] px-3 py-3 text-right font-medium">Today&apos;s return</th><th className="w-[8%] px-3 py-3 text-left font-medium">Thesis</th><th className="w-[9%] px-3 py-3 text-left font-medium">Next review</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">{visibleHoldings.map(({ record, quote, value }) => { const thesis = thesisByHolding.get(record.holding.id); return <tr key={record.holding.id} className="group transition-colors hover:bg-white/[0.025]"><td className="px-3 py-3"><div className="flex items-center gap-3"><SymbolMark symbol={record.holding.symbol} /><div className="min-w-0"><Link href={`/invest/positions/${record.holding.symbol.toLowerCase()}`} className="font-semibold text-white hover:text-emerald-400">{record.holding.symbol}</Link><p className="truncate text-xs capitalize text-white/56">{record.holding.asset_type}</p></div></div></td><td className="px-3 py-3">{record.portfolio.name}</td><td className="px-3 py-3">{quote?.currency || record.holding.cost_currency || preferences.displayCurrency}</td><td className="px-3 py-3 text-right tabular-nums">{preferences.privacyMode ? "••••" : record.holding.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{preferences.privacyMode ? "••••" : formatMoney(value, preferences.displayCurrency)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{preferences.privacyMode ? "••••" : `${totalValue ? ((value / totalValue) * 100).toFixed(1) : "0.0"}%`}</td><td className={cn("px-3 py-3 text-right font-semibold tabular-nums", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{preferences.privacyMode ? "••••" : formatSignedMoney((quote?.change ?? 0) * record.holding.quantity, preferences.displayCurrency)}</td><td className="px-3 py-3"><Status value={thesisStatus(thesis)} /></td><td className="px-3 py-3 text-[var(--text-muted)]">{thesis?.next_review_at ? formatDate(thesis.next_review_at) : "Not scheduled"}</td></tr>; })}</tbody>
              </table> : <table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-[var(--theme-border)] bg-[var(--surface-card)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-4 font-medium">Security</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 font-medium">Currency</th><th className="px-5 py-4 text-right font-medium">Price</th><th className="px-5 py-4 text-right font-medium">Today&apos;s return</th></tr></thead><tbody>{watchlistAssets.map((asset) => { const quote = quotes.get(asset.symbol.toUpperCase()); return <tr key={asset.id} className="h-16 border-b border-[var(--theme-border)] last:border-0 hover:bg-white/[0.025]"><td className="px-5"><Link href={`/market?symbol=${encodeURIComponent(asset.symbol)}`} className="flex items-center gap-3 font-semibold"><SymbolMark symbol={asset.symbol} />{asset.symbol}</Link></td><td className="px-5"><span className="rounded-full bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-200">Saved</span></td><td className="px-5">{quote?.currency || preferences.displayCurrency}</td><td className="px-5 text-right font-semibold tabular-nums">{preferences.privacyMode ? "••••" : quote ? formatMoney(quote.price, quote.currency || preferences.displayCurrency) : "—"}</td><td className={cn("px-5 text-right font-semibold tabular-nums", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{preferences.privacyMode ? "••••" : quote ? formatSignedMoney(quote.change, quote.currency || preferences.displayCurrency) : "—"}</td></tr>; })}</tbody></table>}
            </HorizontalScroll>
          </div>
          <div className="space-y-3 md:hidden">{preferences.railMode === "holdings" ? visibleHoldings.map(({ record, quote, value }) => <Link key={record.holding.id} href={`/invest/positions/${record.holding.symbol.toLowerCase()}`} className="block rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card)] p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><SymbolMark symbol={record.holding.symbol} /><div><p className="font-semibold">{record.holding.symbol}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{record.portfolio.name} · {thesisStatus(thesisByHolding.get(record.holding.id))}</p></div></div><div className="text-right"><p className="font-semibold tabular-nums">{preferences.privacyMode ? "••••" : formatMoney(value, preferences.displayCurrency)}</p><p className={cn("mt-1 text-xs font-semibold", (quote?.change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>{preferences.privacyMode ? "••••" : formatSignedMoney((quote?.change ?? 0) * record.holding.quantity, preferences.displayCurrency)}</p></div></div></Link>) : watchlistAssets.map((asset) => { const quote = quotes.get(asset.symbol.toUpperCase()); return <Link key={asset.id} href={`/market?symbol=${encodeURIComponent(asset.symbol)}`} className="flex items-center justify-between rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card)] p-4"><div className="flex items-center gap-3"><SymbolMark symbol={asset.symbol} /><span className="font-semibold">{asset.symbol}</span></div><span className="font-semibold tabular-nums">{preferences.privacyMode ? "••••" : quote ? formatMoney(quote.price, quote.currency || preferences.displayCurrency) : "—"}</span></Link>; })}</div>
          {!loading && preferences.railMode === "holdings" && !visibleHoldings.length && <div className="rounded-lg border border-dashed border-[var(--theme-border)] py-12 text-center text-sm text-[var(--text-muted)]">No Investment positions match this filter.</div>}
          {!loading && preferences.railMode === "watchlist" && !watchlistAssets.length && <div className="rounded-lg border border-dashed border-[var(--theme-border)] py-12 text-center text-sm text-[var(--text-muted)]">No saved securities in this scope.</div>}
        </section>

        <section className="mt-6 rounded-lg border border-[var(--theme-border)] bg-[var(--surface-card)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Record recurring purchase</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Records a completed purchase and updates its linked holding. It does not schedule or execute an order.</p></div><span className="text-xs font-semibold text-[var(--text-muted)]">{recurringBuys.length} recorded</span></div>
          {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-rose-300"><CircleAlert className="size-4" />{error}</p>}
          {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 text-xs font-semibold text-[var(--text-muted)]">Symbol<div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="NVDA" className="h-11 w-full min-w-0 border border-[var(--theme-border-strong)] bg-[var(--surface-control)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-emerald-400/30" /></div></label>
            <Field label="Account"><input value={account} onChange={(event) => setAccount(event.target.value)} placeholder={selectedPortfolio?.name || "Portfolio"} className={inputClass} /></Field>
            <div><span className="text-xs font-semibold text-[var(--text-muted)]">Entry type</span><div role="group" aria-label="Purchase entry type" className="mt-2 flex h-11 rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-1">{(["amount", "shares"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setAmount(""); }} className={cn("flex-1 rounded-full text-xs font-semibold capitalize", mode === value && "bg-white text-black")}>{value}</button>)}</div></div>
            <Field label={mode === "amount" ? "Completed amount" : "Completed shares"}><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={mode === "amount" ? "250.00" : "1.5"} className={inputClass} /></Field>
            <Field label="Currency"><WorkspaceSelectMenu ariaLabel="Purchase currency" value={currency} options={[preferences.displayCurrency, "USD", "CAD", "EUR", "GBP"].filter((value, index, values) => values.indexOf(value) === index).map((value) => ({ value, label: value }))} onValueChange={setCurrency} className="h-11 w-full rounded-lg" /></Field>
            <Field label="Original cadence"><WorkspaceSelectMenu ariaLabel="Purchase cadence" value={frequency} options={(["daily", "weekly", "monthly", "yearly"] as const).map((value) => ({ value, label: capitalize(value) }))} onValueChange={(value) => setFrequency(value as Frequency)} className="h-11 w-full rounded-lg" /></Field>
            <Field label="Original time"><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={cn(inputClass, "[color-scheme:dark]")} /></Field>
            {(frequency === "weekly" || frequency === "monthly" || frequency === "yearly") && <Field label={frequency === "weekly" ? "Original weekday" : "Original day"}>{frequency === "weekly" ? <WorkspaceSelectMenu ariaLabel="Purchase weekday" value={day} options={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, index) => ({ value: String(index), label: name }))} onValueChange={setDay} className="h-11 w-full rounded-lg" /> : <input type="number" min="1" max="31" value={day} onChange={(event) => setDay(event.target.value)} className={inputClass} />}</Field>}
            <div className="flex items-end sm:col-span-2 lg:col-span-4 lg:justify-end"><button type="button" onClick={() => void recordPurchase()} disabled={saving || !selectedPortfolio || !symbol || !amount} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-45 sm:w-auto">{saving ? <Loader2 className="size-4 animate-spin" /> : null}{saving ? "Recording…" : "Price & record"}</button></div>
          </div>
        </section>

        <section className="mt-8"><h2 className="text-xl font-semibold">Recorded purchases</h2><div className="mt-4 divide-y divide-[var(--theme-border)] border-y border-[var(--theme-border)]">{recurringBuys.slice(0, 10).map((buy) => <div key={buy.id} className="grid gap-1 py-4 text-sm sm:grid-cols-[100px_1fr_auto_auto] sm:items-center"><time className="text-[var(--text-muted)]">{formatDate(buy.executed_at)}</time><span className="font-semibold">{buy.symbol}</span><span>{preferences.privacyMode ? "•••• shares" : `${buy.filled_quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares`}</span><span className="font-semibold tabular-nums">{preferences.privacyMode ? "••••" : formatMoney(buy.entered_amount, buy.entered_currency)}</span></div>)}{!recurringBuys.length && <p className="py-8 text-center text-sm text-[var(--text-muted)]">No completed recurring purchases recorded yet.</p>}</div></section>
      </div>

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="border-b border-[var(--theme-border)] px-7 pb-5 pt-7"><DialogTitle className="text-2xl">Download holdings</DialogTitle><DialogDescription>Select the Investment accounts to include in the CSV export.</DialogDescription></DialogHeader>
          <div className="overflow-y-auto px-7 py-5">
            <label className="flex h-12 cursor-pointer items-center justify-between border-b border-[var(--theme-border)] text-sm font-semibold"><span>All accounts</span><input type="checkbox" checked={downloadPortfolioIds.length === 0} onChange={() => setDownloadPortfolioIds([])} className="size-5 rounded accent-emerald-400" /></label>
            {portfolios.map((portfolio) => <label key={portfolio.id} className="flex h-12 cursor-pointer items-center justify-between border-b border-[var(--theme-border)] text-sm font-semibold last:border-0"><span>{portfolio.name}</span><input type="checkbox" checked={downloadPortfolioIds.includes(portfolio.id)} onChange={() => setDownloadPortfolioIds((current) => current.includes(portfolio.id) ? current.filter((id) => id !== portfolio.id) : [...current, portfolio.id])} className="size-5 rounded accent-emerald-400" /></label>)}
          </div>
          <div className="flex justify-center border-t border-[var(--theme-border)] px-7 py-5"><button type="button" onClick={downloadCsv} disabled={!holdings.length} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black disabled:opacity-45"><Download className="size-4" /> Download CSV</button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="border-b border-[var(--theme-border)] px-6 pb-4 pt-6"><DialogTitle className="text-xl">Add investment holding</DialogTitle><DialogDescription>Record a stock position in an existing portfolio. This does not place a trade.</DialogDescription></DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Symbol<input autoFocus value={addSymbol} onChange={(event) => setAddSymbol(event.target.value.toUpperCase())} placeholder="AAPL" className={inputClass} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Portfolio<WorkspaceSelectMenu ariaLabel="Holding portfolio" value={addPortfolioId} options={portfolios.map((portfolio) => ({ value: portfolio.id, label: portfolio.name }))} onValueChange={setAddPortfolioId} className="mt-2 h-11 w-full rounded-lg" /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Quantity<input type="number" min="0" step="any" value={addQuantity} onChange={(event) => setAddQuantity(event.target.value)} placeholder="10" className={inputClass} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)]">Average cost<input type="number" min="0" step="any" value={addAverageCost} onChange={(event) => setAddAverageCost(event.target.value)} placeholder="175.00" className={inputClass} /></label>
            <label className="text-xs font-semibold text-[var(--text-muted)] sm:col-span-2">Cost currency<WorkspaceSelectMenu ariaLabel="Holding cost currency" value={addCurrency} options={[preferences.displayCurrency, "USD", "CAD", "EUR", "GBP"].filter((value, index, values) => values.indexOf(value) === index).map((value) => ({ value, label: value }))} onValueChange={setAddCurrency} className="mt-2 h-11 w-full rounded-lg" /></label>
            {addError && <p role="alert" className="text-sm text-rose-300 sm:col-span-2">{addError}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-6 py-4"><button type="button" onClick={() => setAddOpen(false)} className="h-10 rounded-full px-4 text-sm font-semibold hover:bg-[var(--surface-card-hover)]">Cancel</button><button type="button" onClick={() => void addHolding()} disabled={adding || !portfolios.length} className="theme-solid-action inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-45">{adding && <Loader2 className="size-4 animate-spin" />}{adding ? "Adding…" : "Add holding"}</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputClass = "mt-2 h-11 w-full min-w-0 rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-emerald-400/30";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="min-w-0 text-xs font-semibold text-[var(--text-muted)]">{label}{children}</label>; }
function ToolbarTip({ label, children }: { label: string; children: React.ReactNode }) { return <span className="group relative inline-flex">{children}<span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--theme-border)] bg-[var(--surface-popover)] px-2 py-1 text-[10px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-popover)] group-hover:block group-focus-within:block">{label}</span></span>; }
function SymbolMark({ symbol }: { symbol: string }) { const colors = ["bg-cyan-400/20 text-cyan-200", "bg-emerald-400/20 text-emerald-200", "bg-indigo-400/20 text-indigo-200", "bg-amber-400/20 text-amber-100"]; const index = symbol.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length; return <span aria-hidden="true" className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", colors[index])}>{symbol.slice(0, 4)}</span>; }
function Status({ value }: { value: string }) { return <span className={cn("text-xs font-semibold", value === "Healthy" ? "text-emerald-400" : value === "Invalidated" ? "text-rose-400" : "text-amber-300")}>{value}</span>; }
function thesisStatus(thesis?: { status: string; next_review_at?: string | null }) { if (!thesis) return "Missing"; if (thesis.status === "invalidated") return "Invalidated"; if (thesis.status === "needs_review" || (thesis.next_review_at && new Date(thesis.next_review_at) < new Date())) return "Needs review"; return "Healthy"; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0); }
function formatSignedMoney(value: number, currency: string) { return `${value >= 0 ? "+" : "-"}${formatMoney(Math.abs(value), currency)}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
