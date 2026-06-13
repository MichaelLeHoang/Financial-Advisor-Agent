"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FlaskConical, Pencil, Play, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { BacktestRun, ReplaySession } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Field, PLAN_RANK, formatPercent, formatStrategyType } from "@/components/backtest/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEFAULT_FORM = {
  name: "",
  symbol: "",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  initial_balance: 10000,
};

export default function BacktestSessionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [symbolInput, setSymbolInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const canUseBacktesting = PLAN_RANK[user.plan] >= PLAN_RANK.trader;

  useEffect(() => {
    if (!canUseBacktesting) return;
    void refresh();
  }, [canUseBacktesting]);

  if (!canUseBacktesting) {
    return (
      <LockedFeature
        title="Backtest Lab is available on Trader"
        description="Run historical strategy simulations, manage saved sessions, and practice trading with bar-by-bar replay."
        requiredPlan="trader"
        benefits={["Saved strategy runs", "Manual replay sessions", "Trade-level simulation history"]}
      />
    );
  }

  const refresh = async () => {
    setLoading(true);
    try {
      const [fetchedRuns, fetchedSessions] = await Promise.all([api.backtestRuns(), api.replaySessions()]);
      setRuns(fetchedRuns);
      setSessions(fetchedSessions);
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to load sessions.");
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    const symbol = (form.symbol || symbolInput).trim().toUpperCase();
    if (!symbol) {
      setError("Choose a symbol for the replay session.");
      return;
    }
    setCreating(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      const session = await api.createReplaySession({
        name: form.name.trim() || `${symbol} replay`,
        symbol,
        start_date: form.start_date,
        end_date: form.end_date,
        initial_balance: form.initial_balance,
      });
      router.push(`/backtest/replay/${session.id}`);
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to create the replay session.");
      setCreating(false);
    }
  };

  const deleteRun = async (run: BacktestRun) => {
    if (!window.confirm(`Delete the run "${run.strategy_name}"?`)) return;
    try {
      await api.deleteBacktestRun(run.id);
      setRuns((current) => current.filter((item) => item.id !== run.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete the run.");
    }
  };

  const deleteSession = async (session: ReplaySession) => {
    if (!window.confirm(`Delete the replay session "${session.name}"?`)) return;
    try {
      await api.deleteReplaySession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete the session.");
    }
  };

  const saveRename = async (session: ReplaySession) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === session.name) return;
    try {
      const updated = await api.updateReplaySession(session.id, { name });
      setSessions((current) => current.map((item) => (item.id === session.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename the session.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/backtest" className="inline-flex w-fit items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back to Backtest Lab
        </Link>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Sessions & History</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Reopen saved strategy runs or practice trading bar-by-bar in manual replay sessions.
            </p>
          </div>
          <Button onClick={() => setShowCreate((current) => !current)} className="accent-gradient-surface on-accent h-11 rounded-xl text-sm font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            New replay session
          </Button>
        </div>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="text-sm text-red-negative">{error}</div>}

        {showCreate && (
          <Card className="rounded-2xl border border-indigo-primary/25 bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
            <CardContent className="space-y-4 p-6">
              <div className="text-sm font-semibold">Create replay session</div>
              <p className="text-xs leading-5 text-[var(--text-muted)]">
                Pick a symbol and period, then step through daily bars and place your own trades. Fills are simulated at each bar's close.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Session name">
                  <Input value={form.name} placeholder="AAPL practice run" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" />
                </Field>
                <Field label="Symbol">
                  <TickerSuggestionInput
                    value={symbolInput}
                    onValueChange={(value) => {
                      setSymbolInput(value);
                      setForm((current) => ({ ...current, symbol: value }));
                    }}
                    onSelect={(value) => {
                      setSymbolInput(value);
                      setForm((current) => ({ ...current, symbol: value }));
                    }}
                    existingTickers={[]}
                    placeholder="AAPL"
                  />
                </Field>
                <Field label="Start date">
                  <Input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} className="h-11 rounded-xl" />
                </Field>
                <Field label="End date">
                  <Input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} className="h-11 rounded-xl" />
                </Field>
                <Field label="Initial balance">
                  <Input type="number" min={100} value={form.initial_balance} onChange={(event) => setForm((current) => ({ ...current, initial_balance: Number(event.target.value) }))} className="h-11 rounded-xl" />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button onClick={createSession} disabled={creating} className="accent-gradient-surface on-accent h-11 rounded-xl text-sm font-semibold">
                  {creating ? "Creating..." : "Create and open"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)} className="h-11 rounded-xl text-sm">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Play className="h-4 w-4 text-indigo-primary" />
              Replay sessions
            </div>
            <div className="mt-4 space-y-2">
              {loading && <div className="text-sm text-[var(--text-muted)]">Loading...</div>}
              {!loading && sessions.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  No replay sessions yet. Create one to practice trading bar-by-bar.
                </div>
              )}
              {sessions.map((session) => {
                const progress = session.total_bars > 0 ? Math.min(session.current_index / session.total_bars, 1) : 0;
                const equity = session.equity_curve.at(-1)?.value ?? session.initial_balance;
                const returnPct = equity / session.initial_balance - 1;
                return (
                  <div key={session.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        {renamingId === session.id ? (
                          <div className="flex items-center gap-2">
                            <Input value={renameValue} autoFocus onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void saveRename(session)} className="h-8 w-56 rounded-lg text-sm" />
                            <button type="button" onClick={() => void saveRename(session)} aria-label="Save name" className="text-green-positive"><Check className="h-4 w-4" /></button>
                            <button type="button" onClick={() => setRenamingId(null)} aria-label="Cancel rename" className="text-[var(--text-muted)]"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{session.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingId(session.id);
                                setRenameValue(session.name);
                              }}
                              aria-label={`Rename ${session.name}`}
                              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {session.symbol} · {session.start_date} → {session.end_date}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs font-semibold", returnPct >= 0 ? "text-green-positive" : "text-red-negative")}>{formatPercent(returnPct)}</span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                            session.status === "completed" ? "bg-green-positive/15 text-green-positive" : "bg-indigo-primary/15 text-indigo-primary"
                          )}
                        >
                          {session.status}
                        </span>
                        <Button render={<Link href={`/backtest/replay/${session.id}`} />} variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                          {session.status === "completed" ? "Review" : "Resume"}
                        </Button>
                        <button type="button" onClick={() => void deleteSession(session)} aria-label={`Delete ${session.name}`} className="text-[var(--text-muted)] hover:text-red-negative">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-control)]">
                      <div className="h-full rounded-full bg-indigo-primary/70" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {session.current_index} / {session.total_bars} bars
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="h-4 w-4 text-indigo-primary" />
              Strategy runs
            </div>
            <div className="mt-4 space-y-2">
              {loading && <div className="text-sm text-[var(--text-muted)]">Loading...</div>}
              {!loading && runs.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  No saved runs yet. Run a backtest from the lab to see it here.
                </div>
              )}
              {runs.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/backtest/runs/${run.id}`} className="truncate text-sm font-semibold hover:text-indigo-primary">
                      {run.strategy_name}
                    </Link>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatStrategyType(run.strategy_type)} · {run.symbols.join(", ")} · {new Date(run.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-semibold", run.metrics.total_return >= 0 ? "text-green-positive" : "text-red-negative")}>
                      {formatPercent(run.metrics.total_return)}
                    </span>
                    <Button render={<Link href={`/backtest/runs/${run.id}`} />} variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                      Open
                    </Button>
                    <Button render={<Link href={`/backtest?rerun=${run.id}`} />} variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                      <RefreshCcw className="mr-1 h-3 w-3" />
                      Re-run
                    </Button>
                    <button type="button" onClick={() => void deleteRun(run)} aria-label={`Delete ${run.strategy_name}`} className="text-[var(--text-muted)] hover:text-red-negative">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
