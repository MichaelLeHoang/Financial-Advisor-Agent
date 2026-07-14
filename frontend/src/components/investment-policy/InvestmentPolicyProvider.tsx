"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import {
  api,
  type InvestmentPolicy,
  type InvestmentPolicyPayload,
  type InvestmentPolicyValidation,
} from "@/lib/api";

const E2E_POLICY_ENABLED = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH === "1";

export const DEFAULT_INVESTMENT_POLICY: InvestmentPolicyPayload = {
  name: "Core investment policy",
  status: "active",
  goals: {},
  time_horizon: "long_term",
  target_allocation: { equity: 92, cash: 8 },
  max_position_weight: 10,
  max_sector_weight: 35,
  max_drawdown: 18,
  minimum_cash_weight: 8,
  permitted_assets: ["equity", "etf", "cash"],
  rebalancing_policy: { cadence: "quarterly" },
  tax_preferences: {},
};

type InvestmentPolicyContextValue = {
  policy: InvestmentPolicy | null;
  validation: InvestmentPolicyValidation | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  savePolicy: (payload: InvestmentPolicyPayload) => Promise<InvestmentPolicy>;
  refresh: () => Promise<void>;
};

const InvestmentPolicyContext = createContext<InvestmentPolicyContextValue | null>(null);

export function InvestmentPolicyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { portfolio, holdings, summary } = usePortfolioBooks();
  const [policy, setPolicy] = useState<InvestmentPolicy | null>(null);
  const [validation, setValidation] = useState<InvestmentPolicyValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = `quanfora.investment-policy.user:${user.id}`;

  const validateLocal = useCallback((saved: InvestmentPolicy): InvestmentPolicyValidation | null => {
    if (!portfolio || !summary) return null;
    const alerts: InvestmentPolicyValidation["alerts"] = [];
    const investmentTotal = holdings
      .filter((holding) => holding.book_type === "investment")
      .reduce((sum, holding) => sum + holding.quantity * holding.average_cost, 0);
    for (const holding of holdings) {
      if (holding.book_type === "unclassified") {
        alerts.push({ code: "unclassified_position", severity: "warning", message: `${holding.symbol} needs an owner-confirmed book.`, symbol: holding.symbol });
      } else if (holding.book_type === "investment" && investmentTotal) {
        const weight = ((holding.quantity * holding.average_cost) / investmentTotal) * 100;
        if (weight > saved.max_position_weight) alerts.push({ code: "max_position_weight", severity: "breach", message: `${holding.symbol} exceeds the maximum position weight.`, symbol: holding.symbol, observed: weight, limit: saved.max_position_weight });
      }
    }
    return { policy_id: saved.id, portfolio_id: portfolio.id, compliant: !alerts.some((alert) => alert.severity === "breach"), alerts, validated_at: new Date().toISOString() };
  }, [holdings, portfolio, summary]);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    try {
      if (E2E_POLICY_ENABLED) {
        const stored = window.sessionStorage.getItem(storageKey);
        const saved = stored ? JSON.parse(stored) as InvestmentPolicy : null;
        setPolicy(saved);
        setValidation(saved ? validateLocal(saved) : null);
      } else if (user.is_guest) {
        setPolicy(null);
        setValidation(null);
      } else {
        const saved = await api.investmentPolicy();
        setPolicy(saved);
        setValidation(saved && portfolio ? await api.validateInvestmentPolicy(portfolio.id) : null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Investment policy could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, portfolio, storageKey, user.is_guest, validateLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePolicy = useCallback(async (payload: InvestmentPolicyPayload) => {
    const previousPolicy = policy;
    const previousValidation = validation;
    const optimistic: InvestmentPolicy = {
      ...payload,
      id: policy?.id ?? `policy-${user.id}`,
      user_id: user.id,
      created_at: policy?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    setError(null);
    setPolicy(optimistic);
    setValidation(validateLocal(optimistic));
    try {
      let saved = optimistic;
      if (E2E_POLICY_ENABLED) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(optimistic));
      } else {
        saved = await api.saveInvestmentPolicy(payload);
      }
      setPolicy(saved);
      setValidation(E2E_POLICY_ENABLED ? validateLocal(saved) : portfolio ? await api.validateInvestmentPolicy(portfolio.id) : null);
      return saved;
    } catch (cause) {
      setPolicy(previousPolicy);
      setValidation(previousValidation);
      const message = cause instanceof Error ? cause.message : "Investment policy could not be saved.";
      setError(`${message} The previous policy was restored.`);
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [policy, portfolio, storageKey, user.id, validateLocal, validation]);

  const value = useMemo<InvestmentPolicyContextValue>(() => ({ policy, validation, loading, saving, error, savePolicy, refresh }), [error, loading, policy, refresh, savePolicy, saving, validation]);
  return <InvestmentPolicyContext.Provider value={value}>{children}</InvestmentPolicyContext.Provider>;
}

export function useInvestmentPolicy() {
  const context = useContext(InvestmentPolicyContext);
  if (!context) throw new Error("useInvestmentPolicy must be used inside InvestmentPolicyProvider");
  return context;
}
