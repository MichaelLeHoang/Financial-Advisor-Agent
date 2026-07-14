"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useInvestmentPolicy } from "@/components/investment-policy/InvestmentPolicyProvider";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import {
  api,
  type Holding,
  type InvestmentDecisionRecord,
  type InvestmentPolicyScopeValidation,
  type InvestmentThesis,
  type InvestmentThesisPayload,
  type MarketQuote,
  type Portfolio,
  type PortfolioBookEvent,
  type RecurringBuy,
  type WatchlistAsset,
} from "@/lib/api";
import { fetchQuotes } from "@/lib/quote-cache";
import { fetchCurrencyRate } from "@/lib/currency";

export type InvestmentPeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";
export type PerformanceMode = "value" | "returns";

export interface InvestmentHoldingRecord {
  portfolio: Portfolio;
  holding: Holding;
}

interface Preferences {
  portfolioScope: "all" | string;
  period: InvestmentPeriod;
  performanceMode: PerformanceMode;
  benchmark: string;
  displayCurrency: string;
  privacyMode: boolean;
  railMode: "holdings" | "watchlist";
  railSort: "value" | "weight" | "return" | "thesis";
}

const DEFAULT_PREFERENCES: Preferences = {
  portfolioScope: "all",
  period: "YTD",
  performanceMode: "value",
  benchmark: "SPY",
  displayCurrency: "USD",
  privacyMode: false,
  railMode: "holdings",
  railSort: "value",
};

const PERIOD_REQUESTS: Record<InvestmentPeriod, { period: string; interval: string }> = {
  "1D": { period: "1d", interval: "5m" },
  "1W": { period: "5d", interval: "30m" },
  "1M": { period: "1mo", interval: "1d" },
  "3M": { period: "3mo", interval: "1d" },
  "6M": { period: "6mo", interval: "1d" },
  YTD: { period: "ytd", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  ALL: { period: "max", interval: "1wk" },
};

interface InvestmentWorkspaceContextValue {
  portfolios: Portfolio[];
  allHoldings: InvestmentHoldingRecord[];
  selectedHoldings: InvestmentHoldingRecord[];
  investmentHoldings: InvestmentHoldingRecord[];
  unclassifiedHoldings: InvestmentHoldingRecord[];
  events: PortfolioBookEvent[];
  recurringBuys: RecurringBuy[];
  theses: InvestmentThesis[];
  decisions: InvestmentDecisionRecord[];
  watchlistAssets: WatchlistAsset[];
  quotes: Map<string, MarketQuote>;
  currencyRates: Map<string, number>;
  policyValidation: InvestmentPolicyScopeValidation | null;
  preferences: Preferences;
  loading: boolean;
  quotesLoading: boolean;
  saving: boolean;
  error: string | null;
  refreshedAt: string | null;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  classifyAsInvestment: (record: InvestmentHoldingRecord) => Promise<void>;
  saveThesis: (holdingId: string, payload: InvestmentThesisPayload) => Promise<InvestmentThesis>;
  recordDecision: (holdingId: string, action: "hold" | "trim", rationale: string, policyException?: string) => Promise<InvestmentDecisionRecord>;
  refresh: () => Promise<void>;
}

const InvestmentWorkspaceContext = createContext<InvestmentWorkspaceContextValue | null>(null);
const E2E_ENABLED = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH === "1";

function e2eQuote(symbol: string): MarketQuote {
  const seed = symbol.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const base = 80 + (seed % 280);
  const history = Array.from({ length: 42 }, (_, index) => {
    const price = base * (0.88 + index * 0.0035 + Math.sin(index / 4) * 0.018);
    return { label: `2026-${String(5 + Math.floor(index / 28)).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`, price, volume: 1_000_000 + index * 10_000 };
  });
  const price = history.at(-1)?.price ?? base;
  return { ticker: symbol, name: symbol, price, change: price - (history.at(-2)?.price ?? price), currency: "USD", history };
}

function readE2ERecords(userId: string): { theses: InvestmentThesis[]; decisions: InvestmentDecisionRecord[] } {
  const raw = window.sessionStorage.getItem(`quanfora.investment-records.user:${userId}`);
  return raw ? JSON.parse(raw) : { theses: [], decisions: [] };
}

function validateE2EPolicy(policy: NonNullable<ReturnType<typeof useInvestmentPolicy>["policy"]>, records: InvestmentHoldingRecord[]): InvestmentPolicyScopeValidation {
  const investment = records.filter(({ holding }) => holding.book_type === "investment");
  const total = investment.reduce((sum, { holding }) => sum + holding.quantity * holding.average_cost, 0);
  const alerts: InvestmentPolicyScopeValidation["alerts"] = [];
  records.filter(({ holding }) => holding.book_type === "unclassified").forEach(({ portfolio, holding }) => alerts.push({ code: "unclassified_position", severity: "warning", message: `${holding.symbol} needs an owner-confirmed book.`, symbol: holding.symbol, portfolio_ids: [portfolio.id], holding_ids: [holding.id] }));
  investment.forEach(({ portfolio, holding }) => {
    const weight = total ? ((holding.quantity * holding.average_cost) / total) * 100 : 0;
    if (weight > policy.max_position_weight) alerts.push({ code: "max_position_weight", severity: "breach", message: `${holding.symbol} exceeds the maximum position weight.`, symbol: holding.symbol, observed: weight, limit: policy.max_position_weight, portfolio_ids: [portfolio.id], holding_ids: [holding.id] });
  });
  return { policy_id: policy.id, portfolio_ids: Array.from(new Set(records.map(({ portfolio }) => portfolio.id))), compliant: !alerts.some((alert) => alert.severity === "breach"), alerts, validated_at: new Date().toISOString() };
}

export function InvestmentWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const books = usePortfolioBooks();
  const { policy } = useInvestmentPolicy();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [allHoldings, setAllHoldings] = useState<InvestmentHoldingRecord[]>([]);
  const [events, setEvents] = useState<PortfolioBookEvent[]>([]);
  const [recurringBuys, setRecurringBuys] = useState<RecurringBuy[]>([]);
  const [theses, setTheses] = useState<InvestmentThesis[]>([]);
  const [decisions, setDecisions] = useState<InvestmentDecisionRecord[]>([]);
  const [watchlistAssets, setWatchlistAssets] = useState<WatchlistAsset[]>([]);
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [currencyRates, setCurrencyRates] = useState<Map<string, number>>(new Map([["USD", 1]]));
  const [policyValidation, setPolicyValidation] = useState<InvestmentPolicyScopeValidation | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const preferenceKey = `quanfora.investment-overview.user:${user.id}`;

  useEffect(() => {
    if (authLoading) return;
    try {
      const stored = window.localStorage.getItem(preferenceKey);
      const next = stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
      setPreferences(next);
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [authLoading, preferenceKey]);

  const refresh = useCallback(async () => {
    if (authLoading || (E2E_ENABLED && books.loading)) return;
    setLoading(true);
    setError(null);
    try {
      if (E2E_ENABLED) {
        const nextPortfolios = books.portfolio ? [books.portfolio] : [];
        setPortfolios(nextPortfolios);
        setAllHoldings(books.portfolio ? books.holdings.map((holding) => ({ portfolio: books.portfolio!, holding })) : []);
        setEvents(books.events);
        setRecurringBuys([]);
        const records = readE2ERecords(user.id);
        setTheses(records.theses);
        setDecisions(records.decisions);
        setWatchlistAssets([
          { id: "watch-mu", watchlist_id: "watch-main", symbol: "MU", asset_type: "equity", created_at: new Date().toISOString() },
          { id: "watch-googl", watchlist_id: "watch-main", symbol: "GOOGL", asset_type: "equity", created_at: new Date().toISOString() },
        ]);
        const portfolioRecords = books.portfolio ? books.holdings.map((holding) => ({ portfolio: books.portfolio!, holding })) : [];
        setPolicyValidation(policy ? validateE2EPolicy(policy, portfolioRecords) : null);
      } else if (user.is_guest) {
        setPortfolios([]);
        setAllHoldings([]);
        setEvents([]);
        setRecurringBuys([]);
        setTheses([]);
        setDecisions([]);
        setWatchlistAssets([]);
        setPolicyValidation(null);
      } else {
        const nextPortfolios = await api.portfolios();
        const portfolioData = await Promise.all(nextPortfolios.map(async (portfolio) => {
          const [holdings, bookEvents, buys] = await Promise.all([
            api.portfolioHoldings(portfolio.id),
            api.portfolioBookEvents(portfolio.id),
            api.recurringBuys(portfolio.id).catch(() => []),
          ]);
          return { portfolio, holdings, bookEvents, buys };
        }));
        const [nextTheses, nextDecisions, watchlists] = await Promise.all([
          api.investmentTheses().catch(() => []),
          api.investmentDecisions(undefined, 100).catch(() => []),
          api.watchlists().catch(() => []),
        ]);
        const assets = (await Promise.all(watchlists.map((watchlist) => api.watchlistAssets(watchlist.id).catch(() => [])))).flat();
        setPortfolios(nextPortfolios);
        setAllHoldings(portfolioData.flatMap(({ portfolio, holdings }) => holdings.map((holding) => ({ portfolio, holding }))));
        setEvents(portfolioData.flatMap(({ bookEvents }) => bookEvents).sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setRecurringBuys(portfolioData.flatMap(({ buys }) => buys).sort((a, b) => b.executed_at.localeCompare(a.executed_at)));
        setTheses(nextTheses);
        setDecisions(nextDecisions);
        setWatchlistAssets(assets);
        setPolicyValidation(null);
        if (nextPortfolios[0] && preferences.displayCurrency === DEFAULT_PREFERENCES.displayCurrency) {
          setPreferences((current) => ({ ...current, displayCurrency: nextPortfolios[0].base_currency }));
        }
      }
      setRefreshedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Investment workspace data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, books.events, books.holdings, books.loading, books.portfolio, policy, preferences.displayCurrency, user.id, user.is_guest]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedHoldings = useMemo(() => allHoldings.filter(({ portfolio }) => (
    preferences.portfolioScope === "all" || portfolio.id === preferences.portfolioScope
  )), [allHoldings, preferences.portfolioScope]);
  const investmentHoldings = useMemo(() => selectedHoldings.filter(({ holding }) => holding.book_type === "investment"), [selectedHoldings]);
  const unclassifiedHoldings = useMemo(() => selectedHoldings.filter(({ holding }) => holding.book_type === "unclassified"), [selectedHoldings]);

  useEffect(() => {
    if (E2E_ENABLED || user.is_guest || !policy || !portfolios.length) return;
    const portfolioIds = preferences.portfolioScope === "all"
      ? portfolios.map((portfolio) => portfolio.id)
      : portfolios.filter((portfolio) => portfolio.id === preferences.portfolioScope).map((portfolio) => portfolio.id);
    if (!portfolioIds.length) return;
    let active = true;
    api.validateInvestmentPolicyScope(portfolioIds)
      .then((validation) => { if (active) setPolicyValidation(validation); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Investment policy could not be validated."); });
    return () => { active = false; };
  }, [policy, portfolios, preferences.portfolioScope, user.is_guest]);

  useEffect(() => {
    const { period, interval } = PERIOD_REQUESTS[preferences.period];
    const symbols = Array.from(new Set([
      ...investmentHoldings.map(({ holding }) => holding.symbol),
      ...watchlistAssets.map((asset) => asset.symbol),
      preferences.benchmark,
    ].filter(Boolean)));
    if (!symbols.length) {
      setQuotes(new Map());
      return;
    }
    let active = true;
    setQuotesLoading(true);
    const request = E2E_ENABLED
      ? Promise.resolve(new Map(symbols.map((symbol) => [symbol.toUpperCase(), e2eQuote(symbol.toUpperCase())])))
      : fetchQuotes(symbols, period, interval);
    request.then((result) => { if (active) setQuotes(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Market history could not be loaded."); })
      .finally(() => { if (active) setQuotesLoading(false); });
    return () => { active = false; };
  }, [investmentHoldings, preferences.benchmark, preferences.period, watchlistAssets]);

  useEffect(() => {
    const currencies = Array.from(new Set(investmentHoldings.map(({ holding }) => (
      quotes.get(holding.symbol.toUpperCase())?.currency || holding.cost_currency || "USD"
    )).map((currency) => currency.toUpperCase())));
    let active = true;
    Promise.all(currencies.map(async (currency) => [currency, E2E_ENABLED ? 1 : await fetchCurrencyRate(currency, preferences.displayCurrency)] as const))
      .then((pairs) => { if (active) setCurrencyRates(new Map(pairs)); });
    return () => { active = false; };
  }, [investmentHoldings, preferences.displayCurrency, quotes]);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      return next;
    });
  }, [preferenceKey]);

  const classifyAsInvestment = useCallback(async (record: InvestmentHoldingRecord) => {
    setSaving(true);
    setError(null);
    try {
      if (books.portfolio?.id === record.portfolio.id) {
        await books.classifyHolding(record.holding.id, "investment");
      } else {
        await api.classifyHolding(record.portfolio.id, record.holding.id, "investment");
      }
      setAllHoldings((current) => current.map((item) => item.holding.id === record.holding.id ? {
        ...item,
        holding: { ...item.holding, book_type: "investment", classification_source: "user", classified_at: new Date().toISOString(), classified_by: user.id },
      } : item));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Position classification failed.";
      setError(message);
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [books, user.id]);

  const saveThesis = useCallback(async (holdingId: string, payload: InvestmentThesisPayload) => {
    setSaving(true);
    setError(null);
    try {
      let saved: InvestmentThesis;
      if (E2E_ENABLED) {
        const record = allHoldings.find(({ holding }) => holding.id === holdingId);
        if (!record || record.holding.book_type !== "investment") throw new Error("Classify the holding as Investment first.");
        const existing = theses.find((thesis) => thesis.holding_id === holdingId);
        const now = new Date().toISOString();
        saved = { ...payload, id: existing?.id ?? `thesis-${holdingId}`, user_id: user.id, portfolio_id: record.portfolio.id, holding_id: holdingId, symbol: record.holding.symbol, created_at: existing?.created_at ?? now, updated_at: now };
      } else {
        saved = await api.saveInvestmentThesis(holdingId, payload);
      }
      const next = [saved, ...theses.filter((thesis) => thesis.holding_id !== holdingId)];
      setTheses(next);
      if (E2E_ENABLED) window.sessionStorage.setItem(`quanfora.investment-records.user:${user.id}`, JSON.stringify({ theses: next, decisions }));
      return saved;
    } finally {
      setSaving(false);
    }
  }, [allHoldings, decisions, theses, user.id]);

  const recordDecision = useCallback(async (holdingId: string, action: "hold" | "trim", rationale: string, policyException?: string) => {
    setSaving(true);
    setError(null);
    try {
      let saved: InvestmentDecisionRecord;
      if (E2E_ENABLED) {
        const record = allHoldings.find(({ holding }) => holding.id === holdingId);
        if (!record || record.holding.book_type !== "investment") throw new Error("Classify the holding as Investment first.");
        saved = { id: `decision-${Date.now()}`, user_id: user.id, portfolio_id: record.portfolio.id, holding_id: holdingId, symbol: record.holding.symbol, action, rationale, policy_exception: policyException || null, created_at: new Date().toISOString() };
      } else {
        saved = await api.createInvestmentDecision({ holding_id: holdingId, action, rationale, policy_exception: policyException || null });
      }
      const next = [saved, ...decisions];
      setDecisions(next);
      if (E2E_ENABLED) window.sessionStorage.setItem(`quanfora.investment-records.user:${user.id}`, JSON.stringify({ theses, decisions: next }));
      return saved;
    } finally {
      setSaving(false);
    }
  }, [allHoldings, decisions, theses, user.id]);

  const value = useMemo<InvestmentWorkspaceContextValue>(() => ({
    portfolios, allHoldings, selectedHoldings, investmentHoldings, unclassifiedHoldings, events, recurringBuys,
    theses, decisions, watchlistAssets, quotes, currencyRates, policyValidation, preferences, loading, quotesLoading, saving,
    error, refreshedAt, setPreference, classifyAsInvestment, saveThesis, recordDecision, refresh,
  }), [portfolios, allHoldings, selectedHoldings, investmentHoldings, unclassifiedHoldings, events, recurringBuys, theses, decisions, watchlistAssets, quotes, currencyRates, policyValidation, preferences, loading, quotesLoading, saving, error, refreshedAt, setPreference, classifyAsInvestment, saveThesis, recordDecision, refresh]);

  return <InvestmentWorkspaceContext.Provider value={value}>{children}</InvestmentWorkspaceContext.Provider>;
}

export function useInvestmentWorkspace() {
  const context = useContext(InvestmentWorkspaceContext);
  if (!context) throw new Error("useInvestmentWorkspace must be used inside InvestmentWorkspaceProvider");
  return context;
}
