"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Crosshair, ShieldCheck } from "lucide-react";
import { Panel, PanelHeading, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { calculateTradePlan, useWorkspacePrototype, type TradePlanInput } from "@/components/workspace/WorkspacePrototypeProvider";

const QUOTES: Record<string, number> = { AMD: 170, NVDA: 132, AAPL: 226 };

export default function TradePage() {
  const { state, previewPaperOrder, fillPaperOrder } = useWorkspacePrototype();
  const [plan, setPlan] = useState<TradePlanInput>({ symbol: "AMD", entry: 170, stop: 164, target: 182, riskBudget: 600, buyingPower: 20_000, currentPortfolioHeat: 2.4 });
  const [reviewOpen, setReviewOpen] = useState(false);
  const result = useMemo(() => calculateTradePlan(plan), [plan]);

  const selectSymbol = (symbol: string) => {
    const entry = QUOTES[symbol];
    setPlan((current) => ({ ...current, symbol, entry, stop: entry - 6, target: entry + 12 }));
  };

  return (
    <WorkspacePage dense eyebrow="Trading workspace" title="Paper Trading Desk" description="Plan the trade, calculate exposure, and review policy before a simulated order reaches the journal." actions={<span className="inline-flex h-10 items-center gap-2 border border-sky-400/35 bg-sky-400/10 px-3 text-sm font-semibold text-sky-300"><span className="size-2 rounded-full bg-sky-300" /> PAPER · ILLUSTRATIVE</span>}>
      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[210px_minmax(420px,1fr)_340px]">
        <Panel className="p-0">
          <div className="border-b border-[var(--theme-border)] p-4"><p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">Watchlist</p></div>
          <div>{Object.entries(QUOTES).map(([symbol, quote]) => <button key={symbol} type="button" onClick={() => selectSymbol(symbol)} className={`flex w-full items-center justify-between border-b border-[var(--theme-border)] px-4 py-3 text-left hover:bg-[var(--surface-card-hover)] ${plan.symbol === symbol ? "bg-sky-400/10" : ""}`}><span><strong className="block text-sm">{symbol}</strong><span className="text-xs text-[var(--text-muted)]">NASDAQ</span></span><span className="text-right"><strong className="block text-sm">${quote.toFixed(2)}</strong><span className="text-xs text-emerald-400">+1.24%</span></span></button>)}</div>
          <div className="p-4"><p className="text-xs font-semibold uppercase text-[var(--text-subtle)]">Signals</p><div className="mt-3 flex gap-2 text-xs text-[var(--text-muted)]"><Activity className="size-4 text-sky-300" /> Momentum setup is active. No order submitted.</div></div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="relative min-h-[390px] overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-3"><div><strong>{plan.symbol}</strong><span className="ml-2 text-xs text-[var(--text-muted)]">${plan.entry.toFixed(2)} · +1.24%</span></div><div className="flex gap-1">{["5m", "15m", "1h", "1D"].map((timeframe) => <button key={timeframe} type="button" className={`h-7 px-2 text-xs ${timeframe === "1h" ? "bg-white text-black" : "text-[var(--text-muted)] hover:bg-[var(--surface-card-hover)]"}`}>{timeframe}</button>)}</div></div>
            <TradeChart />
            <div className="absolute bottom-4 left-4 flex gap-4 text-xs"><span className="text-emerald-400">Target ${plan.target}</span><span className="text-white">Entry ${plan.entry}</span><span className="text-rose-400">Stop ${plan.stop}</span></div>
          </Panel>
          <Panel className="p-0">
            <div className="flex overflow-x-auto border-b border-[var(--theme-border)]">{["Positions", "Orders", "Fills", "Signals", "Journal", "Portfolio Risk"].map((tab, index) => <button key={tab} type="button" className={`h-10 shrink-0 px-4 text-xs font-semibold ${index === (state.paperOrderStatus === "filled" ? 2 : 0) ? "border-b-2 border-sky-300 text-white" : "text-[var(--text-muted)]"}`}>{tab}</button>)}</div>
            <div className="p-4">{state.paperOrderStatus === "filled" ? <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-emerald-400" /> {result.quantity} {plan.symbol} shares filled at ${plan.entry.toFixed(2)}</div><Status tone="positive">Simulated fill</Status></div> : <p className="text-sm text-[var(--text-muted)]">No open paper positions from this prototype session.</p>}</div>
          </Panel>
        </div>

        <Panel className="p-0">
          <div className="border-b border-[var(--theme-border)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Trade plan</p><Status tone="neutral">Long · Day</Status></div></div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2"><NumberInput label="Entry" value={plan.entry} onChange={(entry) => setPlan({ ...plan, entry })} /><NumberInput label="Stop" value={plan.stop} onChange={(stop) => setPlan({ ...plan, stop })} /><NumberInput label="Target" value={plan.target} onChange={(target) => setPlan({ ...plan, target })} /></div>
            <NumberInput label="Risk budget ($)" value={plan.riskBudget} onChange={(riskBudget) => setPlan({ ...plan, riskBudget })} wide />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[var(--theme-border)] py-4"><Result label="Quantity" value={`${result.quantity} shares`} /><Result label="Capital" value={money(result.capitalRequired)} /><Result label="Max loss" value={money(result.maximumLoss)} /><Result label="Reward / risk" value={`${result.rewardToRisk.toFixed(2)} : 1`} /><Result label="Heat after" value={`${result.resultingPortfolioHeat.toFixed(2)}%`} /><Result label="Risk / share" value={money(result.riskPerShare)} /></div>
            <div className={`border-l-2 p-3 ${result.policyPassed ? "border-emerald-400 bg-emerald-400/7" : "border-rose-400 bg-rose-400/7"}`}><div className="flex items-center gap-2 text-sm font-semibold">{result.policyPassed ? <ShieldCheck className="size-4 text-emerald-400" /> : <AlertTriangle className="size-4 text-rose-400" />}{result.policyPassed ? "Policy passed" : "Policy blocked"}</div>{result.issues.map((issue) => <p key={issue} className="mt-2 text-xs text-rose-300">{issue}</p>)}{result.policyPassed && <p className="mt-2 text-xs text-[var(--text-muted)]">Risk, buying power, reward, and portfolio heat are within paper policy.</p>}</div>
            <button type="button" disabled={!result.policyPassed} onClick={() => setReviewOpen(true)} className="h-11 w-full bg-sky-300 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-35">Review paper order</button>
          </div>
        </Panel>
      </div>

      {reviewOpen && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="order-review-title" className="w-full max-w-lg border border-white/12 bg-[#090a0f] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase text-sky-300">Paper order preview</p><h2 id="order-review-title" className="mt-2 text-xl font-semibold">Buy {result.quantity} {plan.symbol}</h2></div><Crosshair className="size-5 text-sky-300" /></div><div className="mt-6 grid grid-cols-2 gap-4 text-sm"><Result label="Illustrative entry" value={money(plan.entry)} /><Result label="Capital required" value={money(result.capitalRequired)} /><Result label="Planned stop" value={money(plan.stop)} /><Result label="Maximum loss" value={money(result.maximumLoss)} /></div><div className="mt-5 flex gap-2 border-l-2 border-amber-300 bg-amber-300/7 p-3 text-xs text-[var(--text-muted)]"><Clock3 className="size-4 shrink-0 text-amber-300" /> This creates a simulated fill only. No live broker is connected.</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setReviewOpen(false)} className="h-10 border border-white/12 px-4 text-sm font-semibold">Cancel</button><button type="button" onClick={() => { previewPaperOrder(); fillPaperOrder(plan, result); setReviewOpen(false); }} className="h-10 bg-white px-4 text-sm font-semibold text-black">Confirm simulated fill</button></div></div></div>}
    </WorkspacePage>
  );
}

function NumberInput({ label, value, onChange, wide = false }: { label: string; value: number; onChange: (value: number) => void; wide?: boolean }) { return <label className={wide ? "block" : "min-w-0"}><span className="mb-1 block text-[11px] text-[var(--text-muted)]">{label}</span><input type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-full min-w-0 border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-2 text-sm outline-none focus:ring-2 focus:ring-sky-300/35" /></label>; }
function Result({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0); }
function TradeChart() { return <div className="absolute inset-x-0 bottom-0 top-[53px] bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:48px_48px]"><svg viewBox="0 0 800 340" preserveAspectRatio="none" className="h-full w-full" aria-label="Illustrative AMD price chart" role="img"><defs><linearGradient id="trade-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7dd3fc" stopOpacity=".28"/><stop offset="1" stopColor="#7dd3fc" stopOpacity="0"/></linearGradient></defs><path d="M0 270 C70 250 100 280 155 230 S250 195 300 220 S390 150 445 175 S530 125 585 145 S680 72 800 88 L800 340 L0 340Z" fill="url(#trade-fill)"/><path d="M0 270 C70 250 100 280 155 230 S250 195 300 220 S390 150 445 175 S530 125 585 145 S680 72 800 88" fill="none" stroke="#7dd3fc" strokeWidth="3" vectorEffect="non-scaling-stroke"/><line x1="0" x2="800" y1="88" y2="88" stroke="#34d399" strokeDasharray="5 5" opacity=".55"/><line x1="0" x2="800" y1="230" y2="230" stroke="#fb7185" strokeDasharray="5 5" opacity=".55"/></svg></div>; }
