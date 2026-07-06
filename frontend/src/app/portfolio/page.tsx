"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
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
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
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
const GLOBAL_CURRENCIES = [
  { code: "USD", name: "United States Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "INR", name: "Indian Rupee" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "ZAR", name: "South African Rand" },
  { code: "AED", name: "UAE Dirham" },
];

interface HoldingRow extends Holding {
  name: string | null;
  quoteCurrency: string | null;
  baseCurrency: string | null;
  currentPrice: number | null;
  convertedPrice: number | null;
  dailyChange: number | null;
  dailyChangePct: number | null;
  fxRate: number | null;
  costFxRate: number | null;
  costBasis: number | null;
  originalValue: number | null;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
  holdingValue: number | null;
  holdingDailyChange: number | null;
  holdingPnl: number | null;
  holdingPnlPct: number | null;
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
  | "name"
  | "quoteCurrency"
  | "baseCurrency"
  | "currentPrice"
  | "convertedPrice"
  | "dailyChange"
  | "dailyChangePct"
  | "fxRate"
  | "costFxRate"
  | "costBasis"
  | "originalValue"
  | "value"
  | "pnl"
  | "pnlPct"
  | "holdingValue"
  | "holdingDailyChange"
  | "holdingPnl"
  | "holdingPnlPct"
> {
  return {
    name: null,
    quoteCurrency: null,
    baseCurrency,
    currentPrice: null,
    convertedPrice: null,
    dailyChange: null,
    dailyChangePct: null,
    fxRate: null,
    costFxRate: null,
    costBasis: null,
    originalValue: null,
    value: null,
    pnl: null,
    pnlPct: null,
    holdingValue: null,
    holdingDailyChange: null,
    holdingPnl: null,
    holdingPnlPct: null,
  };
}

function computeMetrics(
  h: HoldingRow,
  price: number | null,
  quoteCurrency: string | null | undefined,
  baseCurrency: string | null | undefined,
  fxRate = 1,
  costFxRate = 1,
  change: number | null = null,
  name: string | null = null
) {
  const base = normalizeCurrency(baseCurrency);
  const quote = normalizeCurrency(quoteCurrency, base);
  const costCurrency = normalizeCurrency(h.cost_currency, base);
  if (price == null) return emptyMetrics(base);

  const convertedPrice = price * fxRate;
  const convertedChange = change == null ? null : change * fxRate;
  const holdingPrice = price * costFxRate;
  const holdingChange = change == null ? null : change * costFxRate;
  const originalValue = h.quantity * price;
  const value = h.quantity * convertedPrice;
  const dailyChange = convertedChange == null ? null : h.quantity * convertedChange;
  const priorValue = dailyChange == null ? null : value - dailyChange;
  const dailyChangePct = dailyChange != null && priorValue != null && priorValue > 0
    ? (dailyChange / priorValue) * 100
    : null;
  const costBasis = h.quantity * h.average_cost * deriveCostToBaseRate(costCurrency, base, fxRate, costFxRate);
  const pnl = value - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const holdingValue = h.quantity * holdingPrice;
  const holdingDailyChange = holdingChange == null ? null : h.quantity * holdingChange;
  const holdingCostBasis = h.quantity * h.average_cost;
  const holdingPnl = holdingValue - holdingCostBasis;
  const holdingPnlPct = holdingCostBasis > 0 ? (holdingPnl / holdingCostBasis) * 100 : 0;
  return {
    name,
    quoteCurrency: quote,
    baseCurrency: base,
    currentPrice: price,
    convertedPrice,
    dailyChange,
    dailyChangePct,
    fxRate,
    costFxRate,
    costBasis,
    originalValue,
    value,
    pnl,
    pnlPct,
    holdingValue,
    holdingDailyChange,
    holdingPnl,
    holdingPnlPct,
  };
}

function deriveCostToBaseRate(costCurrency: string, baseCurrency: string, quoteFxRate: number, costFxRate: number) {
  if (costCurrency === baseCurrency) return 1;
  if (costFxRate > 0) return quoteFxRate / costFxRate;
  return 1;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultGoalTargetDate() {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return toDateInputValue(nextYear);
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatGoalDate(value: string) {
  const date = parseDateInputValue(value);
  if (!date) return "No target date";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getGoalDateDelta(value: string) {
  const target = parseDateInputValue(value);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatGoalDateDelta(days: number | null) {
  if (days == null) return "Set target";
  if (days === 0) return "Due today";
  const unit = Math.abs(days) === 1 ? "day" : "days";
  return days > 0 ? `${days} ${unit} remaining` : `${Math.abs(days)} ${unit} past target`;
}

export default function PortfolioPage() {
  const { loading: authLoading, token } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newBaseCurrency, setNewBaseCurrency] = useState("USD");
  const [showNewForm, setShowNewForm] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [addSymbol, setAddSymbol] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addCostCurrency, setAddCostCurrency] = useState<(typeof SUPPORTED_BASE_CURRENCIES)[number]>("USD");
  const [displayBaseCurrency, setDisplayBaseCurrency] = useState("USD");
  const [displayTotalValue, setDisplayTotalValue] = useState(0);
  const [currencySearch, setCurrencySearch] = useState("");
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
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showCurrencySearchMenu, setShowCurrencySearchMenu] = useState(false);
  const [showNewCurrencyMenu, setShowNewCurrencyMenu] = useState(false);
  const [showNewCurrencySearchMenu, setShowNewCurrencySearchMenu] = useState(false);
  const [newCurrencySearch, setNewCurrencySearch] = useState("");
  const [portfolioToDelete, setPortfolioToDelete] = useState<Portfolio | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [returnPeriod, setReturnPeriod] = useState<"5D" | "1M" | "YTD" | "1Y" | "5Y">("1Y");
  const [sortBy, setSortBy] = useState<"total" | "weight" | "today" | "allTime" | "symbol">("total");
  const [portfolioGoal, setPortfolioGoal] = useState(200000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("200000");
  const [goalTargetDate, setGoalTargetDate] = useState(defaultGoalTargetDate);
  const [editingGoalDate, setEditingGoalDate] = useState(false);
  const [goalDateDraft, setGoalDateDraft] = useState(goalTargetDate);
  const editRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);
  const newCurrencyMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;
  const portfolioBaseCurrency = normalizeCurrency(activePortfolio?.base_currency);
  const activeBaseCurrency = portfolioBaseCurrency;
  const canLoadPortfolioData = !authLoading || Boolean(token);

  useEffect(() => {
    setDisplayBaseCurrency(portfolioBaseCurrency);
    if (SUPPORTED_BASE_CURRENCIES.includes(portfolioBaseCurrency as (typeof SUPPORTED_BASE_CURRENCIES)[number])) {
      setAddCostCurrency(portfolioBaseCurrency as (typeof SUPPORTED_BASE_CURRENCIES)[number]);
    }
    setCurrencySearch("");
  }, [portfolioBaseCurrency]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (showAccountMenu && accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setShowAccountMenu(false);
      }

      if (showCurrencyMenu && currencyMenuRef.current && !currencyMenuRef.current.contains(target)) {
        setShowCurrencyMenu(false);
        setShowCurrencySearchMenu(false);
        setCurrencySearch("");
      }

      if (showNewCurrencyMenu && newCurrencyMenuRef.current && !newCurrencyMenuRef.current.contains(target)) {
        setShowNewCurrencyMenu(false);
        setShowNewCurrencySearchMenu(false);
        setNewCurrencySearch("");
      }

      if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showAccountMenu, showCurrencyMenu, showNewCurrencyMenu, showSortMenu]);

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

  useEffect(() => {
    if (!activeId) return;
    try {
      const savedGoal = localStorage.getItem(`portfolio.goal.${activeId}`);
      const parsed = savedGoal ? Number(savedGoal) : NaN;
      const nextGoal = Number.isFinite(parsed) && parsed > 0 ? parsed : 200000;
      const savedGoalDate = localStorage.getItem(`portfolio.goalDate.${activeId}`);
      const nextGoalDate = savedGoalDate && parseDateInputValue(savedGoalDate) ? savedGoalDate : defaultGoalTargetDate();
      setPortfolioGoal(nextGoal);
      setGoalDraft(String(nextGoal));
      setGoalTargetDate(nextGoalDate);
      setGoalDateDraft(nextGoalDate);
    } catch {
      const nextGoalDate = defaultGoalTargetDate();
      setPortfolioGoal(200000);
      setGoalDraft("200000");
      setGoalTargetDate(nextGoalDate);
      setGoalDateDraft(nextGoalDate);
    }
  }, [activeId]);

  // Fetch live prices using the shared cache
  const fetchPricesForHoldings = useCallback((list: Holding[], baseCurrency: string) => {
    const normalizedBase = normalizeCurrency(baseCurrency);
    const symbols = [...new Set(list.map((h) => h.symbol))];

    void Promise.allSettled(
      symbols.map(async (sym) => {
        const quote = await fetchQuote(sym);
        const quoteCurrency = normalizeCurrency(quote.currency, normalizedBase);
        const fxRate = await fetchCurrencyRate(quoteCurrency, normalizedBase);
        return { sym, price: quote.price, quoteCurrency, fxRate, change: quote.change ?? null, name: quote.name ?? null };
      })
    ).then(async (results) => {
      const quotes = new Map<
        string,
        { price: number; quoteCurrency: string; fxRate: number; change: number | null; name: string | null }
      >();
      results.forEach((result) => {
        if (result.status === "fulfilled") quotes.set(result.value.sym, result.value);
      });
      if (quotes.size === 0) return;

      const costRates = new Map<string, number>();
      await Promise.allSettled(
        list.map(async (holding) => {
          const quote = quotes.get(holding.symbol);
          if (!quote) return;
          const costCurrency = normalizeCurrency(holding.cost_currency, normalizedBase);
          const key = `${holding.symbol}:${costCurrency}`;
          if (costRates.has(key)) return;
          costRates.set(key, await fetchCurrencyRate(quote.quoteCurrency, costCurrency));
        })
      );

      setHoldings((prev) =>
        prev.map((h) => {
          const quote = quotes.get(h.symbol);
          if (!quote) return h;
          if (normalizeCurrency(h.baseCurrency, normalizedBase) !== normalizedBase) return h;
          const costCurrency = normalizeCurrency(h.cost_currency, normalizedBase);
          const costFxRate = costRates.get(`${h.symbol}:${costCurrency}`) ?? 1;
          return {
            ...h,
            ...computeMetrics(h, quote.price, quote.quoteCurrency, normalizedBase, quote.fxRate, costFxRate, quote.change, quote.name),
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
      setShowAccountMenu(false);
      if (activeId === portfolioId) {
        setActiveId(updated.length > 0 ? updated[0].id : null);
        setHoldings([]);
        setResult(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPortfolioToDelete(null);
    }
  };

  const commitGoal = () => {
    if (!activeId) return;
    const parsed = Number(goalDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalDraft(String(portfolioGoal));
      setEditingGoal(false);
      return;
    }

    setPortfolioGoal(parsed);
    setGoalDraft(String(parsed));
    setEditingGoal(false);
    try {
      localStorage.setItem(`portfolio.goal.${activeId}`, String(parsed));
    } catch {
      // Goal persistence is best effort.
    }
  };

  const commitGoalDate = () => {
    if (!activeId) return;
    if (!goalDateDraft || !parseDateInputValue(goalDateDraft)) {
      setGoalDateDraft(goalTargetDate);
      setEditingGoalDate(false);
      return;
    }

    setGoalTargetDate(goalDateDraft);
    setEditingGoalDate(false);
    try {
      localStorage.setItem(`portfolio.goalDate.${activeId}`, goalDateDraft);
    } catch {
      // Goal date persistence is best effort.
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
      const holding = await api.addHolding(activeId, addSymbol.toUpperCase(), qty, cost, addCostCurrency);
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
          const costFxRate = await fetchCurrencyRate(quoteCurrency, normalizeCurrency(holding.cost_currency, activeBaseCurrency));
          setHoldings((prev) =>
            prev.map((h) => {
              if (h.id !== holding.id) return h;
              return {
                ...h,
                ...computeMetrics(h, quote.price, quoteCurrency, activeBaseCurrency, fxRate, costFxRate, quote.change ?? null, quote.name ?? null),
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
    const holding = holdings.find((row) => row.id === holdingId);
    setEdit({ holdingId, field, draft: String(current), currency: normalizeCurrency(holding?.cost_currency, activeBaseCurrency), saving: false });
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

    const nextCostCurrency = normalizeCurrency(edit.currency, activeBaseCurrency);
    const nextCostFxRate = edit.field === "average_cost" && h.quoteCurrency
      ? await fetchCurrencyRate(h.quoteCurrency, nextCostCurrency)
      : h.costFxRate ?? 1;

    // Optimistically update UI immediately
    const patch = {
      [edit.field]: val,
      ...(edit.field === "average_cost" ? { cost_currency: nextCostCurrency } : {}),
    } as { quantity?: number; average_cost?: number; cost_currency?: string };
    setHoldings((prev) =>
      prev.map((r) => {
        if (r.id !== edit.holdingId) return r;
        const updated = { ...r, ...patch, costFxRate: nextCostFxRate };
        return {
          ...updated,
          ...computeMetrics(
            updated,
            updated.currentPrice,
            updated.quoteCurrency,
            updated.baseCurrency ?? activeBaseCurrency,
            updated.fxRate ?? 1,
            nextCostFxRate
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
  const totalCost = holdings.reduce((s, h) => s + (h.costBasis ?? h.quantity * h.average_cost), 0);
  const totalPnl = totalValue > 0 ? totalValue - totalCost : null;
  const totalPnlPct = totalCost > 0 && totalPnl != null ? (totalPnl / totalCost) * 100 : null;
  const totalDailyReturn = holdings.reduce((s, h) => s + (h.dailyChange ?? 0), 0);
  const priorPortfolioValue = totalValue - totalDailyReturn;
  const totalDailyReturnPct = priorPortfolioValue > 0 ? (totalDailyReturn / priorPortfolioValue) * 100 : null;
  const pricedHoldingCount = holdings.filter((h) => h.value != null).length;
  const canShowAccountSummary = holdings.length > 0;
  const portfolioGoalProgress = portfolioGoal > 0 ? Math.min((totalValue / portfolioGoal) * 100, 100) : 0;
  const goalTargetLabel = formatGoalDate(goalTargetDate);
  const goalDateDelta = getGoalDateDelta(goalTargetDate);
  const goalDateDeltaLabel = formatGoalDateDelta(goalDateDelta);
  const displayedReturn = returnPeriod === "5D" ? totalDailyReturn : totalPnl ?? 0;
  const displayedReturnPct = returnPeriod === "5D" ? totalDailyReturnPct : totalPnlPct;

  useEffect(() => {
    let cancelled = false;

    if (displayBaseCurrency === activeBaseCurrency) {
      setDisplayTotalValue(totalValue);
      return;
    }

    convertAmount(totalValue, activeBaseCurrency, displayBaseCurrency)
      .then((converted) => {
        if (!cancelled) setDisplayTotalValue(converted);
      })
      .catch(() => {
        if (!cancelled) setDisplayTotalValue(totalValue);
      });

    return () => {
      cancelled = true;
    };
  }, [activeBaseCurrency, displayBaseCurrency, totalValue]);

  const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol))];

  const allocationData = useMemo(() => {
    const bySymbol: Record<string, number> = {};
    for (const h of holdings) {
      bySymbol[h.symbol] = (bySymbol[h.symbol] ?? 0) + (h.value ?? h.costBasis ?? h.quantity * h.average_cost);
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

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const weightA = totalValue > 0 && a.value != null ? a.value / totalValue : 0;
      const weightB = totalValue > 0 && b.value != null ? b.value / totalValue : 0;
      if (sortBy === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sortBy === "weight") return weightB - weightA;
      if (sortBy === "today") return (b.dailyChange ?? Number.NEGATIVE_INFINITY) - (a.dailyChange ?? Number.NEGATIVE_INFINITY);
      if (sortBy === "allTime") return (b.pnl ?? Number.NEGATIVE_INFINITY) - (a.pnl ?? Number.NEGATIVE_INFINITY);
      return (b.value ?? Number.NEGATIVE_INFINITY) - (a.value ?? Number.NEGATIVE_INFINITY);
    });
  }, [holdings, sortBy, totalValue]);

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return GLOBAL_CURRENCIES;
    return GLOBAL_CURRENCIES.filter((currency) =>
      currency.code.toLowerCase().includes(query) || currency.name.toLowerCase().includes(query)
    );
  }, [currencySearch]);

  const quickCurrencies = useMemo(() => {
    const currencies = new Set<string>(SUPPORTED_BASE_CURRENCIES);
    currencies.add(activeBaseCurrency);
    currencies.add(displayBaseCurrency);
    return Array.from(currencies);
  }, [activeBaseCurrency, displayBaseCurrency]);

  const quickNewCurrencies = useMemo(() => {
    const currencies = new Set<string>(SUPPORTED_BASE_CURRENCIES);
    currencies.add(normalizeCurrency(newBaseCurrency));
    return Array.from(currencies);
  }, [newBaseCurrency]);

  const filteredNewCurrencies = useMemo(() => {
    const query = newCurrencySearch.trim().toLowerCase();
    if (!query) return GLOBAL_CURRENCIES;
    return GLOBAL_CURRENCIES.filter((currency) =>
      currency.code.toLowerCase().includes(query) || currency.name.toLowerCase().includes(query)
    );
  }, [newCurrencySearch]);

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
        <span className="flex flex-wrap items-center justify-center gap-1">
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
        className="group/cell mx-auto flex items-center justify-center gap-1.5 tabular-nums text-white/65 transition-colors hover:text-white"
        title={`Click to edit ${field === "quantity" ? "quantity" : "average cost"}`}
      >
        <span>{format(value)}</span>
        <Pencil className="h-3 w-3 opacity-0 text-white/30 transition-opacity group-hover/cell:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-space-black p-4 font-sans text-white sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1480px] space-y-7">
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && (
          <div className="rounded-2xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-white">Portfolio</h1>
        </div>

        {activePortfolio && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/12 pb-3">
              <button type="button" className="text-sm text-white/86">All</button>
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowAccountMenu((value) => !value)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-white/86 transition-colors hover:text-white"
                >
                  Showing:
                  <span className="text-white">{activePortfolio?.name ?? "All Accounts"}</span>
                  <ChevronDown className={cn("size-4 transition-transform", showAccountMenu && "rotate-180")} />
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 top-8 z-40 w-80 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]">
                    <div className="max-h-64 space-y-1 overflow-auto">
                      {portfolios.map((portfolio) => (
                        <div
                          key={portfolio.id}
                          className={cn(
                            "group/portfolio flex items-center gap-1 rounded-xl pr-1 transition-colors",
                            activeId === portfolio.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveId(portfolio.id);
                              setShowAccountMenu(false);
                            }}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                          >
                            <span className="min-w-0 truncate">{portfolio.name}</span>
                            <span className="shrink-0 text-xs text-white/35">{normalizeCurrency(portfolio.base_currency)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPortfolioToDelete(portfolio);
                              setShowAccountMenu(false);
                            }}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/30 opacity-0 transition-all hover:bg-red-negative/10 hover:text-red-negative group-hover/portfolio:opacity-100"
                            aria-label={`Delete ${portfolio.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-white/[0.08] pt-2">
                      {showNewForm ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newPortfolioName}
                            onChange={(event) => setNewPortfolioName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") createPortfolio();
                              if (event.key === "Escape") setShowNewForm(false);
                            }}
                            placeholder="Portfolio name"
                            autoFocus
                            className="h-10 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-white placeholder:text-white/28 outline-none focus:border-indigo-primary/50"
                          />
                          <div className="flex gap-2">
                            <select
                              value={newBaseCurrency}
                              onChange={(event) => setNewBaseCurrency(event.target.value as (typeof SUPPORTED_BASE_CURRENCIES)[number])}
                              className="h-10 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-white outline-none focus:border-indigo-primary/50"
                            >
                              {SUPPORTED_BASE_CURRENCIES.map((currency) => (
                                <option key={currency} value={currency} className="bg-space-black text-white">
                                  {currency}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              onClick={createPortfolio}
                              disabled={saving || !newPortfolioName.trim()}
                              className="h-10 flex-1 rounded-xl bg-[#a78bfa] text-sm font-bold text-black hover:bg-[#b8a6ff]"
                            >
                              {saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewForm(true)}
                          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 text-sm text-white/55 transition-colors hover:border-[#a78bfa]/60 hover:text-white"
                        >
                          <Plus className="size-4" />
                          New portfolio
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
              <div className="min-w-0 rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-3 shadow-[var(--shadow-card)]">
                {holdingsLoading || portfoliosLoading ? (
                  <div className="flex min-h-[270px] items-center justify-center gap-2 text-sm text-white/45">
                    <Loader2 className="size-4 animate-spin" />
                    Loading portfolio…
                  </div>
                ) : allocationData.length > 0 ? (
                  <div className="relative mx-auto flex min-h-[270px] max-w-[540px] items-center justify-center">
                    <ChartContainer config={chartConfig} className="h-[250px] w-[250px]">
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<AllocationTooltip totalValue={totalValue} />}
                        />
                        <Pie data={allocationData} dataKey="value" nameKey="symbol" innerRadius={78} outerRadius={112} paddingAngle={2} stroke="#07080b" strokeWidth={2}>
                          {allocationData.map((entry) => (
                            <Cell key={entry.symbol} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                      <div>
                        <p className="text-2xl font-medium tracking-[-0.03em] text-white">
                          {formatPrivateMoney(displayTotalValue, displayBaseCurrency, hideAmounts)}
                        </p>
                        <p className="mt-1 text-sm text-white/70">Portfolio Value</p>
                      </div>
                    </div>
                  </div>
                ) : (
                    <div className="flex min-h-[270px] items-center justify-center text-sm text-white/35">
                    Add holdings to build your allocation chart.
                  </div>
                )}
              </div>

              <div className="grid min-w-0 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <MetricTile
                    label="Today's Return"
                    value={`${totalDailyReturn >= 0 ? "+" : "-"}${formatPrivateMoney(Math.abs(totalDailyReturn), activeBaseCurrency, hideAmounts)}`}
                    detail={totalDailyReturnPct == null ? "Waiting for live quotes" : `${totalDailyReturnPct >= 0 ? "+" : ""}${totalDailyReturnPct.toFixed(2)}% Today`}
                    tone={totalDailyReturn >= 0 ? "positive" : "negative"}
                  />
                  <MetricTile
                    label="All-Time Return"
                    value={totalPnl == null ? "—" : `${totalPnl >= 0 ? "+" : "-"}${formatPrivateMoney(Math.abs(totalPnl), activeBaseCurrency, hideAmounts)}`}
                    detail={totalPnlPct == null ? "Add cost basis" : `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}% All time`}
                    tone={(totalPnl ?? 0) >= 0 ? "positive" : "negative"}
                  />
                </div>
                <div className="grid min-h-[90px] grid-cols-3 rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-2 shadow-[var(--shadow-card)]">
                  <div ref={currencyMenuRef} className="relative h-full">
                    <ActionButton
                      icon={<WalletCards className="size-5" />}
                      label={`Currency: ${displayBaseCurrency}`}
                      tone="amber"
                      onClick={() => {
                        setShowCurrencyMenu((value) => {
                          const next = !value;
                          if (!next) {
                            setShowCurrencySearchMenu(false);
                            setCurrencySearch("");
                          }
                          return next;
                        });
                      }}
                    />
                    {showCurrencyMenu && (
                      <div className="absolute left-1/2 top-[calc(100%+0.5rem)] z-30 w-44 -translate-x-1/2 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-1 shadow-[var(--shadow-popover)]">
                        {quickCurrencies.map((currency) => (
                          <button
                            key={currency}
                            type="button"
                            onClick={() => {
                              setDisplayBaseCurrency(currency);
                              setShowCurrencyMenu(false);
                              setShowCurrencySearchMenu(false);
                              setCurrencySearch("");
                            }}
                            className={cn(
                              "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              displayBaseCurrency === currency ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                            )}
                          >
                            {currency}
                          </button>
                        ))}
                        <div
                          className="relative"
                          onMouseEnter={() => setShowCurrencySearchMenu(true)}
                        >
                          <button
                            type="button"
                            onClick={() => setShowCurrencySearchMenu(true)}
                            onFocus={() => setShowCurrencySearchMenu(true)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-white/58 transition-colors hover:bg-white/[0.06] hover:text-white"
                          >
                            Add
                            <ChevronRight className="size-4" />
                          </button>
                          {showCurrencySearchMenu && (
                            <>
                              <div className="absolute left-full top-0 hidden h-full w-3 sm:block" />
                              <div
                                onMouseLeave={() => {
                                  setShowCurrencySearchMenu(false);
                                  setCurrencySearch("");
                                }}
                                className="absolute left-0 top-[calc(100%+0.35rem)] z-40 w-72 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)] sm:left-[calc(100%+0.5rem)] sm:top-0"
                              >
                                <label className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-white/50">
                                  <Search className="size-4" />
                                  <input
                                    type="search"
                                    value={currencySearch}
                                    onChange={(event) => setCurrencySearch(event.target.value)}
                                    placeholder="Search currency"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                                  />
                                </label>
                                <div className="mt-2 max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/14 [&::-webkit-scrollbar-track]:bg-transparent">
                                  {filteredCurrencies.map((currency) => (
                                    <button
                                      key={currency.code}
                                      type="button"
                                      onClick={() => {
                                        setDisplayBaseCurrency(currency.code);
                                        setShowCurrencyMenu(false);
                                        setShowCurrencySearchMenu(false);
                                        setCurrencySearch("");
                                      }}
                                      className={cn(
                                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                        displayBaseCurrency === currency.code ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                                      )}
                                    >
                                      <span className="font-semibold">{currency.code}</span>
                                      <span className="min-w-0 flex-1 truncate text-right text-xs text-white/38">{currency.name}</span>
                                      {displayBaseCurrency === currency.code ? (
                                        <Check className="size-4 shrink-0 text-green-positive" />
                                      ) : (
                                        <span className="size-4 shrink-0" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <ActionButton
                    icon={<Building2 className="size-5" />}
                    label="Add Investments"
                    tone="green"
                    onClick={() => setShowAddPanel((value) => !value)}
                  />
                  <ActionButton
                    icon={<Pencil className="size-5" />}
                    label="More portfolios"
                    tone="orange"
                    onClick={() => setShowAccountMenu((value) => !value)}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {portfoliosLoading ? (
          <section className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[var(--surface-card-strong)] p-10 text-sm text-white/45 shadow-[var(--shadow-card)]">
            <Loader2 className="size-4 animate-spin" />
            Loading portfolios…
          </section>
        ) : activePortfolio ? (
          <>
            {showAddPanel && (
              <section className="rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center gap-2">
                  {addSymbol ? (
                    <span className="flex h-10 items-center gap-1.5 rounded-xl bg-[#a78bfa]/15 px-3 text-xs font-semibold text-[#c4b5fd] ring-1 ring-[#a78bfa]/25">
                      {addSymbol}
                      <button type="button" onClick={() => setAddSymbol("")} className="opacity-60 hover:opacity-100" aria-label="Clear ticker">
                        ×
                      </button>
                    </span>
                  ) : (
                    <TickerSuggestionInput
                      value={tickerInput}
                      onValueChange={setTickerInput}
                      onSelect={(ticker) => setAddSymbol(ticker)}
                      existingTickers={holdings.map((holding) => holding.symbol)}
                      placeholder="Symbol or company name"
                      className="w-64"
                      inputClassName="h-10 rounded-xl border border-white/[0.10] bg-black/20 text-sm focus-visible:ring-0 focus-visible:border-[#a78bfa]/60"
                    />
                  )}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={addQty}
                    onChange={(event) => setAddQty(event.target.value)}
                    className="h-10 w-24 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-white placeholder:text-white/28 outline-none focus:border-[#a78bfa]/60"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={`Avg cost (${addCostCurrency})`}
                    value={addCost}
                    onChange={(event) => setAddCost(event.target.value)}
                    className="h-10 w-36 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-white placeholder:text-white/28 outline-none focus:border-[#a78bfa]/60"
                  />
                  <select
                    value={addCostCurrency}
                    onChange={(event) => setAddCostCurrency(event.target.value as (typeof SUPPORTED_BASE_CURRENCIES)[number])}
                    className="h-10 rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm font-semibold text-white outline-none focus:border-[#a78bfa]/60"
                    aria-label="Average cost currency"
                  >
                    {SUPPORTED_BASE_CURRENCIES.map((currency) => (
                      <option key={currency} value={currency} className="bg-space-black text-white">
                        {currency}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={addHolding}
                    disabled={saving || !addSymbol || !addQty || !addCost}
                    className="h-10 rounded-xl bg-[#a78bfa] px-5 text-sm font-bold text-black hover:bg-[#b8a6ff]"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : "Add holding"}
                  </Button>
                </div>
              </section>
            )}

            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
              <section className="min-w-0 space-y-5">
                <div className="rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">Portfolio Goal</h2>
                    {editingGoal ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={goalDraft}
                          onChange={(event) => setGoalDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitGoal();
                            if (event.key === "Escape") {
                              setGoalDraft(String(portfolioGoal));
                              setEditingGoal(false);
                            }
                          }}
                          className="h-9 w-32 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-right text-sm text-white outline-none focus:border-[#a78bfa]/60"
                          autoFocus
                        />
                        <button type="button" onClick={commitGoal} className="text-sm text-[#c4b5fd] hover:text-white">
                          Save
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditingGoal(true)} className="text-base text-white/86 transition-colors hover:text-[#c4b5fd]">
                        Edit goal
                      </button>
                    )}
                  </div>
                  <div className="mt-4 text-xl font-semibold tracking-[-0.04em]">
                    <span className="text-[#a78bfa]">{formatPrivateMoney(totalValue, activeBaseCurrency, hideAmounts)}</span>
                    <span className="text-white/82">/{formatMoney(portfolioGoal, activeBaseCurrency, 0)}</span>
                  </div>
                  <div className="mt-4 h-3 overflow-visible rounded-full bg-black/30">
                    <div
                      className="relative h-full rounded-full bg-[#a78bfa]"
                      style={{ width: `${portfolioGoalProgress}%` }}
                    >
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-[#a78bfa] px-1.5 py-0.5 text-xs font-semibold text-space-black">
                        {portfolioGoalProgress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-sm text-white/78">You&apos;re aiming to reach this by</p>
                      {editingGoalDate ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={goalDateDraft}
                            onChange={(event) => setGoalDateDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitGoalDate();
                              if (event.key === "Escape") {
                                setGoalDateDraft(goalTargetDate);
                                setEditingGoalDate(false);
                              }
                            }}
                            className="h-9 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-[#a78bfa]/60"
                            aria-label="Portfolio goal target date"
                            autoFocus
                          />
                          <button type="button" onClick={commitGoalDate} className="text-sm text-[#c4b5fd] hover:text-white">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGoalDateDraft(goalTargetDate);
                              setEditingGoalDate(false);
                            }}
                            className="text-sm text-white/52 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setGoalDateDraft(goalTargetDate);
                            setEditingGoalDate(true);
                          }}
                          className="mt-1.5 inline-flex items-center gap-2 text-sm text-[#c4b5fd] transition-colors hover:text-white"
                        >
                          <CalendarDays className="size-4" />
                          <span>{goalTargetLabel}</span>
                        </button>
                      )}
                    </div>
                    {!editingGoalDate && (
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          goalDateDelta != null && goalDateDelta < 0
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                            : "border-[#a78bfa]/24 bg-[#a78bfa]/10 text-[#c4b5fd]"
                        )}
                      >
                        {goalDateDeltaLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-4 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">Returns</h2>
                    <div className="flex gap-2">
                      {(["5D", "1M", "YTD", "1Y", "5Y"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setReturnPeriod(period)}
                          className={cn(
                            "h-7 min-w-10 rounded-full px-3 text-xs font-semibold transition-colors",
                            returnPeriod === period ? "bg-emerald-950/80 text-emerald-300" : "bg-black/28 text-white/72 hover:bg-black/42 hover:text-white"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <ReturnRow
                      label="Price Gain"
                      icon={<TrendingUp className="size-5" />}
                      value={totalPnl == null ? "—" : `${totalPnl >= 0 ? "+" : "-"}${formatPrivateMoney(Math.abs(totalPnl), activeBaseCurrency, hideAmounts)}`}
                      detail={totalPnlPct == null ? "" : `(${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%)`}
                      positive={(totalPnl ?? 0) >= 0}
                    />
                    <ReturnRow label="Dividends" icon={<BarChart3 className="size-5" />} value="—" detail="Connect income data" positive />
                    <ReturnRow
                      label="Total Returns"
                      icon={<CircleDollarSign className="size-5" />}
                      value={`${displayedReturn >= 0 ? "+" : "-"}${formatPrivateMoney(Math.abs(displayedReturn), activeBaseCurrency, hideAmounts)}`}
                      detail={displayedReturnPct == null ? "" : `(${displayedReturnPct >= 0 ? "+" : ""}${displayedReturnPct.toFixed(2)}%)`}
                      positive={displayedReturn >= 0}
                      highlight
                    />
                  </div>
                </div>
              </section>

              <section className="min-w-0">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">Holdings</h2>
                    <button
                      type="button"
                      onClick={() => setHideAmounts((value) => !value)}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-[var(--surface-card-strong)] px-3 text-xs font-medium text-white/58 transition-colors hover:border-white/20 hover:text-white"
                    >
                      {hideAmounts ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {hideAmounts ? "Hidden" : "Hide"}
                    </button>
                  </div>
                  <div ref={sortMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSortMenu((value) => !value)}
                      className="inline-flex items-center gap-2 text-sm text-white/86 transition-colors hover:text-white"
                    >
                      Sort:
                      <span className="text-white">
                        {sortBy === "total" ? "Total value" : sortBy === "allTime" ? "All-time return" : sortBy === "today" ? "Today" : sortBy === "weight" ? "% of portfolio" : "Symbol"}
                      </span>
                      <ChevronDown className={cn("size-4 transition-transform", showSortMenu && "rotate-180")} />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-8 z-30 w-48 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-1 shadow-[var(--shadow-popover)]">
                        {[
                          ["total", "Total value"],
                          ["weight", "% of portfolio"],
                          ["today", "Today's return"],
                          ["allTime", "All-time return"],
                          ["symbol", "Symbol"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSortBy(value as typeof sortBy);
                              setShowSortMenu(false);
                            }}
                            className={cn("w-full rounded-xl px-3 py-2 text-left text-sm transition-colors", sortBy === value ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white")}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] shadow-[var(--shadow-card)]">
                  {holdingsLoading ? (
                    <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-white/45">
                      <Loader2 className="size-4 animate-spin" />
                      Loading holdings…
                    </div>
                  ) : sortedHoldings.length > 0 ? (
                    <HorizontalScroll className="w-full">
                      <table className="w-full min-w-[700px] table-fixed text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-xs text-white/60">
                            <th className="w-[32%] px-3 py-3 text-left font-medium">Holdings</th>
                            <th className="w-[12%] px-3 py-3 text-right font-medium">% of portfolio</th>
                            <th className="w-[13%] px-3 py-3 text-right font-medium">Position</th>
                            <th className="w-[12%] px-3 py-3 text-center font-medium">Shares</th>
                            <th className="w-[14%] px-3 py-3 text-right font-medium">Today&apos;s Return</th>
                            <th className="w-[14%] px-3 py-3 text-right font-medium">All-Time Return</th>
                            <th className="w-[3%] px-1 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.07]">
                          {sortedHoldings.map((holding) => {
                            const rowWeight = totalValue > 0 && holding.value != null ? (holding.value / totalValue) * 100 : 0;
                            const holdingName = holding.name || holding.asset_type || "Holding";
                            const holdingCurrency = normalizeCurrency(holding.cost_currency, activeBaseCurrency);
                            const rowValue = holding.holdingValue ?? holding.quantity * holding.average_cost;
                            const rowDailyChange = holding.holdingDailyChange;
                            const rowPnl = holding.holdingPnl;
                            const rowPnlPct = holding.holdingPnlPct;

                            return (
                              <tr key={holding.id} className="group transition-colors hover:bg-white/[0.025]">
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                                      style={{ backgroundColor: colorForSymbol(holding.symbol) }}
                                    >
                                      {holding.symbol.slice(0, 4)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-white">{holding.symbol}</p>
                                      <p className="truncate text-xs text-white/56">{holdingName}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">{rowWeight.toFixed(2)}%</td>
                                <td className="px-3 py-3 text-right tabular-nums">
                                  <p className="font-semibold text-white">
                                    {formatPrivateMoney(rowValue, holdingCurrency, hideAmounts)} {holdingCurrency}
                                  </p>
                                </td>
                                <td className="px-3 py-3 text-center tabular-nums">
                                  <EditableCell holdingId={holding.id} field="quantity" value={holding.quantity} format={(value) => `${value} shares`} />
                                </td>
                                <td className={cn("px-3 py-3 text-right tabular-nums font-semibold", (rowDailyChange ?? 0) >= 0 ? "text-green-positive" : "text-red-negative")}>
                                  {rowDailyChange == null ? (
                                    <span className="text-white/25">Updating...</span>
                                  ) : (
                                    <>
                                      {rowDailyChange >= 0 ? "+" : "-"}
                                      {formatPrivateMoney(Math.abs(rowDailyChange), holdingCurrency, hideAmounts)}
                                      <p className="text-xs opacity-80">
                                        {holding.dailyChangePct == null ? "" : `${holding.dailyChangePct >= 0 ? "+" : ""}${holding.dailyChangePct.toFixed(2)}%`}
                                      </p>
                                    </>
                                  )}
                                </td>
                                <td className={cn("px-3 py-3 text-right tabular-nums font-semibold", rowPnl == null ? "text-white/25" : rowPnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                                  {rowPnl == null ? (
                                    "—"
                                  ) : (
                                    <>
                                      {rowPnl >= 0 ? "+" : "-"}
                                      {formatPrivateMoney(Math.abs(rowPnl), holdingCurrency, hideAmounts)}
                                      <p className="text-xs opacity-80">{rowPnlPct! >= 0 ? "+" : ""}{rowPnlPct!.toFixed(2)}%</p>
                                    </>
                                  )}
                                </td>
                                <td className="px-1 py-3">
                                  <button
                                    type="button"
                                    onClick={() => removeHolding(holding.id)}
                                    className="flex size-8 items-center justify-center rounded-full text-white/28 opacity-0 transition-all hover:bg-white/[0.07] hover:text-red-negative group-hover:opacity-100"
                                    aria-label={`Remove ${holding.symbol}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </HorizontalScroll>
                  ) : (
                    <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
                      <p className="text-sm text-white/40">No holdings yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowAddPanel(true)}
                        className="rounded-full bg-[#a78bfa] px-4 py-2 text-sm font-bold text-black hover:bg-[#b8a6ff]"
                      >
                        Add your first investment
                      </button>
                    </div>
                  )}
                </div>
                {portfolioBadges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {portfolioBadges.map((badge) => (
                      <span key={badge} className="rounded-full border border-white/10 bg-[var(--surface-card-strong)] px-3 py-1.5 text-xs font-medium text-white/55">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {uniqueSymbols.length >= 2 && (
              <section className="rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-6 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Optimizer</h2>
                    <p className="mt-1 text-xs text-white/42">{uniqueSymbols.join(" · ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex rounded-full bg-black/28 p-1">
                      {(["classical", "quantum"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setMode(option);
                            setResult(null);
                          }}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors",
                            mode === option ? "bg-white/12 text-white" : "text-white/46 hover:text-white"
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex min-w-64 items-center gap-3">
                      <SlidersHorizontal className="size-4 text-white/45" />
                      <ThinSlider min={0.1} max={3} step={0.1} value={risk} onValueChange={(value) => { setRisk(value); setResult(null); }} aria-label="Risk tolerance" />
                      <span className="w-8 text-right text-sm text-white/55">{risk.toFixed(1)}</span>
                    </div>
                    <Button onClick={optimize} disabled={optimizing} className="rounded-full bg-[#a78bfa] px-5 text-sm font-bold text-black hover:bg-[#b8a6ff]">
                      {optimizing ? <Loader2 className="size-4 animate-spin" /> : "Run Optimization"}
                    </Button>
                  </div>
                </div>

                {result && (
                  <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-3">
                    {[
                      { label: "Expected Return", value: `${((result.expected_annual_return ?? 0) * 100).toFixed(1)}%`, cls: "text-green-positive" },
                      { label: "Volatility", value: `${((result.annual_volatility ?? 0) * 100).toFixed(1)}%`, cls: "text-amber-warning" },
                      { label: "Sharpe", value: (result.sharpe_ratio ?? 0).toFixed(2), cls: "text-[#a78bfa]" },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-white/[0.08] bg-black/16 p-4">
                        <p className="text-xs text-white/42">{metric.label}</p>
                        <p className={cn("mt-2 text-2xl font-black", metric.cls)}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {uniqueSymbols.length === 1 && (
              <p className="text-center text-xs text-white/28">Add at least one more holding to enable optimization.</p>
            )}
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-white/12 bg-[var(--surface-card-strong)] p-10 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm text-white/45">Create a portfolio to start tracking holdings.</p>
            {showNewForm ? (
              <div className="mx-auto mt-5 max-w-md space-y-3 text-left">
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={(event) => setNewPortfolioName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createPortfolio();
                    if (event.key === "Escape") setShowNewForm(false);
                  }}
                  placeholder="Portfolio name"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm text-white placeholder:text-white/28 outline-none focus:border-[#a78bfa]/60"
                />
                <div className="flex gap-2">
                  <div ref={newCurrencyMenuRef} className="relative w-32 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCurrencyMenu((value) => {
                          const next = !value;
                          if (!next) {
                            setShowNewCurrencySearchMenu(false);
                            setNewCurrencySearch("");
                          }
                          return next;
                        });
                      }}
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-white/[0.10] bg-black/20 px-3 text-sm font-semibold text-white outline-none transition-colors hover:border-white/18 focus:border-[#a78bfa]/60"
                      aria-label="Portfolio base currency"
                    >
                      {normalizeCurrency(newBaseCurrency)}
                      <ChevronDown className={cn("size-4 text-white/45 transition-transform", showNewCurrencyMenu && "rotate-180")} />
                    </button>
                    {showNewCurrencyMenu && (
                      <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 w-44 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-1 shadow-[var(--shadow-popover)]">
                        {quickNewCurrencies.map((currency) => (
                          <button
                            key={currency}
                            type="button"
                            onClick={() => {
                              setNewBaseCurrency(currency);
                              setShowNewCurrencyMenu(false);
                              setShowNewCurrencySearchMenu(false);
                              setNewCurrencySearch("");
                            }}
                            className={cn(
                              "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              normalizeCurrency(newBaseCurrency) === currency ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                            )}
                          >
                            {currency}
                          </button>
                        ))}
                        <div
                          className="relative"
                          onMouseEnter={() => setShowNewCurrencySearchMenu(true)}
                        >
                          <button
                            type="button"
                            onClick={() => setShowNewCurrencySearchMenu(true)}
                            onFocus={() => setShowNewCurrencySearchMenu(true)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-white/58 transition-colors hover:bg-white/[0.06] hover:text-white"
                          >
                            Add
                            <ChevronRight className="size-4" />
                          </button>
                          {showNewCurrencySearchMenu && (
                            <>
                              <div className="absolute left-full top-0 hidden h-full w-3 sm:block" />
                              <div
                                onMouseLeave={() => {
                                  setShowNewCurrencySearchMenu(false);
                                  setNewCurrencySearch("");
                                }}
                                className="absolute bottom-0 left-0 z-50 w-72 rounded-2xl border border-white/12 bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)] sm:bottom-auto sm:left-[calc(100%+0.5rem)] sm:top-0"
                              >
                                <label className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-white/50">
                                  <Search className="size-4" />
                                  <input
                                    type="search"
                                    value={newCurrencySearch}
                                    onChange={(event) => setNewCurrencySearch(event.target.value)}
                                    placeholder="Search currency"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                                  />
                                </label>
                                <div className="mt-2 max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/14 [&::-webkit-scrollbar-track]:bg-transparent">
                                  {filteredNewCurrencies.map((currency) => {
                                    const selected = normalizeCurrency(newBaseCurrency) === currency.code;
                                    return (
                                      <button
                                        key={currency.code}
                                        type="button"
                                        onClick={() => {
                                          setNewBaseCurrency(currency.code);
                                          setShowNewCurrencyMenu(false);
                                          setShowNewCurrencySearchMenu(false);
                                          setNewCurrencySearch("");
                                        }}
                                        className={cn(
                                          "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                          selected ? "bg-white/10 text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                                        )}
                                      >
                                        <span className="font-semibold">{currency.code}</span>
                                        <span className="min-w-0 flex-1 truncate text-right text-xs text-white/38">{currency.name}</span>
                                        {selected ? (
                                          <Check className="size-4 shrink-0 text-green-positive" />
                                        ) : (
                                          <span className="size-4 shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={createPortfolio}
                    disabled={saving || !newPortfolioName.trim()}
                    className="h-11 flex-1 rounded-xl bg-[#a78bfa] text-sm font-bold text-black hover:bg-[#b8a6ff]"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : "Create portfolio"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-white/58 transition-colors hover:border-white/18 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="mt-4 rounded-full bg-[#a78bfa] px-5 py-2 text-sm font-bold text-black hover:bg-[#b8a6ff]"
              >
                New portfolio
              </button>
            )}
          </section>
        )}
        <AlertDialog
          open={Boolean(portfolioToDelete)}
          onOpenChange={(open) => {
            if (!open) setPortfolioToDelete(null);
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{portfolioToDelete?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the portfolio and its holdings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (portfolioToDelete) void deletePortfolio(portfolioToDelete.id);
                }}
                className="bg-red-negative text-white hover:bg-red-negative/85"
              >
                Delete portfolio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function AllocationTooltip({
  active,
  payload,
  totalValue,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { symbol?: string; value?: number; fill?: string } }>;
  totalValue: number;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item?.symbol || item.value == null) return null;

  const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

  return (
    <div className="rounded-full bg-black/86 px-3 py-1.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
      <span className="mr-2 rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: item.fill }}>
        {item.symbol}
      </span>
      {pct.toFixed(1)}%
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-card-strong)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm text-white/86">{label}</p>
      <p className={cn("mt-4 text-2xl font-semibold tracking-[-0.04em]", tone === "positive" ? "text-green-positive" : "text-red-negative")}>
        {value}
      </p>
      <p className={cn("mt-2 text-sm", tone === "positive" ? "text-green-positive" : "text-red-negative")}>{detail}</p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone: "amber" | "green" | "orange";
  onClick: () => void;
}) {
  const styles = {
    amber: "bg-amber-500/12 text-amber-300",
    green: "bg-emerald-500/12 text-emerald-300",
    orange: "bg-orange-500/12 text-orange-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[74px] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl text-center transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/50"
    >
      <span className={cn("flex size-8 items-center justify-center rounded-full transition-transform group-hover:scale-105", styles[tone])}>
        {icon}
      </span>
      <span className="text-xs font-medium leading-tight text-white/84">{label}</span>
    </button>
  );
}

function ReturnRow({
  icon,
  label,
  value,
  detail,
  positive,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  positive: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3.5 py-2.5",
        highlight ? "bg-green-positive/18 text-green-200" : "bg-[var(--surface-card-hover)]"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-white/82" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <div className={cn("text-right text-sm font-semibold tabular-nums", positive ? "text-green-positive" : "text-red-negative")}>
        <p>{value}</p>
        {detail && <p className="text-xs">{detail}</p>}
      </div>
    </div>
  );
}
