"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Panel, PanelHeading, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { calculateTradePlan, useWorkspacePrototype, type TradePlanInput } from "@/components/workspace/WorkspacePrototypeProvider";
import { usePortfolioBooks } from "@/components/portfolio/PortfolioBooksProvider";
import type { PortfolioBooks } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const QUOTES: Record<string, number> = { AMD: 170, NVDA: 132, AAPL: 226 };

export default function TradePage() {
  const { state, previewPaperOrder, fillPaperOrder } = useWorkspacePrototype();
  const { summary } = usePortfolioBooks();
  const [plan, setPlan] = useState<TradePlanInput>({ symbol: "AMD", entry: 170, stop: 164, target: 182, riskBudget: 600, buyingPower: 20_000, currentPortfolioHeat: 2.4 });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [timeframe, setTimeframe] = useState("1h");
  const [activeTradeTab, setActiveTradeTab] = useState("Positions");
  const result = useMemo(() => calculateTradePlan(plan), [plan]);

  const selectSymbol = (symbol: string) => {
    const entry = QUOTES[symbol];
    setPlan((current) => ({ ...current, symbol, entry, stop: entry - 6, target: entry + 12 }));
  };

  return (
    <WorkspacePage dense eyebrow="Trading workspace" title="Paper Trading Desk" description="Plan the trade, calculate exposure, and review policy before a simulated order reaches the journal." actions={<span className="inline-flex h-10 items-center gap-2 rounded-full border border-sky-400/35 bg-sky-400/10 px-4 text-sm font-semibold text-sky-300"><span className="size-2 rounded-full bg-sky-300" /> Paper · illustrative</span>}>
      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[210px_minmax(420px,1fr)_340px]">
        <Panel className="p-0">
          <div className="border-b border-[var(--theme-border)] p-4"><p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">Watchlist</p></div>
          <div>{Object.entries(QUOTES).map(([symbol, quote]) => <button key={symbol} type="button" aria-pressed={plan.symbol === symbol} onClick={() => selectSymbol(symbol)} className={`flex w-full items-center justify-between border-b border-[var(--theme-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-card-hover)] ${plan.symbol === symbol ? "bg-[var(--surface-selected)]" : ""}`}><span><strong className="block text-sm">{symbol}</strong><span className="text-xs text-[var(--text-muted)]">NASDAQ</span></span><span className="text-right tabular-nums"><strong className="block text-sm">${quote.toFixed(2)}</strong><span className="text-xs text-emerald-400">+1.24%</span></span></button>)}</div>
          <div className="p-4"><p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">Signals</p><div className="mt-3 flex gap-2 text-xs text-[var(--text-muted)]"><Activity className="size-4 text-sky-300" /> Momentum setup is active. No order submitted.</div></div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="relative min-h-[390px] overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-3"><div><strong>{plan.symbol}</strong><span className="ml-2 text-xs tabular-nums text-[var(--text-muted)]">${plan.entry.toFixed(2)} · +1.24%</span></div><div className="flex rounded-full bg-[var(--surface-control)] p-1" role="group" aria-label="Chart timeframe">{["5m", "15m", "1h", "1D"].map((option) => <button key={option} type="button" aria-pressed={timeframe === option} onClick={() => setTimeframe(option)} className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${timeframe === option ? "bg-[var(--surface-selected)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)]"}`}>{option}</button>)}</div></div>
            <TradeChart />
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-4 text-xs tabular-nums"><span className="text-emerald-400">Target ${plan.target.toFixed(2)}</span><span className="text-[var(--text-primary)]">Entry ${plan.entry.toFixed(2)}</span><span className="text-rose-400">Stop ${plan.stop.toFixed(2)}</span></div>
          </Panel>
          <Panel className="p-0">
            <div className="flex overflow-x-auto border-b border-[var(--theme-border)]" role="tablist" aria-label="Trading desk views">{["Positions", "Orders", "Fills", "Signals", "Journal", "Portfolio Risk"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTradeTab === tab} onClick={() => setActiveTradeTab(tab)} className={`relative h-11 shrink-0 px-4 text-xs font-semibold ${activeTradeTab === tab ? "text-[var(--text-primary)] after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-indigo-primary" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{tab}</button>)}</div>
            <div className="p-4" role="tabpanel" aria-live="polite"><TradeTabContent tab={activeTradeTab} status={state.paperOrderStatus} symbol={plan.symbol} quantity={result.quantity} entry={plan.entry} summary={summary} /></div>
          </Panel>
        </div>

        <Panel className="p-0">
          <div className="border-b border-[var(--theme-border)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Trade plan</p><Status tone="neutral">Long · Day</Status></div></div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2"><NumberInput label="Entry" value={plan.entry} onChange={(entry) => setPlan({ ...plan, entry })} /><NumberInput label="Stop" value={plan.stop} onChange={(stop) => setPlan({ ...plan, stop })} /><NumberInput label="Target" value={plan.target} onChange={(target) => setPlan({ ...plan, target })} /></div>
            <NumberInput label="Risk budget ($)" value={plan.riskBudget} onChange={(riskBudget) => setPlan({ ...plan, riskBudget })} wide />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[var(--theme-border)] py-4"><Result label="Quantity" value={`${result.quantity} shares`} /><Result label="Capital" value={money(result.capitalRequired)} /><Result label="Max loss" value={money(result.maximumLoss)} /><Result label="Reward / risk" value={`${result.rewardToRisk.toFixed(2)} : 1`} /><Result label="Heat after" value={`${result.resultingPortfolioHeat.toFixed(2)}%`} /><Result label="Risk / share" value={money(result.riskPerShare)} /></div>
            <div className={`rounded-lg border-l-2 p-3 ${result.policyPassed ? "border-emerald-400 bg-emerald-400/7" : "border-rose-400 bg-rose-400/7"}`}><div className="flex items-center gap-2 text-sm font-semibold">{result.policyPassed ? <ShieldCheck className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-rose-400" />}{result.policyPassed ? "Policy passed" : "Policy blocked"}</div>{result.issues.map((issue) => <p key={issue} className="mt-2 text-xs text-rose-300">{issue}</p>)}{result.policyPassed && <p className="mt-2 text-xs text-[var(--text-muted)]">Risk, buying power, reward, and portfolio heat are within paper policy.</p>}</div>
            <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
              <AlertDialogTrigger render={<button type="button" disabled={!result.policyPassed} className="theme-solid-action h-11 w-full rounded-full text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35" />}>Review paper order</AlertDialogTrigger>
              <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader><p className="text-xs font-semibold uppercase text-sky-300">Paper order preview</p><AlertDialogTitle>Buy {result.quantity} {plan.symbol}</AlertDialogTitle><AlertDialogDescription>This creates a simulated fill only. No live broker is connected.</AlertDialogDescription></AlertDialogHeader>
                <div className="mt-6 grid grid-cols-2 gap-4 text-sm"><Result label="Illustrative entry" value={money(plan.entry)} /><Result label="Capital required" value={money(result.capitalRequired)} /><Result label="Planned stop" value={money(plan.stop)} /><Result label="Maximum loss" value={money(result.maximumLoss)} /></div>
                <div className="mt-5 flex gap-2 border-l-2 border-amber-300 bg-amber-300/7 p-3 text-xs text-[var(--text-muted)]"><Clock3 className="size-4 shrink-0 text-amber-300" /> Paper mode remains isolated from broker execution.</div>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { previewPaperOrder(); fillPaperOrder(plan, result); setActiveTradeTab("Fills"); }}>Confirm simulated fill</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Panel>
      </div>
    </WorkspacePage>
  );
}

function NumberInput({ label, value, onChange, wide = false }: { label: string; value: number; onChange: (value: number) => void; wide?: boolean }) { return <label className={wide ? "block" : "min-w-0"}><span className="mb-1 block text-[11px] text-[var(--text-muted)]">{label}</span><input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-full min-w-0 rounded-xl border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 text-sm tabular-nums outline-none focus:border-indigo-primary/50 focus:ring-2 focus:ring-indigo-primary/25" /></label>; }
function Result({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0); }
function TradeTabContent({ tab, status, symbol, quantity, entry, summary }: { tab: string; status: "draft" | "previewed" | "filled"; symbol: string; quantity: number; entry: number; summary: PortfolioBooks | null }) {
  if (tab === "Fills" && status === "filled") return <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-emerald-400" /> {quantity} {symbol} shares filled at ${entry.toFixed(2)}</div><Status tone="positive">Simulated fill</Status></div>;
  if (tab === "Orders") return <p className="text-sm text-[var(--text-muted)]">{status === "filled" ? `The ${symbol} paper order is filled.` : "No reviewed paper orders in this session."}</p>;
  if (tab === "Signals") return <p className="text-sm text-[var(--text-muted)]">Momentum setup active for {symbol}; no automatic order is enabled.</p>;
  if (tab === "Journal") return <p className="text-sm text-[var(--text-muted)]">Completed simulated fills are recorded in the shared Decision Journal.</p>;
  if (tab === "Portfolio Risk") return <div className="grid gap-3 sm:grid-cols-3"><Result label="Recorded exposure" value={money(summary?.risk.gross_exposure ?? 0)} /><Result label="Trading allocation" value={`${(summary?.risk.trading_weight ?? 0).toFixed(1)}%`} /><Result label="Needs classification" value={String(summary?.risk.unclassified_count ?? 0)} /></div>;
  return <p className="text-sm text-[var(--text-muted)]">{tab === "Fills" ? "No simulated fills in this session." : "No open paper positions from this prototype session."}</p>;
}
function TradeChart() { return <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[53px] bg-[linear-gradient(var(--chart-grid)_1px,transparent_1px),linear-gradient(90deg,var(--chart-grid)_1px,transparent_1px)] bg-[size:48px_48px]"><svg viewBox="0 0 800 340" preserveAspectRatio="none" className="h-full w-full" aria-label="Illustrative price chart with target and stop levels" role="img"><defs><linearGradient id="trade-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-cyan-secondary)" stopOpacity=".24"/><stop offset="1" stopColor="var(--color-cyan-secondary)" stopOpacity="0"/></linearGradient></defs><path d="M0 270 C70 250 100 280 155 230 S250 195 300 220 S390 150 445 175 S530 125 585 145 S680 72 800 88 L800 340 L0 340Z" fill="url(#trade-fill)"/><path d="M0 270 C70 250 100 280 155 230 S250 195 300 220 S390 150 445 175 S530 125 585 145 S680 72 800 88" fill="none" stroke="var(--color-cyan-secondary)" strokeWidth="3" vectorEffect="non-scaling-stroke"/><line x1="0" x2="800" y1="88" y2="88" stroke="var(--color-green-positive)" strokeDasharray="5 5" opacity=".55"/><line x1="0" x2="800" y1="230" y2="230" stroke="var(--color-red-negative)" strokeDasharray="5 5" opacity=".55"/></svg></div>; }
