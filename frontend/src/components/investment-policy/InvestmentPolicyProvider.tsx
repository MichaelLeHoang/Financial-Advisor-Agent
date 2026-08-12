"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import {
  api,
  type InvestmentPolicy,
  type InvestmentPolicyPayload,
  type InvestmentPolicyValidation,
} from "@/lib/api";
import { readSessionSnapshot, SESSION_CACHE_MAX_AGE, writeSessionSnapshot } from "@/lib/session-data-cache";

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
  refreshing: boolean;
  saving: boolean;
  error: string | null;
  savePolicy: (payload: InvestmentPolicyPayload) => Promise<InvestmentPolicy>;
  refresh: () => Promise<void>;
};

const InvestmentPolicyContext = createContext<InvestmentPolicyContextValue | null>(null);
const SNAPSHOT_KEY = "investment-policy";

export function InvestmentPolicyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { portfolio, holdings, summary } = usePortfolioBooks();
  const [policy, setPolicy] = useState<InvestmentPolicy | null>(null);
  const [validation, setValidation] = useState<InvestmentPolicyValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataAvailableRef = useRef(false);
  const identityRef = useRef("");
  const generationRef = useRef(0);
  const storageKey = `quanfora.investment-policy.user:${user.id}`;
  const routeNeedsInvestmentPolicy = pathname === "/home"
    || pathname.startsWith("/home/")
    || pathname === "/invest"
    || pathname.startsWith("/invest/");

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
    if (!routeNeedsInvestmentPolicy) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const owner = user.is_guest ? "guest" : `user:${user.id}`;
    const generation = ++generationRef.current;
    if (identityRef.current !== owner) {
      identityRef.current = owner;
      dataAvailableRef.current = false;
      setPolicy(null);
      setValidation(null);
    }
    if (!dataAvailableRef.current && !E2E_POLICY_ENABLED && !user.is_guest) {
      const snapshot = readSessionSnapshot<InvestmentPolicy | null>({ owner, key: SNAPSHOT_KEY, maxAgeMs: SESSION_CACHE_MAX_AGE.account });
      if (snapshot) {
        setPolicy(snapshot.data);
        dataAvailableRef.current = true;
      }
    }
    setLoading(!dataAvailableRef.current);
    setRefreshing(dataAvailableRef.current);
    setError(null);
    try {
      let saved: InvestmentPolicy | null;
      if (E2E_POLICY_ENABLED) {
        const stored = window.sessionStorage.getItem(storageKey);
        saved = stored ? JSON.parse(stored) as InvestmentPolicy : null;
      } else if (user.is_guest) {
        saved = null;
      } else {
        saved = await api.investmentPolicy();
      }
      if (generation !== generationRef.current) return;
      setPolicy(saved);
      dataAvailableRef.current = true;
      if (!user.is_guest && !E2E_POLICY_ENABLED) writeSessionSnapshot({ owner, key: SNAPSHOT_KEY, data: saved });
    } catch (cause) {
      if (generation !== generationRef.current) return;
      setError(cause instanceof Error ? cause.message : "Investment policy could not be loaded.");
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [authLoading, routeNeedsInvestmentPolicy, storageKey, user.id, user.is_guest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!routeNeedsInvestmentPolicy || !policy || !portfolio) {
      setValidation(null);
      return;
    }
    if (E2E_POLICY_ENABLED) {
      setValidation(validateLocal(policy));
      return;
    }
    if (user.is_guest) return;
    let active = true;
    api.validateInvestmentPolicy(portfolio.id)
      .then((next) => { if (active) setValidation(next); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Investment policy could not be validated."); });
    return () => { active = false; };
  }, [holdings, policy, portfolio, routeNeedsInvestmentPolicy, user.is_guest, validateLocal]);

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
      writeSessionSnapshot({ owner: `user:${user.id}`, key: SNAPSHOT_KEY, data: saved });
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

  const value = useMemo<InvestmentPolicyContextValue>(() => ({ policy, validation, loading, refreshing, saving, error, savePolicy, refresh }), [error, loading, policy, refresh, refreshing, savePolicy, saving, validation]);
  return <InvestmentPolicyContext.Provider value={value}>{children}</InvestmentPolicyContext.Provider>;
}

export function useInvestmentPolicy() {
  const context = useContext(InvestmentPolicyContext);
  if (!context) throw new Error("useInvestmentPolicy must be used inside InvestmentPolicyProvider");
  return context;
}
