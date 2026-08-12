"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export type PortfolioBookView = "investment" | "trading";

type PortfolioBookViewContextValue = {
  book: PortfolioBookView;
  setBook: (book: PortfolioBookView) => void;
  ready: boolean;
};

const PortfolioBookViewContext = createContext<PortfolioBookViewContextValue | null>(null);

function isPortfolioBookView(value: string | null): value is PortfolioBookView {
  return value === "investment" || value === "trading";
}

export function PortfolioBookViewProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [book, setBook] = useState<PortfolioBookView>("investment");
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const identity = user.is_guest ? "guest" : `user:${user.id}`;
  const storageKey = `quanfora.portfolio-book-view.${identity}`;

  useEffect(() => {
    if (loading) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // The selector remains usable when browser storage is unavailable.
    }
    setBook(isPortfolioBookView(stored) ? stored : "investment");
    setHydratedKey(storageKey);
  }, [loading, storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, book);
    } catch {
      // Persistence is best effort; in-memory navigation still works.
    }
  }, [book, hydratedKey, storageKey]);

  const value = useMemo<PortfolioBookViewContextValue>(() => ({
    book,
    setBook,
    ready: hydratedKey === storageKey,
  }), [book, hydratedKey, storageKey]);

  return <PortfolioBookViewContext.Provider value={value}>{children}</PortfolioBookViewContext.Provider>;
}

export function usePortfolioBookView() {
  const context = useContext(PortfolioBookViewContext);
  if (!context) throw new Error("usePortfolioBookView must be used inside PortfolioBookViewProvider");
  return context;
}
