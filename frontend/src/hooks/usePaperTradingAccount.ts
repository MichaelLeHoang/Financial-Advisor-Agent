"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiPaperTradingService, type PaperAccount, type PaperAccountSnapshot, type PaperOrderRequest } from "@/lib/trading/paperTradingService";

export function usePaperTradingAccount(ownerScope: string) {
  const service = useMemo(() => new ApiPaperTradingService(), []);
  const [accounts, setAccounts] = useState<PaperAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PaperAccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (accountId: string, refresh = false) => {
    const next = refresh ? await service.refresh(accountId) : await service.snapshot(accountId);
    setSnapshot(next);
    return next;
  }, [service]);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    service.listAccounts()
      .then(async (nextAccounts) => {
        if (canceled) return;
        setAccounts(nextAccounts);
        const stored = window.sessionStorage.getItem(`quanfora.paper-account.${ownerScope}`);
        const accountId = nextAccounts.some((account) => account.id === stored) ? stored : nextAccounts[0]?.id;
        if (!accountId) return;
        setActiveAccountId(accountId);
        window.sessionStorage.setItem(`quanfora.paper-account.${ownerScope}`, accountId);
        const next = await service.snapshot(accountId);
        if (!canceled) setSnapshot(next);
      })
      .catch((reason) => { if (!canceled) setError(reason instanceof Error ? reason.message : "Paper account could not load."); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [ownerScope, service]);

  useEffect(() => {
    if (!activeAccountId || !snapshot?.summary.open_orders) return;
    const timer = window.setInterval(() => {
      void loadSnapshot(activeAccountId, true).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [activeAccountId, loadSnapshot, snapshot?.summary.open_orders]);

  const selectAccount = useCallback(async (accountId: string) => {
    setActiveAccountId(accountId);
    window.sessionStorage.setItem(`quanfora.paper-account.${ownerScope}`, accountId);
    setLoading(true);
    try { await loadSnapshot(accountId); } finally { setLoading(false); }
  }, [loadSnapshot, ownerScope]);

  const submitOrder = useCallback(async (input: PaperOrderRequest) => {
    if (!activeAccountId) throw new Error("Paper account is unavailable.");
    const order = await service.submitOrder(activeAccountId, input);
    await loadSnapshot(activeAccountId);
    return order;
  }, [activeAccountId, loadSnapshot, service]);

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!activeAccountId) return;
    await service.cancelOrder(orderId);
    await loadSnapshot(activeAccountId);
  }, [activeAccountId, loadSnapshot, service]);

  const refresh = useCallback(async () => {
    if (!activeAccountId) return null;
    return loadSnapshot(activeAccountId, true);
  }, [activeAccountId, loadSnapshot]);

  return { accounts, activeAccountId, snapshot, loading, error, selectAccount, submitOrder, cancelOrder, refresh };
}
