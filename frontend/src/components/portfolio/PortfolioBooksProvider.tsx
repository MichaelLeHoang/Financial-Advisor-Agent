"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  api,
  type Holding,
  type Portfolio,
  type PortfolioBookEvent,
  type PortfolioBooks,
  type PositionBook,
} from "@/lib/api";

const E2E_BOOKS_ENABLED = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH === "1";
const BOOK_ORDER: PositionBook[] = ["investment", "trading", "unclassified"];

type PortfolioBooksContextValue = {
  portfolio: Portfolio | null;
  holdings: Holding[];
  summary: PortfolioBooks | null;
  events: PortfolioBookEvent[];
  loading: boolean;
  error: string | null;
  updatingHoldingId: string | null;
  refreshedAt: string | null;
  classifyHolding: (holdingId: string, book: PositionBook) => Promise<void>;
  refresh: () => Promise<void>;
};

const PortfolioBooksContext = createContext<PortfolioBooksContextValue | null>(null);

function aggregate(portfolio: Portfolio, holdings: Holding[]): PortfolioBooks {
  const exposures = new Map<PositionBook, number>(BOOK_ORDER.map((book) => [book, 0]));
  const counts = new Map<PositionBook, number>(BOOK_ORDER.map((book) => [book, 0]));
  const positionExposures = holdings.map((holding) => {
    const exposure = Math.max(0, holding.quantity * holding.average_cost);
    exposures.set(holding.book_type, (exposures.get(holding.book_type) ?? 0) + exposure);
    counts.set(holding.book_type, (counts.get(holding.book_type) ?? 0) + 1);
    return exposure;
  });
  const total = Array.from(exposures.values()).reduce((sum, value) => sum + value, 0);
  const weight = (value: number) => total ? Number(((value / total) * 100).toFixed(4)) : 0;
  const value = (book: PositionBook) => exposures.get(book) ?? 0;

  return {
    portfolio_id: portfolio.id,
    base_currency: portfolio.base_currency,
    as_of: new Date().toISOString(),
    total_cost_basis: Number(total.toFixed(2)),
    books: BOOK_ORDER.map((book) => ({
      book_type: book,
      holding_count: counts.get(book) ?? 0,
      cost_basis: Number(value(book).toFixed(2)),
      portfolio_weight: weight(value(book)),
    })),
    risk: {
      gross_exposure: Number(total.toFixed(2)),
      largest_position_weight: weight(Math.max(0, ...positionExposures)),
      investment_weight: weight(value("investment")),
      trading_weight: weight(value("trading")),
      unclassified_weight: weight(value("unclassified")),
      unclassified_count: counts.get("unclassified") ?? 0,
    },
  };
}

function e2eFixture(userId: string): { portfolio: Portfolio; holdings: Holding[]; events: PortfolioBookEvent[] } {
  const now = new Date().toISOString();
  const portfolio: Portfolio = { id: "10000000-0000-0000-0000-000000000001", user_id: userId, name: "Core", base_currency: "USD", created_at: now };
  const holding = (id: string, symbol: string, quantity: number, averageCost: number, book: PositionBook): Holding => ({
    id,
    portfolio_id: portfolio.id,
    symbol,
    asset_type: "equity",
    quantity,
    average_cost: averageCost,
    cost_currency: "USD",
    book_type: book,
    classification_source: book === "unclassified" ? "import" : "user",
    classified_at: book === "unclassified" ? null : now,
    classified_by: book === "unclassified" ? null : userId,
    created_at: now,
  });
  return {
    portfolio,
    holdings: [
      holding("20000000-0000-0000-0000-000000000001", "NVDA", 121, 132, "unclassified"),
      holding("20000000-0000-0000-0000-000000000002", "MSFT", 40, 362, "investment"),
      holding("20000000-0000-0000-0000-000000000003", "AMD", 50, 170, "trading"),
    ],
    events: [],
  };
}

export function PortfolioBooksProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [serverSummary, setServerSummary] = useState<PortfolioBooks | null>(null);
  const [events, setEvents] = useState<PortfolioBookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingHoldingId, setUpdatingHoldingId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const storageKey = `quanfora.portfolio-books.user:${user.id}`;

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    try {
      if (E2E_BOOKS_ENABLED) {
        const stored = window.sessionStorage.getItem(storageKey);
        const fixture = stored ? JSON.parse(stored) as ReturnType<typeof e2eFixture> : e2eFixture(user.id);
        setPortfolio(fixture.portfolio);
        setHoldings(fixture.holdings);
        setEvents(fixture.events);
        setServerSummary(aggregate(fixture.portfolio, fixture.holdings));
      } else if (user.is_guest) {
        setPortfolio(null);
        setHoldings([]);
        setEvents([]);
        setServerSummary(null);
      } else {
        const portfolios = await api.portfolios();
        const active = portfolios[0] ?? null;
        setPortfolio(active);
        if (!active) {
          setHoldings([]);
          setEvents([]);
          setServerSummary(null);
        } else {
          const [nextHoldings, nextSummary, nextEvents] = await Promise.all([
            api.portfolioHoldings(active.id),
            api.portfolioBooks(active.id),
            api.portfolioBookEvents(active.id),
          ]);
          setHoldings(nextHoldings);
          setServerSummary(nextSummary);
          setEvents(nextEvents);
        }
      }
      setRefreshedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Portfolio books could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, storageKey, user.id, user.is_guest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(
    () => portfolio ? aggregate(portfolio, holdings) : serverSummary,
    [holdings, portfolio, serverSummary],
  );

  const classifyHolding = useCallback(async (holdingId: string, book: PositionBook) => {
    if (!portfolio) throw new Error("Create a portfolio before classifying positions.");
    const previousHoldings = holdings;
    const previousEvents = events;
    const current = holdings.find((holding) => holding.id === holdingId);
    if (!current || current.book_type === book) return;
    const now = new Date().toISOString();
    const optimistic = holdings.map((holding) => holding.id === holdingId ? {
      ...holding,
      book_type: book,
      classification_source: "user" as const,
      classified_at: now,
      classified_by: user.id,
    } : holding);
    const optimisticEvent: PortfolioBookEvent = {
      id: `optimistic-${holdingId}-${Date.now()}`,
      user_id: user.id,
      portfolio_id: portfolio.id,
      holding_id: holdingId,
      symbol: current.symbol,
      previous_book_type: current.book_type,
      new_book_type: book,
      classification_source: "user",
      actor_id: user.id,
      created_at: now,
    };
    setUpdatingHoldingId(holdingId);
    setError(null);
    setHoldings(optimistic);
    setEvents([optimisticEvent, ...events]);
    try {
      if (E2E_BOOKS_ENABLED) {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ portfolio, holdings: optimistic, events: [optimisticEvent, ...events] }));
      } else {
        const saved = await api.classifyHolding(portfolio.id, holdingId, book);
        setHoldings((currentHoldings) => currentHoldings.map((holding) => holding.id === holdingId ? saved : holding));
        const savedEvents = await api.portfolioBookEvents(portfolio.id);
        setEvents(savedEvents);
      }
      setRefreshedAt(new Date().toISOString());
    } catch (cause) {
      setHoldings(previousHoldings);
      setEvents(previousEvents);
      const message = cause instanceof Error ? cause.message : "Position classification failed.";
      setError(`${message} The previous book was restored.`);
      throw cause;
    } finally {
      setUpdatingHoldingId(null);
    }
  }, [events, holdings, portfolio, storageKey, user.id]);

  const value = useMemo<PortfolioBooksContextValue>(() => ({
    portfolio,
    holdings,
    summary,
    events,
    loading,
    error,
    updatingHoldingId,
    refreshedAt,
    classifyHolding,
    refresh,
  }), [classifyHolding, error, events, holdings, loading, portfolio, refresh, refreshedAt, summary, updatingHoldingId]);

  return <PortfolioBooksContext.Provider value={value}>{children}</PortfolioBooksContext.Provider>;
}

export function usePortfolioBooks() {
  const context = useContext(PortfolioBooksContext);
  if (!context) throw new Error("usePortfolioBooks must be used inside PortfolioBooksProvider");
  return context;
}
