"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export type WorkspacePreference = "investing" | "trading" | "both";
export type PositionBook = "unclassified" | "investment" | "trading";
export type DecisionAction = "hold" | "trim";

export interface JournalEvent {
  id: string;
  workspace: "investment" | "trading";
  symbol: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface PrototypeState {
  positionBook: PositionBook;
  thesis: string;
  thesisStatus: "missing" | "healthy";
  maximumPositionWeight: number | null;
  investmentDecision: DecisionAction | null;
  paperOrderStatus: "draft" | "previewed" | "filled";
  journal: JournalEvent[];
}

export interface TradePlanInput {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
  riskBudget: number;
  buyingPower: number;
  currentPortfolioHeat: number;
}

export interface TradePlanResult {
  riskPerShare: number;
  quantity: number;
  capitalRequired: number;
  maximumLoss: number;
  rewardToRisk: number;
  resultingPortfolioHeat: number;
  policyPassed: boolean;
  issues: string[];
}

const INITIAL_STATE: PrototypeState = {
  positionBook: "unclassified",
  thesis: "",
  thesisStatus: "missing",
  maximumPositionWeight: null,
  investmentDecision: null,
  paperOrderStatus: "draft",
  journal: [],
};

type WorkspaceContextValue = {
  state: PrototypeState;
  classifyPosition: (book: PositionBook) => void;
  saveThesis: (thesis: string) => void;
  setMaximumPositionWeight: (weight: number) => void;
  recordInvestmentDecision: (action: DecisionAction) => void;
  previewPaperOrder: () => void;
  fillPaperOrder: (plan: TradePlanInput, result: TradePlanResult) => void;
  resetPrototype: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function eventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `event-${Date.now()}`;
}

export function calculateTradePlan(input: TradePlanInput): TradePlanResult {
  const riskPerShare = Math.max(0, Math.abs(input.entry - input.stop));
  const riskQuantity = riskPerShare > 0 ? Math.floor(input.riskBudget / riskPerShare) : 0;
  const buyingPowerQuantity = input.entry > 0 ? Math.floor(input.buyingPower / input.entry) : 0;
  const quantity = Math.max(0, Math.min(riskQuantity, buyingPowerQuantity));
  const maximumLoss = quantity * riskPerShare;
  const rewardToRisk = riskPerShare > 0 ? Math.abs(input.target - input.entry) / riskPerShare : 0;
  const resultingPortfolioHeat = input.currentPortfolioHeat + (maximumLoss / 100_000) * 100;
  const issues: string[] = [];

  if (input.stop >= input.entry) issues.push("Stop must be below entry for a long trade.");
  if (input.target <= input.entry) issues.push("Target must be above entry for a long trade.");
  if (rewardToRisk < 2) issues.push("Reward-to-risk is below the 2.0 policy minimum.");
  if (resultingPortfolioHeat > 4) issues.push("Portfolio heat would exceed the 4.0% limit.");
  if (quantity < 1) issues.push("Buying power or risk budget is insufficient.");

  return {
    riskPerShare,
    quantity,
    capitalRequired: quantity * input.entry,
    maximumLoss,
    rewardToRisk,
    resultingPortfolioHeat,
    policyPassed: issues.length === 0,
    issues,
  };
}

export function WorkspacePrototypeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<PrototypeState>(INITIAL_STATE);
  const skipNextPersistenceRef = useRef(true);
  const scope = user.is_guest ? "guest" : `user:${user.id}`;
  const storageKey = `quanfora.workspace-prototype.${scope}`;

  useEffect(() => {
    if (loading) return;
    skipNextPersistenceRef.current = true;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      setState(stored ? { ...INITIAL_STATE, ...JSON.parse(stored) } : INITIAL_STATE);
    } catch {
      setState(INITIAL_STATE);
    }
  }, [loading, storageKey]);

  useEffect(() => {
    if (loading) return;
    document.body.dataset.workspaceReady = "true";
    return () => {
      delete document.body.dataset.workspaceReady;
    };
  }, [loading, storageKey]);

  useEffect(() => {
    if (loading) return;
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false;
      return;
    }
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The prototype remains usable when browser storage is unavailable.
    }
  }, [loading, state, storageKey]);

  const commitState = useCallback((updater: (current: PrototypeState) => PrototypeState) => {
    setState((current) => {
      const next = updater(current);
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // State still updates in memory when browser storage is unavailable.
      }
      return next;
    });
  }, [storageKey]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    state,
    classifyPosition: (positionBook) => commitState((current) => ({ ...current, positionBook })),
    saveThesis: (thesis) => commitState((current) => ({ ...current, thesis, thesisStatus: thesis.trim() ? "healthy" : "missing" })),
    setMaximumPositionWeight: (maximumPositionWeight) => commitState((current) => ({ ...current, maximumPositionWeight })),
    recordInvestmentDecision: (investmentDecision) => commitState((current) => ({
      ...current,
      investmentDecision,
      journal: [{
        id: eventId(),
        workspace: "investment",
        symbol: "NVDA",
        title: `${investmentDecision === "trim" ? "Trim" : "Hold"} decision recorded`,
        detail: investmentDecision === "trim"
          ? "Reduce NVDA toward the 10% position policy while keeping the long-term thesis active."
          : "Maintain NVDA and review the concentration exception at the next policy checkpoint.",
        createdAt: new Date().toISOString(),
      }, ...current.journal],
    })),
    previewPaperOrder: () => commitState((current) => ({ ...current, paperOrderStatus: "previewed" })),
    fillPaperOrder: (plan, result) => commitState((current) => ({
      ...current,
      paperOrderStatus: "filled",
      journal: [{
        id: eventId(),
        workspace: "trading",
        symbol: plan.symbol,
        title: "Paper order filled",
        detail: `${result.quantity} shares filled at the illustrative $${plan.entry.toFixed(2)} entry; planned maximum loss $${result.maximumLoss.toFixed(0)}.`,
        createdAt: new Date().toISOString(),
      }, ...current.journal],
    })),
    resetPrototype: () => commitState(() => INITIAL_STATE),
  }), [commitState, state]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspacePrototype() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspacePrototype must be used inside WorkspacePrototypeProvider");
  return context;
}
