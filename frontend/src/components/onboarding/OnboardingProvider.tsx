"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { readSessionSnapshot, SESSION_CACHE_MAX_AGE, writeSessionSnapshot } from "@/lib/session-data-cache";
import { normalizeAppPath } from "@/lib/workspace-routing";

export type WorkspacePreference = "investing" | "trading" | "both";
export type OnboardingStatus = "pending" | "complete" | "skipped";
export type OnboardingStep = "choice" | "preferences";
export type InvestmentHorizon = "3-5-years" | "5-10-years" | "10-plus-years";
export type RiskTolerance = "conservative" | "moderate" | "growth";
export type TradingHoldingPeriod = "intraday" | "swing" | "position";
export type EntryFlowEvent = "onboarding_started" | "onboarding_resumed" | "onboarding_completed" | "onboarding_skipped" | "destination_restored";

export interface OnboardingPreferences {
  status: OnboardingStatus;
  workspacePreference: WorkspacePreference | null;
  currentStep: OnboardingStep;
  investmentHorizon: InvestmentHorizon;
  riskTolerance: RiskTolerance;
  tradingHoldingPeriod: TradingHoldingPeriod;
  paperTradingOnly: boolean;
  completedAt: string | null;
  skippedAt: string | null;
  updatedAt: string;
}

type PreferencePatch = Partial<Omit<OnboardingPreferences, "updatedAt">>;

interface OnboardingContextValue {
  preferences: OnboardingPreferences | null;
  loading: boolean;
  refreshing: boolean;
  saving: boolean;
  error: string | null;
  savePreferences: (patch: PreferencePatch) => Promise<OnboardingPreferences>;
  recordEntryEvent: (event: EntryFlowEvent, path: string, metadata?: Record<string, unknown>) => Promise<void>;
}

interface OnboardingRow {
  status: OnboardingStatus;
  workspace_preference: WorkspacePreference | null;
  current_step: OnboardingStep;
  investment_horizon: InvestmentHorizon | null;
  risk_tolerance: RiskTolerance | null;
  trading_holding_period: TradingHoldingPeriod | null;
  paper_trading_only: boolean;
  completed_at: string | null;
  skipped_at: string | null;
  updated_at: string;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);
const STORAGE_PREFIX = "quanfora.onboarding.user:";
const SNAPSHOT_KEY = "onboarding-preferences";
const E2E_LOCAL_PERSISTENCE = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH === "1";

function defaultPreferences(status: OnboardingStatus): OnboardingPreferences {
  return {
    status,
    workspacePreference: status === "skipped" ? "both" : null,
    currentStep: "choice",
    investmentHorizon: "5-10-years",
    riskTolerance: "moderate",
    tradingHoldingPeriod: "swing",
    paperTradingOnly: true,
    completedAt: null,
    skippedAt: status === "skipped" ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
}

function fromRow(row: OnboardingRow): OnboardingPreferences {
  return {
    status: row.status,
    workspacePreference: row.workspace_preference,
    currentStep: row.current_step,
    investmentHorizon: row.investment_horizon ?? "5-10-years",
    riskTolerance: row.risk_tolerance ?? "moderate",
    tradingHoldingPeriod: row.trading_holding_period ?? "swing",
    paperTradingOnly: row.paper_trading_only,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
    updatedAt: row.updated_at,
  };
}

function readLocalPreferences(userId: string) {
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  if (!stored) return defaultPreferences("skipped");

  try {
    const value = JSON.parse(stored) as Partial<OnboardingPreferences> & {
      preference?: WorkspacePreference | null;
      risk?: string;
      horizon?: string;
      paperOnly?: boolean;
    };
    const fallback = defaultPreferences(value.status ?? "skipped");
    return {
      ...fallback,
      ...value,
      workspacePreference: value.workspacePreference ?? value.preference ?? fallback.workspacePreference,
      investmentHorizon: normalizeHorizon(value.investmentHorizon ?? value.horizon),
      riskTolerance: normalizeRisk(value.riskTolerance ?? value.risk),
      paperTradingOnly: value.paperTradingOnly ?? value.paperOnly ?? fallback.paperTradingOnly,
    } satisfies OnboardingPreferences;
  } catch {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
    return defaultPreferences("skipped");
  }
}

function writeLocalPreferences(userId: string, preferences: OnboardingPreferences) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(preferences));
}

async function loadPreferences(userId: string) {
  if (E2E_LOCAL_PERSISTENCE || !isSupabaseConfigured()) return readLocalPreferences(userId);

  const { data, error } = await getSupabaseBrowserClient()
    .from("user_onboarding_preferences")
    .select("status, workspace_preference, current_step, investment_horizon, risk_tolerance, trading_holding_period, paper_trading_only, completed_at, skipped_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as OnboardingRow) : defaultPreferences("pending");
}

async function persistPreferences(userId: string, preferences: OnboardingPreferences) {
  if (E2E_LOCAL_PERSISTENCE || !isSupabaseConfigured()) {
    writeLocalPreferences(userId, preferences);
    return preferences;
  }

  const { data, error } = await getSupabaseBrowserClient()
    .from("user_onboarding_preferences")
    .upsert({
      user_id: userId,
      status: preferences.status,
      workspace_preference: preferences.workspacePreference,
      current_step: preferences.currentStep,
      investment_horizon: preferences.investmentHorizon,
      risk_tolerance: preferences.riskTolerance,
      trading_holding_period: preferences.tradingHoldingPeriod,
      paper_trading_only: preferences.paperTradingOnly,
      completed_at: preferences.completedAt,
      skipped_at: preferences.skippedAt,
      updated_at: preferences.updatedAt,
    }, { onConflict: "user_id" })
    .select("status, workspace_preference, current_step, investment_horizon, risk_tolerance, trading_holding_period, paper_trading_only, completed_at, skipped_at, updated_at")
    .single();

  if (error) throw error;
  return fromRow(data as OnboardingRow);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<OnboardingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (authLoading) return;
    if (user.is_guest) {
      setPreferences(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const owner = `user:${user.id}`;
    const snapshot = readSessionSnapshot<OnboardingPreferences>({
      owner,
      key: SNAPSHOT_KEY,
      maxAgeMs: SESSION_CACHE_MAX_AGE.onboarding,
    });
    if (snapshot) setPreferences(snapshot.data);
    setLoading(!snapshot);
    setRefreshing(Boolean(snapshot));
    setError(null);
    loadPreferences(user.id)
      .then((next) => {
        if (generation !== generationRef.current) return;
        setPreferences(next);
        writeSessionSnapshot({ owner, key: SNAPSHOT_KEY, data: next });
      })
      .catch((loadError: Error) => {
        if (generation !== generationRef.current) return;
        setError(loadError.message);
        if (!snapshot) setPreferences(defaultPreferences("skipped"));
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [authLoading, user.id, user.is_guest]);

  const savePreferences = useCallback(async (patch: PreferencePatch) => {
    if (user.is_guest) throw new Error("Sign in before saving workspace setup.");
    setSaving(true);
    setError(null);
    try {
      const next = {
        ...(preferences ?? defaultPreferences("pending")),
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const saved = await persistPreferences(user.id, next);
      setPreferences(saved);
      writeSessionSnapshot({ owner: `user:${user.id}`, key: SNAPSHOT_KEY, data: saved });
      return saved;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Workspace setup could not be saved.";
      setError(message);
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [preferences, user.id, user.is_guest]);

  const recordEntryEvent = useCallback(async (event: EntryFlowEvent, path: string, metadata: Record<string, unknown> = {}) => {
    if (user.is_guest || E2E_LOCAL_PERSISTENCE || !isSupabaseConfigured()) return;
    const safePath = normalizeAppPath(path);
    const { error: eventError } = await getSupabaseBrowserClient().from("entry_flow_events").insert({
      user_id: user.id,
      event_type: event,
      path: safePath,
      metadata,
    });
    if (eventError) console.warn("Entry-flow analytics could not be recorded.", eventError.message);
  }, [user.id, user.is_guest]);

  const value = useMemo<OnboardingContextValue>(() => ({
    preferences,
    loading: authLoading || loading,
    refreshing,
    saving,
    error,
    savePreferences,
    recordEntryEvent,
  }), [authLoading, error, loading, preferences, recordEntryEvent, refreshing, savePreferences, saving]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return context;
}

function normalizeHorizon(value: string | undefined): InvestmentHorizon {
  if (value === "3-5-years" || value === "3–5 years") return "3-5-years";
  if (value === "10-plus-years" || value === "10+ years") return "10-plus-years";
  return "5-10-years";
}

function normalizeRisk(value: string | undefined): RiskTolerance {
  const normalized = value?.toLowerCase();
  if (normalized === "conservative" || normalized === "growth") return normalized;
  return "moderate";
}
