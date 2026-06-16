"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Pencil, Trash2, X } from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Holding, OptimizeResult, Portfolio } from "@/lib/api";
import { fetchQuote } from "@/lib/quote-cache";
import { useAuth } from "@/components/auth/AuthProvider";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { ThinSlider } from "@/components/ui/thin-slider";
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
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#fb923c",
  "#38bdf8",
  "#4ade80",
  "#e879f9",
];

const SUPPORTED_BASE_CURRENCIES = ["USD", "CAD"] as const;

interface HoldingRow extends Holding {
  quoteCurrency: string | null;
  baseCurrency: string | null;
  currentPrice: number | null;
  convertedPrice: number | null;
  fxRate: number | null;
  originalValue: number | null;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

// Inline edit state for a single holding
interface EditState {
  holdingId: string;
  field: "quantity" | "average_cost";
  draft: string;
  currency: string;
  saving: boolean;
}

function normalizeCurrency(currency: string | null | undefined, fallback = "USD") {
  return (currency || fallback).trim().toUpperCase();
}

function formatMoney(value: number, currency: string | null | undefined, digits = 2) {
  const normalized = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalized,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${normalized} ${value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}

function formatPrivateMoney(value: number, currency: string | null | undefined, hidden: boolean, digits = 2) {
  return hidden ? "••••••" : formatMoney(value, currency, digits);
}

async function convertAmount(amount: number, sourceCurrency: string, targetCurrency: string) {
  const rate = await fetchCurrencyRate(sourceCurrency, targetCurrency);
  return amount * rate;
}

async function fetchCurrencyRate(sourceCurrency: string, targetCurrency: string): Promise<number> {
  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);
  if (source === target) return 1;

  if (source === "USD" && target === "CAD") {
    try {
      const quote = await fetchQuote("CAD=X", "1d", "1d");
      return quote.price || 1;
    } catch {
      return 1;
    }
  }

  if (source === "CAD" && target === "USD") {
    try {
      const quote = await fetchQuote("CAD=X", "1d", "1d");
      return quote.price ? 1 / quote.price : 1;
    } catch {
      return 1;
    }
  }

  try {
    const direct = await fetchQuote(`${source}${target}=X`, "1d", "1d");
    if (direct.price) return direct.price;
  } catch {
    // Fall through to the inverse pair below.
  }

  try {
    const inverse = await fetchQuote(`${target}${source}=X`, "1d", "1d");
    if (inverse.price) return 1 / inverse.price;
  } catch {
    // Keep the portfolio usable if an uncommon FX pair is unavailable.
  }

  return 1;
}

function emptyMetrics(baseCurrency: string): Pick<
  HoldingRow,
  "quoteCurrency" | "baseCurrency" | "currentPrice" | "convertedPrice" | "fxRate" | "originalValue" | "value" | "pnl" | "pnlPct"
> {
  return {
    quoteCurrency: null,
    baseCurrency,
    currentPrice: null,
    convertedPrice: null,
    fxRate: null,
    originalValue: null,
    value: null,
    pnl: null,
    pnlPct: null,
  };
}

function computeMetrics(
  h: HoldingRow,
  price: number | null,
  quoteCurrency: string | null | undefined,
  baseCurrency: string | null | undefined,
  fxRate = 1
) {
  const base = normalizeCurrency(baseCurrency);
  const quote = normalizeCurrency(quoteCurrency, base);
  if (price == null) return emptyMetrics(base);

  const convertedPrice = price * fxRate;
  const originalValue = h.quantity * price;
  const value = h.quantity * convertedPrice;
  const costBasis = h.quantity * h.average_cost;
  const pnl = value - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return {
    quoteCurrency: quote,
    baseCurrency: base,
    currentPrice: price,
    convertedPrice,
    fxRate,
    originalValue,
    value,
    pnl,
    pnlPct,
  };
}

export default function PortfolioPage() {
  const { loading: authLoading, token } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newBaseCurrency, setNewBaseCurrency] = useState<(typeof SUPPORTED_BASE_CURRENCIES)[number]>("USD");
  const [showNewForm, setShowNewForm] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [addSymbol, setAddSymbol] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addCostCurrency, setAddCostCurrency] = useState<(typeof SUPPORTED_BASE_CURRENCIES)[number]>("USD");
  const [hideAmounts, setHideAmounts] = useState(false);
  const [mode, setMode] = useState<"classical" | "quantum">("classical");
  const [risk, setRisk] = useState(1.0);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [portfoliosLoading, setPortfoliosLoading] = useState(true);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;
  const activeBaseCurrency = normalizeCurrency(activePortfolio?.base_currency);
  const canLoadPortfolioData = !authLoading || Boolean(token);

  useEffect(() => {
    setAddCostCurrency(activeBaseCurrency as (typeof SUPPORTED_BASE_CURRENCIES)[number]);
  }, [activeBaseCurrency]);

  useEffect(() => {
    try {
      setHideAmounts(localStorage.getItem("portfolio.hideAmounts") === "true");
    } catch {
      setHideAmounts(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("portfolio.hideAmounts", String(hideAmounts));
    } catch {
      // Privacy preference persistence is best effort.
    }
  }, [hideAmounts]);

  useEffect(() => {
    if (!canLoadPortfolioData) return;
    let cancelled = false;
    setPortfoliosLoading(true);
    setError(null);
    api.portfolios()
      .then((list) => {
        if (cancelled) return;
        setPortfolios(list);
        setActiveId(list[0]?.id ?? null);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPortfoliosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadPortfolioData, token]);

  // Fetch live prices using the shared cache
  const fetchPricesForHoldings = useCallback((list: Holding[], baseCurrency: string) => {
    const normalizedBase = normalizeCurrency(baseCurrency);
    const symbols = [...new Set(list.map((h) => h.symbol))];

    void Promise.allSettled(
      symbols.map(async (sym) => {
        const quote = await fetchQuote(sym);
        const quoteCurrency = normalizeCurrency(quote.currency, normalizedBase);
        const fxRate = await fetchCurrencyRate(quoteCurrency, normalizedBase);
        return { sym, price: quote.price, quoteCurrency, fxRate };
      })
    ).then((results) => {
      const quotes = new Map<string, { price: number; quoteCurrency: string; fxRate: number }>();
      results.forEach((result) => {
        if (result.status === "fulfilled") quotes.set(result.value.sym, result.value);
      });
      if (quotes.size === 0) return;

      setHoldings((prev) =>
        prev.map((h) => {
          const quote = quotes.get(h.symbol);
          if (!quote) return h;
          if (normalizeCurrency(h.baseCurrency, normalizedBase) !== normalizedBase) return h;
          return {
            ...h,
            ...computeMetrics(h, quote.price, quote.quoteCurrency, normalizedBase, quote.fxRate),
          };
        })
      );
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setHoldings([]);
    setResult(null);
    setHoldingsLoading(true);

    api.portfolioHoldings(activeId)
      .then((list) => {
        const rows: HoldingRow[] = list.map((h) => ({
          ...h,
          ...emptyMetrics(activeBaseCurrency),
        }));
        setHoldings(rows);
        setHoldingsLoading(false);
        fetchPricesForHoldings(list, activeBaseCurrency);
      })
      .catch(() => setHoldingsLoading(false));
  }, [activeId, activeBaseCurrency, fetchPricesForHoldings]);

  const createPortfolio = async () => {
    const name = newPortfolioName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const p = await api.createPortfolio(name, newBaseCurrency);
      const updated = [...portfolios, p];
      setPortfolios(updated);
      setActiveId(p.id);
      setNewPortfolioName("");
      setNewBaseCurrency("USD");
      setShowNewForm(false);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePortfolio = async (portfolioId: string) => {
    try {
      await api.deletePortfolio(portfolioId);
      const updated = portfolios.filter((p) => p.id !== portfolioId);
      setPortfolios(updated);
      if (activeId === portfolioId) {
        setActiveId(updated.length > 0 ? updated[0].id : null);
        setHoldings([]);
        setResult(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addHolding = async () => {
    if (!activeId) return;
    const qty = parseFloat(addQty);
    const cost = parseFloat(addCost);
    if (!addSymbol.trim() || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      setError("Enter a valid symbol, positive quantity, and positive average cost.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const costInBase = await convertAmount(cost, addCostCurrency, activeBaseCurrency);
      const holding = await api.addHolding(activeId, addSymbol.toUpperCase(), qty, costInBase);
      const row: HoldingRow = { ...holding, ...emptyMetrics(activeBaseCurrency) };
      setHoldings((prev) => [...prev, row]);
      setTickerInput("");
      setAddSymbol("");
      setAddQty("");
      setAddCost("");
      setAddCostCurrency(activeBaseCurrency as (typeof SUPPORTED_BASE_CURRENCIES)[number]);

      fetchQuote(holding.symbol)
        .then(async (quote) => {
          const quoteCurrency = normalizeCurrency(quote.currency, activeBaseCurrency);
          const fxRate = await fetchCurrencyRate(quoteCurrency, activeBaseCurrency);
          setHoldings((prev) =>
            prev.map((h) => {
              if (h.id !== holding.id) return h;
              return {
                ...h,
                ...computeMetrics(h, quote.price, quoteCurrency, activeBaseCurrency, fxRate),
              };
            })
          );
        })
        .catch(() => {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeHolding = async (holdingId: string) => {
    if (!activeId) return;
    try {
      await api.removeHolding(activeId, holdingId);
      setHoldings((prev) => prev.filter((h) => h.id !== holdingId));
      setResult(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Inline editing ────────────────────────────────────────
  const startEdit = (holdingId: string, field: "quantity" | "average_cost", current: number) => {
    setEdit({ holdingId, field, draft: String(current), currency: activeBaseCurrency, saving: false });
    // focus happens after render via useEffect below
  };

  useEffect(() => {
    if (edit && !edit.saving) editRef.current?.focus();
  }, [edit]);

  const commitEdit = async () => {
    if (!edit || !activeId) return;
    const val = parseFloat(edit.draft);
    if (isNaN(val) || val <= 0) { cancelEdit(); return; }

    const h = holdings.find((r) => r.id === edit.holdingId);
    if (!h) { cancelEdit(); return; }

    const savedValue = edit.field === "average_cost"
      ? await convertAmount(val, edit.currency, activeBaseCurrency)
      : val;

    // Optimistically update UI immediately
    const patch = { [edit.field]: savedValue } as { quantity?: number; average_cost?: number };
    setHoldings((prev) =>
      prev.map((r) => {
        if (r.id !== edit.holdingId) return r;
        const updated = { ...r, ...patch };
        return {
          ...updated,
          ...computeMetrics(
            updated,
            updated.currentPrice,
            updated.quoteCurrency,
            updated.baseCurrency ?? activeBaseCurrency,
            updated.fxRate ?? 1
          ),
        };
      })
    );
    setEdit((e) => e ? { ...e, saving: true } : null);

    try {
      await api.updateHolding(activeId, edit.holdingId, patch);
    } catch (e: any) {
      // Rollback on error
      setHoldings((prev) =>
        prev.map((r) => (r.id === edit.holdingId ? h : r))
      );
      setError(e.message);
    } finally {
      setEdit(null);
    }
  };

  const cancelEdit = () => setEdit(null);

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  const optimize = async () => {
    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    if (symbols.length < 2) {
      setError("Add at least 2 holdings to run optimization.");
      return;
    }
    setOptimizing(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.optimize(symbols, mode, risk));
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setError(e.message);
    } finally {
      setOptimizing(false);
    }
  };

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.average_cost, 0);
  const totalPnl = totalValue > 0 ? totalValue - totalCost : null;
  const totalPnlPct = totalCost > 0 && totalPnl != null ? (totalPnl / totalCost) * 100 : null;
  const pricedHoldingCount = holdings.filter((h) => h.value != null).length;
  const canShowAccountSummary = holdings.length > 0;

  const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol))];

  const allocationData = useMemo(() => {
    const bySymbol: Record<string, number> = {};
    for (const h of holdings) {
      bySymbol[h.symbol] = (bySymbol[h.symbol] ?? 0) + (h.value ?? h.quantity * h.average_cost);
    }
    return Object.entries(bySymbol).map(([symbol, value], i) => ({
      symbol,
      value,
      fill: PALETTE[i % PALETTE.length],
    }));
  }, [holdings]);

  const crossCurrencyCount = holdings.filter(
    (h) => h.quoteCurrency && normalizeCurrency(h.quoteCurrency) !== activeBaseCurrency
  ).length;
  const topWeight = totalValue > 0
    ? Math.max(...allocationData.map((d) => (d.value / totalValue) * 100), 0)
    : 0;
  const portfolioBadges = [
    activeBaseCurrency,
    `${holdings.length} holding${holdings.length !== 1 ? "s" : ""}`,
    `${uniqueSymbols.length} symbol${uniqueSymbols.length !== 1 ? "s" : ""}`,
    crossCurrencyCount > 0 ? `${crossCurrencyCount} FX converted` : null,
    totalValue > 0 ? (topWeight >= 50 ? "Concentrated" : "Balanced") : null,
  ].filter((badge): badge is string => Boolean(badge));

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    allocationData.forEach((d) => { cfg[d.symbol] = { label: d.symbol, color: d.fill }; });
    return cfg;
  }, [allocationData]);

  const colorForSymbol = (symbol: string) =>
    allocationData.find((d) => d.symbol === symbol)?.fill ?? PALETTE[0];

  const optimizerPieData = result?.weights
    ? Object.entries(result.weights)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({
          name,
          value: Math.round(value * 1000) / 10,
          fill: PALETTE[i % PALETTE.length],
        }))
    : [];

  const optimizerChartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    optimizerPieData.forEach((d) => { cfg[d.name] = { label: d.name, color: d.fill }; });
    return cfg;
  }, [optimizerPieData]);

  // ── Inline editable cell ──────────────────────────────────
  function EditableCell({
    holdingId,
    field,
    value,
    format,
  }: {
    holdingId: string;
    field: "quantity" | "average_cost";
    value: number;
    format: (v: number) => string;
  }) {
    const isEditing = edit?.holdingId === holdingId && edit.field === field;

    if (isEditing) {
      return (
        <span className="flex flex-wrap items-center justify-end gap-1">
          <input
            ref={editRef}
            type="number"
            min="0"
            step="any"
            value={edit.draft}
            onChange={(e) => setEdit((prev) => prev ? { ...prev, draft: e.target.value } : null)}
            onKeyDown={handleEditKey}
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.parentElement?.contains(nextTarget)) return;
              commitEdit();
            }}
            className="w-20 rounded-lg border border-indigo-primary/50 bg-white/[0.06] px-2 py-0.5 text-right text-xs text-white tabular-nums focus:outline-none"
          />
          {field === "average_cost" && (
            <select
              value={edit.currency}
              onChange={(event) => setEdit((prev) => prev ? { ...prev, currency: event.target.value } : null)}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (nextTarget && event.currentTarget.parentElement?.contains(nextTarget)) return;
                commitEdit();
              }}
              className="h-6 rounded-lg border border-white/[0.08] bg-slate-950 px-1.5 text-[11px] font-semibold text-white focus:border-indigo-primary/50 focus:outline-none"
              aria-label="Average cost currency"
            >
              {SUPPORTED_BASE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          )}
          {edit.saving && <Loader2 className="h-3 w-3 animate-spin text-white/30" />}
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => startEdit(holdingId, field, value)}
        className="group/cell flex items-center justify-end gap-1.5 tabular-nums text-white/65 transition-colors hover:text-white"
        title={`Click to edit ${field === "quantity" ? "quantity" : "average cost"}`}
      >
        <span>{format(value)}</span>
        <Pencil className="h-3 w-3 opacity-0 text-white/30 transition-opacity group-hover/cell:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Portfolio</h1>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

        {/* Portfolio tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {portfoliosLoading ? (
            <>
              <div className="h-9 w-28 animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-9 w-24 animate-pulse rounded-xl bg-white/[0.04]" />
            </>
          ) : portfolios.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group flex items-center gap-1 rounded-xl pl-4 pr-2 py-1.5 text-sm font-medium transition-colors",
                activeId === p.id
                  ? "bg-indigo-primary text-white shadow-[0_0_16px_rgba(99,102,241,0.3)]"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/[0.09] hover:text-white"
              )}
            >
              <button onClick={() => setActiveId(p.id)} className="flex-1 text-left">
                {p.name}
              </button>
              <AlertDialog>
                <AlertDialogTrigger
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-all",
                    activeId === p.id
                      ? "text-white/50 opacity-0 hover:bg-white/15 hover:text-white group-hover:opacity-100"
                      : "text-white/30 opacity-0 hover:bg-white/10 hover:text-red-negative group-hover:opacity-100"
                  )}
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{p.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the portfolio and all its holdings. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deletePortfolio(p.id)}
                      className="bg-red-negative text-white hover:bg-red-negative/85"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}

          {!portfoliosLoading && showNewForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createPortfolio();
                  if (e.key === "Escape") setShowNewForm(false);
                }}
                placeholder="Portfolio name"
                autoFocus
                className="h-9 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
              />
              <select
                value={newBaseCurrency}
                onChange={(e) => setNewBaseCurrency(e.target.value as (typeof SUPPORTED_BASE_CURRENCIES)[number])}
                className="h-9 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-sm font-medium text-white focus:border-indigo-primary/50 focus:outline-none"
                aria-label="Portfolio base currency"
              >
                {SUPPORTED_BASE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency} className="bg-slate-950 text-white">
                    {currency}
                  </option>
                ))}
              </select>
              <Button
                onClick={createPortfolio}
                disabled={saving || !newPortfolioName.trim()}
                size="sm"
                className="on-accent accent-gradient-surface h-9 rounded-xl px-3 text-xs font-semibold"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
              <button onClick={() => setShowNewForm(false)} className="text-sm text-white/30 hover:text-white">✕</button>
            </div>
          ) : !portfoliosLoading ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="rounded-xl border border-dashed border-white/[0.10] px-3 py-2 text-sm text-white/35 transition-colors hover:border-white/20 hover:text-white/60"
            >
              + New portfolio
            </button>
          ) : null}
        </div>

        {/* Holdings section */}
        {portfoliosLoading ? (
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-xl bg-white/[0.035]" />
              ))}
            </div>
          </section>
        ) : activePortfolio ? (
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-white">{activePortfolio.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {portfolioBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/55"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setHideAmounts((value) => !value)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-semibold text-white/60 transition-colors hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                  aria-pressed={hideAmounts}
                  aria-label={hideAmounts ? "Show money amounts" : "Hide money amounts"}
                >
                  {hideAmounts ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {hideAmounts ? "Hidden" : "Hide"}
                </button>
                {totalValue > 0 && totalPnl != null && (
                  <div className="text-right">
                    <p className="text-base font-bold text-white">
                      {formatPrivateMoney(totalValue, activeBaseCurrency, hideAmounts)}
                    </p>
                    <p className={cn("text-xs font-medium", totalPnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                      {totalPnl >= 0 ? "+" : ""}
                      {formatMoney(Math.abs(totalPnl), activeBaseCurrency)}
                      {" "}({totalPnlPct! >= 0 ? "+" : ""}{totalPnlPct!.toFixed(2)}%)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {canShowAccountSummary && (
              <div className="grid gap-px border-b border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
                <div className="bg-[#090b12] px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-white/32">Overall holdings</p>
                  <p className="mt-1 text-lg font-semibold text-white">{holdings.length}</p>
                  <p className="text-xs text-white/35">{pricedHoldingCount}/{holdings.length} priced live</p>
                </div>
                <div className="bg-[#090b12] px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-white/32">Market value</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatPrivateMoney(totalValue, activeBaseCurrency, hideAmounts)}
                  </p>
                  <p className="text-xs text-white/35">Converted to {activeBaseCurrency}</p>
                </div>
                <div className="bg-[#090b12] px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-white/32">Cost basis</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatPrivateMoney(totalCost, activeBaseCurrency, hideAmounts)}
                  </p>
                  <p className="text-xs text-white/35">Average cost is stored in base currency</p>
                </div>
                <div className="bg-[#090b12] px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-white/32">Unrealized P&amp;L</p>
                  {totalPnl != null ? (
                    <>
                      <p className={cn("mt-1 text-lg font-semibold", totalPnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                        {totalPnl >= 0 ? "+" : ""}
                        {formatMoney(Math.abs(totalPnl), activeBaseCurrency)}
                      </p>
                      <p className={cn("text-xs font-medium", totalPnl >= 0 ? "text-green-positive/80" : "text-red-negative/80")}>
                        {totalPnlPct! >= 0 ? "+" : ""}{totalPnlPct!.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-lg font-semibold text-white/25">—</p>
                  )}
                </div>
              </div>
            )}

            {crossCurrencyCount > 0 && (
              <div className="border-b border-white/[0.06] bg-cyan-secondary/[0.06] px-5 py-3 text-xs leading-relaxed text-white/55">
                P&amp;L compares live market value converted into {activeBaseCurrency} against average cost stored in {activeBaseCurrency}. For holdings such as CAD-listed tickers, enter or edit average cost with the matching currency selector so the stored cost basis aligns with your account statement.
              </div>
            )}

            {holdingsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/30">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading holdings…
              </div>
            ) : holdings.length > 0 ? (
              <div className="flex flex-col md:flex-row">
                {/* Holdings table */}
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-xs text-white/30">
                        <th className="px-5 py-3 text-left font-medium">Symbol</th>
                        <th className="border-l border-white/[0.06] px-4 py-3 text-right font-medium">
                          <span className="flex items-center justify-end gap-1">
                            Qty
                            <Pencil className="h-3 w-3 opacity-40" />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          <span className="flex items-center justify-end gap-1">
                            Avg Cost
                            <Pencil className="h-3 w-3 opacity-40" />
                          </span>
                        </th>
                        <th className="border-l border-white/[0.06] px-4 py-3 text-right font-medium">Price</th>
                        <th className="px-4 py-3 text-right font-medium">Value</th>
                        <th className="border-l border-white/[0.06] px-4 py-3 text-right font-medium">P&amp;L</th>
                        <th className="w-10 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {holdings.map((h) => {
                        const quoteCurrency = normalizeCurrency(h.quoteCurrency, activeBaseCurrency);
                        const isConverted = quoteCurrency !== activeBaseCurrency;
                        const rowWeight = totalValue > 0 && h.value != null ? (h.value / totalValue) * 100 : 0;

                        return (
                          <tr key={h.id} className="group transition-colors hover:bg-white/[0.02]">
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: colorForSymbol(h.symbol) }}
                                />
                                <span className="font-semibold text-white">{h.symbol}</span>
                              </span>
                            </td>
                            <td className="border-l border-white/[0.06] px-4 py-3 text-right">
                              <EditableCell
                                holdingId={h.id}
                                field="quantity"
                                value={h.quantity}
                                format={(v) => String(v)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <EditableCell
                                holdingId={h.id}
                                field="average_cost"
                                value={h.average_cost}
                                format={(v) => formatPrivateMoney(v, activeBaseCurrency, hideAmounts)}
                              />
                              <p className="mt-1 text-[10px] text-white/25">stored {activeBaseCurrency}</p>
                            </td>
                            <td className="border-l border-white/[0.06] px-4 py-3 text-right tabular-nums">
                              {h.currentPrice != null ? (
                                <div className="space-y-0.5">
                                  <p className="text-white/70">{formatPrivateMoney(h.currentPrice, quoteCurrency, hideAmounts)}</p>
                                  {isConverted && h.convertedPrice != null && (
                                    <p className="text-[11px] text-white/35">
                                      {formatPrivateMoney(h.convertedPrice, activeBaseCurrency, hideAmounts)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="animate-pulse text-white/20">·····</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {h.value != null ? (
                                <div className="space-y-1.5">
                                  <div>
                                    <p className="text-white/70">{formatPrivateMoney(h.value, activeBaseCurrency, hideAmounts)}</p>
                                    {isConverted && h.originalValue != null && (
                                      <p className="text-[11px] text-white/35">
                                        {formatPrivateMoney(h.originalValue, quoteCurrency, hideAmounts)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                                      <div
                                        className="h-full rounded-full transition-[width] duration-300"
                                        style={{
                                          width: `${Math.min(rowWeight, 100)}%`,
                                          backgroundColor: colorForSymbol(h.symbol),
                                        }}
                                      />
                                    </div>
                                    <span className="w-10 text-right text-[11px] tabular-nums text-white/40">
                                      {rowWeight.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ) : "—"}
                            </td>
                            <td
                              className={cn(
                                "border-l border-white/[0.06] px-4 py-3 text-right tabular-nums font-medium",
                                h.pnl == null ? "text-white/20" : h.pnl >= 0 ? "text-green-positive" : "text-red-negative"
                              )}
                            >
                              {h.pnl != null ? (
                                <>
                                  {h.pnl >= 0 ? "+" : ""}
                                  {formatMoney(Math.abs(h.pnl), activeBaseCurrency)}
                                  <span className="ml-1 text-xs opacity-70">
                                    ({h.pnlPct! >= 0 ? "+" : ""}{h.pnlPct!.toFixed(1)}%)
                                  </span>
                                </>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                onClick={() => removeHolding(h.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 opacity-0 transition-all hover:bg-white/[0.06] hover:text-red-negative group-hover:opacity-100"
                                aria-label={`Remove ${h.symbol}`}
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

                {/* Allocation chart */}
                <div className="flex shrink-0 flex-col items-center justify-center gap-4 border-t border-white/[0.04] p-6 md:w-64 md:border-l md:border-t-0">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/30">Allocation</p>
                  <ChartContainer config={chartConfig} className="h-[180px] w-[180px]">
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => (
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">{name}</span>
                                <span className="text-white/55">
                                  {totalValue > 0
                                    ? `${(((value as number) / totalValue) * 100).toFixed(1)}%`
                                    : "—"}
                                </span>
                              </span>
                            )}
                            hideLabel
                          />
                        }
                      />
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="symbol"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {allocationData.map((entry) => (
                          <Cell key={entry.symbol} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="w-full space-y-2">
                    {allocationData.map((d) => {
                      const pct = totalValue > 0 ? (d.value / totalValue) * 100 : 0;
                      return (
                        <div key={d.symbol} className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="flex-1 truncate text-xs font-medium text-white/70">{d.symbol}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                            </div>
                            <span className="w-9 text-right text-xs tabular-nums text-white/40">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-white/30">
                No holdings yet. Add your first position below.
              </p>
            )}

            {/* Add holding form */}
            <div className="border-t border-white/[0.06] px-5 py-4">
              {error && <p className="mb-3 text-xs text-red-negative">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {addSymbol ? (
                  <span className="flex h-9 items-center gap-1.5 rounded-xl bg-indigo-primary/15 px-3 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/20">
                    {addSymbol}
                    <button
                      type="button"
                      onClick={() => setAddSymbol("")}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                      aria-label="Clear ticker"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <TickerSuggestionInput
                    value={tickerInput}
                    onValueChange={setTickerInput}
                    onSelect={(t) => setAddSymbol(t)}
                    existingTickers={[]}
                    placeholder="Symbol or company name"
                    className="w-52"
                    inputClassName="h-9 border border-white/[0.08] bg-white/[0.03] rounded-xl text-sm focus-visible:ring-0 focus-visible:border-indigo-primary/50"
                  />
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-9 w-24 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`Avg cost (${addCostCurrency})`}
                  value={addCost}
                  onChange={(e) => setAddCost(e.target.value)}
                  className="h-9 w-32 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
                />
                <select
                  value={addCostCurrency}
                  onChange={(e) => setAddCostCurrency(e.target.value as (typeof SUPPORTED_BASE_CURRENCIES)[number])}
                  className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-semibold text-white focus:border-indigo-primary/50 focus:outline-none"
                  aria-label="Average cost currency"
                >
                  {SUPPORTED_BASE_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency} className="bg-slate-950 text-white">
                      {currency}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={addHolding}
                  disabled={saving || !addSymbol || !addQty || !addCost}
                  size="sm"
                  className="on-accent accent-gradient-surface h-9 rounded-xl px-4 text-sm font-semibold"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add holding"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-white/35">
                Average cost is saved in {activeBaseCurrency}. If you choose another currency, it is converted before P&amp;L is calculated.
              </p>
            </div>
          </section>
        ) : portfolios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-white/30">
            Create a portfolio above to get started.
          </div>
        ) : null}

        {/* Optimizer */}
        {activePortfolio && uniqueSymbols.length >= 2 && (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Optimizer</h2>
              <p className="text-xs text-white/35">{uniqueSymbols.join(" · ")}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-widest text-white/35">Strategy</label>
                <div className="flex rounded-xl border border-white/[0.06] p-1">
                  {(["classical", "quantum"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setResult(null); }}
                      className={cn(
                        "flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
                        mode === m
                          ? m === "quantum"
                            ? "bg-indigo-primary text-white shadow-[0_0_14px_rgba(99,102,241,0.25)]"
                            : "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      {m === "quantum" ? "⚛ Quantum" : "Classical"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-widest text-white/35">
                  Risk Tolerance — {risk.toFixed(1)}
                </label>
                <div className="flex items-center gap-3 py-1">
                  <span className="text-xs text-white/25">Low</span>
                  <ThinSlider
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={risk}
                    onValueChange={(value) => { setRisk(value); setResult(null); }}
                    aria-label="Risk tolerance"
                    className="flex-1"
                  />
                  <span className="text-xs text-white/25">High</span>
                </div>
              </div>
            </div>

            <Button
              onClick={optimize}
              disabled={optimizing}
              className="on-accent accent-gradient-surface w-full rounded-xl py-4 text-base font-semibold shadow-[var(--shadow-primary-wide)] hover:shadow-[var(--shadow-primary-wide-hover)]"
            >
              {optimizing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Optimizing…
                </span>
              ) : "Run Optimization"}
            </Button>

            {result && (
              <div className="space-y-5 border-t border-white/[0.06] pt-5">
                {result.weights && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Expected Return", value: `${((result.expected_annual_return ?? 0) * 100).toFixed(1)}%`, cls: "text-green-positive" },
                        { label: "Volatility", value: `${((result.annual_volatility ?? 0) * 100).toFixed(1)}%`, cls: "text-amber-warning" },
                        { label: "Sharpe", value: (result.sharpe_ratio ?? 0).toFixed(2), cls: "text-indigo-primary" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                          <p className="mb-1.5 text-xs text-white/30">{m.label}</p>
                          <p className={cn("text-2xl font-bold", m.cls)}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col items-center gap-8 md:flex-row">
                      <ChartContainer config={optimizerChartConfig} className="h-[200px] w-[200px] shrink-0">
                        <PieChart>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => (
                                  <span className="flex items-center gap-1.5">
                                    <span className="font-semibold text-white">{name}</span>
                                    <span className="text-white/55">{value}%</span>
                                  </span>
                                )}
                                hideLabel
                              />
                            }
                          />
                          <Pie
                            data={optimizerPieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={4}
                            strokeWidth={0}
                          >
                            {optimizerPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>

                      <div className="flex-1 w-full space-y-2">
                        {optimizerPieData.map((d) => (
                          <div key={d.name} className="flex items-center gap-3">
                            <span className="w-14 text-xs font-bold text-white">{d.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.value}%`, backgroundColor: d.fill }} />
                            </div>
                            <span className="w-12 text-right text-xs text-white/45">{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {result.selected_stocks && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-white/35">⚛ QAOA Selection</p>
                    <div className="flex flex-wrap gap-2">
                      {result.selected_stocks.map((t) => (
                        <span key={t} className="rounded-lg bg-indigo-primary/15 px-3 py-1.5 text-xs font-bold text-indigo-primary ring-1 ring-indigo-primary/20">
                          {t}
                        </span>
                      ))}
                    </div>
                    {result.best_probability != null && (
                      <p className="text-xs text-white/30">
                        Best probability: {(result.best_probability * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activePortfolio && uniqueSymbols.length === 1 && (
          <p className="text-center text-xs text-white/25">Add at least one more holding to enable optimization.</p>
        )}
      </div>
    </div>
  );
}
