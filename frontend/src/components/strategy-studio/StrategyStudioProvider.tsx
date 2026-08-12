"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useWorkspacePrototype } from "@/components/workspace/WorkspacePrototypeProvider";
import { createDraft, initialStrategyState } from "@/components/strategy-studio/model";
import type { StrategyDraft, StrategyMode, StrategyStudioState } from "@/components/strategy-studio/types";

interface StrategyStudioContextValue {
  state: StrategyStudioState;
  createStrategy: (mode: StrategyMode) => StrategyDraft;
  updateStrategy: (draftId: string, updater: (draft: StrategyDraft) => StrategyDraft) => void;
  saveVersion: (draftId: string, nodes: StrategyDraft["nodes"]) => void;
  deployPaper: (draftId: string) => void;
}

const StrategyStudioContext = createContext<StrategyStudioContextValue | null>(null);

function createId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

export function StrategyStudioProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { recordStrategyEvent } = useWorkspacePrototype();
  const [state, setState] = useState<StrategyStudioState>(initialStrategyState);
  const skipNextPersistenceRef = useRef(true);
  const scope = user.is_guest ? "guest" : `user:${user.id}`;
  const storageKey = `quanfora.strategy-studio.${scope}`;

  useEffect(() => {
    if (loading) return;
    skipNextPersistenceRef.current = true;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      setState(stored ? { ...initialStrategyState(), ...JSON.parse(stored) } : initialStrategyState());
    } catch {
      setState(initialStrategyState());
    }
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
      // The prototype remains usable in memory when browser storage is unavailable.
    }
  }, [loading, state, storageKey]);

  const commit = useCallback((updater: (current: StrategyStudioState) => StrategyStudioState) => {
    setState((current) => {
      const next = updater(current);
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // State still updates in memory.
      }
      return next;
    });
  }, [storageKey]);

  const value = useMemo<StrategyStudioContextValue>(() => ({
    state,
    createStrategy: (mode) => {
      const draft = createDraft(mode, createId(mode));
      commit((current) => ({ ...current, drafts: [draft, ...current.drafts] }));
      return draft;
    },
    updateStrategy: (draftId, updater) => commit((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => draft.id === draftId ? { ...updater(draft), updatedAt: new Date().toISOString() } : draft),
    })),
    saveVersion: (draftId, nodes) => {
      const selected = state.drafts.find((draft) => draft.id === draftId);
      if (selected) recordStrategyEvent(selected.name, `Draft version ${selected.versions.length + 1} saved`, "The structured definition was saved in this browser session for prototype review.");
      commit((current) => ({
        ...current,
        drafts: current.drafts.map((draft) => {
          if (draft.id !== draftId) return draft;
          const number = draft.versions.length + 1;
          return {
            ...draft,
            nodes,
            versions: [{
              id: createId("version"),
              number,
              createdAt: new Date().toISOString(),
              nodes: structuredClone(nodes),
              summary: `${nodes.length} top-level rules in ${draft.mode} mode`,
            }, ...draft.versions],
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    deployPaper: (draftId) => {
      const selected = state.drafts.find((draft) => draft.id === draftId);
      if (selected) recordStrategyEvent(selected.name, "Paper deployment approved", "Prototype deployment recorded. No scheduler, broker, or live order was started.");
      commit((current) => ({
        ...current,
        drafts: current.drafts.map((draft) => draft.id === draftId ? { ...draft, status: "paper", updatedAt: new Date().toISOString() } : draft),
      }));
    },
  }), [commit, recordStrategyEvent, state]);

  return <StrategyStudioContext.Provider value={value}>{children}</StrategyStudioContext.Provider>;
}

export function useStrategyStudio() {
  const context = useContext(StrategyStudioContext);
  if (!context) throw new Error("useStrategyStudio must be used inside StrategyStudioProvider");
  return context;
}
