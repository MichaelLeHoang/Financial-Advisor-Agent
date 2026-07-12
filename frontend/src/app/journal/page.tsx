"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Plus, TrendingUp } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { JournalAnalytics, JournalEntry, JournalEntryRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkspacePrototype, type JournalEvent } from "@/components/workspace/WorkspacePrototypeProvider";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

const EMPTY_FORM: JournalEntryRequest = {
  symbol: "",
  direction: "long",
  entry_price: 0,
  exit_price: null,
  quantity: 1,
  fees: 0,
  tags: [],
};

export default function JournalPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { state } = useWorkspacePrototype();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [analytics, setAnalytics] = useState<JournalAnalytics | null>(null);
  const [form, setForm] = useState<JournalEntryRequest>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseJournal = PLAN_RANK[user.plan] >= PLAN_RANK.trader;
  const view = pathname === "/journal/investments" ? "investments" : pathname === "/journal/trades" ? "trades" : pathname === "/journal/strategies" ? "strategies" : pathname === "/journal/agent-actions" ? "agent-actions" : "all";
  const visibleEvents = state.journal.filter((event) => view === "all" || (view === "investments" && event.workspace === "investment") || (view === "trades" && event.workspace === "trading") || (view === "strategies" && event.workspace === "strategy"));

  useEffect(() => {
    if (!canUseJournal || view !== "trades") return;
    void refresh();
  }, [canUseJournal, view]);

  const topSymbols = useMemo(() => Object.entries(analytics?.by_symbol ?? {}).slice(0, 4), [analytics]);
  const topTags = useMemo(() => Object.entries(analytics?.by_tag ?? {}).slice(0, 4), [analytics]);

  if (view !== "trades") {
    const emptyMessage = view === "investments" ? "Investment decisions will appear after an Invest review is recorded." : view === "strategies" ? "Strategy versions and paper deployments will appear after they are approved in Strategy Studio." : view === "agent-actions" ? "Auditable agent actions will appear after automatic journal events are connected." : "Decisions from Invest, Trade, and Strategy Studio will appear here.";
    return <div className="flex-1 overflow-y-auto p-5 lg:p-8"><div className="mx-auto max-w-6xl"><PrototypeTimeline events={visibleEvents} emptyMessage={emptyMessage} /></div></div>;
  }

  if (!canUseJournal) {
    return (
      <div className="flex-1 overflow-y-auto p-5 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-7">
          <PrototypeTimeline events={visibleEvents} />
          <LockedFeature
            title="Detailed trade analytics are available on Trader"
            description="The shared decision timeline is available to every account. Upgrade for manual trade entries and performance analytics."
            requiredPlan="trader"
            benefits={["Structured trade notes", "P/L and return calculations", "Journal analytics"]}
          />
        </div>
      </div>
    );
  }

  async function refresh() {
    try {
      const [nextEntries, nextAnalytics] = await Promise.all([api.journalEntries(), api.journalAnalytics()]);
      setEntries(nextEntries);
      setAnalytics(nextAnalytics);
    } catch {
      setEntries([]);
      setAnalytics(null);
    }
  }

  const addTag = () => {
    const normalized = tagInput.trim();
    if (normalized && !form.tags.includes(normalized)) setForm((current) => ({ ...current, tags: [...current.tags, normalized] }));
    setTagInput("");
  };

  const submit = async () => {
    if (!form.symbol.trim() || form.entry_price <= 0 || form.quantity <= 0) {
      setError("Symbol, entry price, and quantity are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      await api.createJournalEntry({ ...form, symbol: form.symbol.trim().toUpperCase() });
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to save journal entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-7">
        <PrototypeTimeline events={visibleEvents} />
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Detailed trade journal</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Record trades with context, tags, and neutral performance analytics.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <BookOpen className="h-4 w-4 text-indigo-primary" />
            Trader workflow
          </div>
        </div>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4 text-indigo-primary" />
                New journal entry
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Symbol">
                  <Input value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} className="h-11 rounded-xl" />
                </Field>
                <Field label="Direction">
                  <select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as "long" | "short" })} className="h-11 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm text-[var(--text-primary)] outline-none">
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </Field>
                <NumberField label="Entry price" value={form.entry_price} onChange={(value) => setForm({ ...form, entry_price: value })} />
                <NumberField label="Exit price" value={form.exit_price ?? 0} onChange={(value) => setForm({ ...form, exit_price: value || null })} />
                <NumberField label="Quantity" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} />
                <NumberField label="Fees" value={form.fees} onChange={(value) => setForm({ ...form, fees: value })} />
              </div>

              <Field label="Tags">
                <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-3">
                  {form.tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))} className="rounded-lg bg-indigo-primary/14 px-3 py-1 text-xs font-semibold text-indigo-primary">
                      {tag}
                    </button>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes ?? ""}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="min-h-24 w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--surface-control)] p-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-primary/35"
                />
              </Field>

              <Button onClick={submit} disabled={loading} className="accent-gradient-surface on-accent h-12 w-full rounded-xl text-sm font-semibold">
                {loading ? "Saving..." : "Save entry"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Entries" value={String(analytics?.total_entries ?? 0)} />
              <Metric label="Closed" value={String(analytics?.closed_entries ?? 0)} />
              <Metric label="Total P/L" value={formatCurrency(analytics?.total_pnl ?? 0)} tone={(analytics?.total_pnl ?? 0) >= 0 ? "positive" : "negative"} />
              <Metric label="Win rate" value={formatPercent(analytics?.win_rate ?? 0)} />
            </div>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="grid gap-5 p-5 md:grid-cols-2">
                <AnalyticsGroup title="By symbol" items={topSymbols} />
                <AnalyticsGroup title="By tag" items={topTags} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-indigo-primary" />
                  Recent entries
                </div>
                {entries.length > 0 ? entries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-3 text-sm">
                    <div>
                      <div className="font-semibold">{entry.symbol} <span className="text-xs font-normal uppercase text-[var(--text-muted)]">{entry.direction}</span></div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{entry.tags.join(", ") || "No tags"}</div>
                    </div>
                    <div className={cn("text-right font-semibold", (entry.pnl ?? 0) >= 0 ? "text-green-positive" : "text-red-negative")}>
                      {entry.pnl === null || entry.pnl === undefined ? "Open" : formatCurrency(entry.pnl)}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-4 text-sm text-[var(--text-muted)]">
                    No journal entries yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Journal analytics are historical records for self-review. They are not financial advice or a recommendation to trade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <Input type="number" value={value} min={0} step="0.01" onChange={(event) => onChange(Number(event.target.value))} className="h-11 rounded-xl" />
    </Field>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className={cn("mt-2 text-xl font-semibold", tone === "positive" && "text-green-positive", tone === "negative" && "text-red-negative")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function AnalyticsGroup({ title, items }: { title: string; items: Array<[string, { count: number; pnl: number }]> }) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="space-y-2">
        {items.length > 0 ? items.map(([label, item]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-3 py-2 text-sm">
            <span>{label}</span>
            <span className={cn("font-semibold", item.pnl >= 0 ? "text-green-positive" : "text-red-negative")}>{formatCurrency(item.pnl)}</span>
          </div>
        )) : <div className="text-sm text-[var(--text-muted)]">No closed trades yet.</div>}
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function PrototypeTimeline({ events, emptyMessage = "No decisions yet. Complete the guided flow in Invest or submit a simulated paper fill in Trade." }: { events: JournalEvent[]; emptyMessage?: string }) {
  return (
    <section className="border border-[var(--theme-border)] bg-[var(--surface-card)] p-5 text-[var(--text-primary)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">Decision timeline</p><h1 className="mt-2 text-3xl font-semibold">Investment and trading journal</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Consequential reviews stay linked to their original workspace.</p></div>
        <div className="flex gap-3 text-xs"><span className="text-emerald-400">Investment</span><span className="text-sky-300">Trading</span></div>
      </div>
      <div className="mt-6 divide-y divide-[var(--theme-border)] border-t border-[var(--theme-border)]">
        {events.length ? events.map((event) => (
          <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[110px_1fr_auto] sm:items-start">
            <span className={event.workspace === "investment" ? "text-xs font-semibold text-emerald-400" : "text-xs font-semibold text-sky-300"}>{event.workspace}</span>
            <div><p className="text-sm font-semibold">{event.symbol} · {event.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{event.detail}</p></div>
            <time className="text-xs text-[var(--text-subtle)]">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
        )) : <div className="py-8 text-sm text-[var(--text-muted)]">{emptyMessage}</div>}
      </div>
    </section>
  );
}
