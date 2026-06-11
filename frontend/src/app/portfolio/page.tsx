"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Holding, OptimizeResult, Portfolio } from "@/lib/api";
import TickerSuggestionInput from "@/components/market/TickerSuggestionInput";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

interface HoldingRow extends Holding {
  currentPrice: number | null;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [mode, setMode] = useState<"classical" | "quantum">("classical");
  const [risk, setRisk] = useState(1.0);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;

  // Load portfolios
  useEffect(() => {
    api.portfolios().then((list) => {
      setPortfolios(list);
      if (list.length > 0) setActiveId(list[0].id);
    }).catch(() => {});
  }, []);

  // Load holdings + live prices when active portfolio changes
  useEffect(() => {
    if (!activeId) return;
    setHoldings([]);
    setResult(null);
    setHoldingsLoading(true);

    api.portfolioHoldings(activeId).then((list) => {
      const rows: HoldingRow[] = list.map((h) => ({
        ...h,
        currentPrice: null,
        value: null,
        pnl: null,
        pnlPct: null,
      }));
      setHoldings(rows);
      setHoldingsLoading(false);

      // Fetch live prices for each unique symbol
      const symbols = [...new Set(list.map((h) => h.symbol))];
      symbols.forEach((sym) => {
        api.marketQuote(sym).then((quote) => {
          setHoldings((prev) =>
            prev.map((h) => {
              if (h.symbol !== sym) return h;
              const costBasis = h.quantity * h.average_cost;
              const value = h.quantity * quote.price;
              const pnl = value - costBasis;
              const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
              return { ...h, currentPrice: quote.price, value, pnl, pnlPct };
            })
          );
        }).catch(() => {});
      });
    }).catch(() => setHoldingsLoading(false));
  }, [activeId]);

  const createPortfolio = async () => {
    const name = newPortfolioName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const p = await api.createPortfolio(name, "USD");
      const updated = [...portfolios, p];
      setPortfolios(updated);
      setActiveId(p.id);
      setNewPortfolioName("");
      setShowNewForm(false);
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addHolding = async () => {
    if (!activeId) return;
    const qty = parseFloat(addQty);
    const cost = parseFloat(addCost);
    if (!addSymbol.trim() || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      setError("Enter a valid symbol, positive quantity, and positive average cost.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const holding = await api.addHolding(activeId, addSymbol.toUpperCase(), qty, cost);
      const row: HoldingRow = { ...holding, currentPrice: null, value: null, pnl: null, pnlPct: null };
      setHoldings((prev) => [...prev, row]);
      setAddSymbol("");
      setAddQty("");
      setAddCost("");

      api.marketQuote(holding.symbol).then((quote) => {
        setHoldings((prev) =>
          prev.map((h) => {
            if (h.id !== holding.id) return h;
            const costBasis = h.quantity * h.average_cost;
            const value = h.quantity * quote.price;
            const pnl = value - costBasis;
            const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            return { ...h, currentPrice: quote.price, value, pnl, pnlPct };
          })
        );
      }).catch(() => {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeHolding = async (holdingId: string) => {
    if (!activeId) return;
    try {
      await api.removeHolding(activeId, holdingId);
      setHoldings((prev) => prev.filter((h) => h.id !== holdingId));
      setResult(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const optimize = async () => {
    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    if (symbols.length < 2) {
      setError("Add at least 2 holdings to run optimization.");
      return;
    }
    setOptimizing(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.optimize(symbols, mode, risk));
    } catch (e: any) {
      if (isUpgradeRequiredError(e)) setUpgradeMessage(e.detail.message);
      else setError(e.message);
    } finally {
      setOptimizing(false);
    }
  };

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.average_cost, 0);
  const totalPnl = totalValue > 0 ? totalValue - totalCost : null;
  const totalPnlPct = totalCost > 0 && totalPnl != null ? (totalPnl / totalCost) * 100 : null;

  const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol))];
  const pieData = result?.weights
    ? Object.entries(result.weights)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({ name, value: Math.round(value * 1000) / 10, color: COLORS[i % COLORS.length] }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Portfolio</h1>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}

        {/* Portfolio selector */}
        <div className="flex flex-wrap items-center gap-2">
          {portfolios.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                activeId === p.id
                  ? "bg-indigo-primary text-white shadow-[0_0_16px_rgba(99,102,241,0.3)]"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/[0.09] hover:text-white"
              )}
            >
              {p.name}
            </button>
          ))}

          {showNewForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createPortfolio();
                  if (e.key === "Escape") setShowNewForm(false);
                }}
                placeholder="Portfolio name"
                autoFocus
                className="h-9 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
              />
              <Button
                onClick={createPortfolio}
                disabled={saving || !newPortfolioName.trim()}
                size="sm"
                className="on-accent accent-gradient-surface h-9 rounded-xl px-3 text-xs font-semibold"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
              <button onClick={() => setShowNewForm(false)} className="text-sm text-white/30 hover:text-white">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="rounded-xl border border-dashed border-white/[0.10] px-3 py-2 text-sm text-white/35 transition-colors hover:border-white/20 hover:text-white/60"
            >
              + New portfolio
            </button>
          )}
        </div>

        {/* Holdings table */}
        {activePortfolio ? (
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="font-semibold text-white">{activePortfolio.name}</p>
                <p className="mt-0.5 text-xs text-white/35">
                  {activePortfolio.base_currency} · {holdings.length} holding{holdings.length !== 1 ? "s" : ""}
                </p>
              </div>
              {totalValue > 0 && totalPnl != null && (
                <div className="text-right">
                  <p className="text-base font-bold text-white">
                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={cn("text-xs font-medium", totalPnl >= 0 ? "text-green-positive" : "text-red-negative")}>
                    {totalPnl >= 0 ? "+" : ""}
                    ${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {" "}({totalPnlPct! >= 0 ? "+" : ""}{totalPnlPct!.toFixed(2)}%)
                  </p>
                </div>
              )}
            </div>

            {/* Table */}
            {holdingsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/30">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading holdings…
              </div>
            ) : holdings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.04] text-xs text-white/30">
                      <th className="px-5 py-3 text-left font-medium">Symbol</th>
                      <th className="px-4 py-3 text-right font-medium">Qty</th>
                      <th className="px-4 py-3 text-right font-medium">Avg Cost</th>
                      <th className="px-4 py-3 text-right font-medium">Price</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                      <th className="px-4 py-3 text-right font-medium">P&amp;L</th>
                      <th className="w-10 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {holdings.map((h) => (
                      <tr key={h.id} className="group transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-semibold text-white">{h.symbol}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/65">{h.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/65">${h.average_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/65">
                          {h.currentPrice != null ? (
                            `$${h.currentPrice.toFixed(2)}`
                          ) : (
                            <span className="animate-pulse text-white/20">·····</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/65">
                          {h.value != null
                            ? `$${h.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular-nums font-medium",
                            h.pnl == null ? "text-white/20" : h.pnl >= 0 ? "text-green-positive" : "text-red-negative"
                          )}
                        >
                          {h.pnl != null ? (
                            <>
                              {h.pnl >= 0 ? "+" : ""}${Math.abs(h.pnl).toFixed(2)}
                              <span className="ml-1 text-xs opacity-70">
                                ({h.pnlPct! >= 0 ? "+" : ""}{h.pnlPct!.toFixed(1)}%)
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => removeHolding(h.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 opacity-0 transition-all hover:bg-white/[0.06] hover:text-red-negative group-hover:opacity-100"
                            aria-label={`Remove ${h.symbol}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-white/30">
                No holdings yet. Add your first position below.
              </p>
            )}

            {/* Add holding form */}
            <div className="border-t border-white/[0.06] px-5 py-4">
              {error && <p className="mb-3 text-xs text-red-negative">{error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <TickerSuggestionInput
                  value={addSymbol}
                  onValueChange={setAddSymbol}
                  onSelect={(t) => setAddSymbol(t)}
                  existingTickers={[]}
                  placeholder="Symbol"
                  className="w-40"
                  inputClassName="h-9 border border-white/[0.08] bg-white/[0.03] rounded-xl text-sm focus-visible:ring-0 focus-visible:border-indigo-primary/50"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-9 w-24 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Avg cost ($)"
                  value={addCost}
                  onChange={(e) => setAddCost(e.target.value)}
                  className="h-9 w-36 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/25 focus:border-indigo-primary/50 focus:outline-none"
                />
                <Button
                  onClick={addHolding}
                  disabled={saving || !addSymbol || !addQty || !addCost}
                  size="sm"
                  className="on-accent accent-gradient-surface h-9 rounded-xl px-4 text-sm font-semibold"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add holding"}
                </Button>
              </div>
            </div>
          </section>
        ) : portfolios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-white/30">
            Create a portfolio above to get started.
          </div>
        ) : null}

        {/* Optimizer — shown when portfolio has ≥2 holdings */}
        {activePortfolio && uniqueSymbols.length >= 2 && (
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Optimizer</h2>
              <p className="text-xs text-white/35">{uniqueSymbols.join(" · ")}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-widest text-white/35">Strategy</label>
                <div className="flex rounded-xl border border-white/[0.06] p-1">
                  {(["classical", "quantum"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setResult(null); }}
                      className={cn(
                        "flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
                        mode === m
                          ? m === "quantum"
                            ? "bg-indigo-primary text-white shadow-[0_0_14px_rgba(99,102,241,0.25)]"
                            : "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      {m === "quantum" ? "⚛ Quantum" : "Classical"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-widest text-white/35">
                  Risk Tolerance — {risk.toFixed(1)}
                </label>
                <div className="flex items-center gap-3 py-1">
                  <span className="text-xs text-white/25">Low</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={risk}
                    onChange={(e) => { setRisk(parseFloat(e.target.value)); setResult(null); }}
                    className="flex-1 accent-indigo-primary"
                  />
                  <span className="text-xs text-white/25">High</span>
                </div>
              </div>
            </div>

            <Button
              onClick={optimize}
              disabled={optimizing}
              className="on-accent accent-gradient-surface w-full rounded-xl py-4 text-base font-semibold shadow-[var(--shadow-primary-wide)] hover:shadow-[var(--shadow-primary-wide-hover)]"
            >
              {optimizing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Optimizing…
                </span>
              ) : (
                "Run Optimization"
              )}
            </Button>

            {/* Results */}
            {result && (
              <div className="space-y-5 border-t border-white/[0.06] pt-5">
                {result.weights && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Expected Return", value: `${((result.expected_annual_return ?? 0) * 100).toFixed(1)}%`, cls: "text-green-positive" },
                        { label: "Volatility", value: `${((result.annual_volatility ?? 0) * 100).toFixed(1)}%`, cls: "text-amber-warning" },
                        { label: "Sharpe", value: (result.sharpe_ratio ?? 0).toFixed(2), cls: "text-indigo-primary" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                          <p className="mb-1.5 text-xs text-white/30">{m.label}</p>
                          <p className={cn("text-2xl font-bold", m.cls)}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col items-center gap-8 md:flex-row">
                      <div className="h-52 w-52 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie data={pieData} innerRadius={68} outerRadius={90} paddingAngle={4} dataKey="value">
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        {pieData.map((d) => (
                          <div key={d.name} className="flex items-center gap-3">
                            <span className="w-14 text-xs font-bold text-white">{d.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.value}%`, backgroundColor: d.color }} />
                            </div>
                            <span className="w-12 text-right text-xs text-white/45">{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {result.selected_stocks && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-white/35">⚛ QAOA Selection</p>
                    <div className="flex flex-wrap gap-2">
                      {result.selected_stocks.map((t) => (
                        <span key={t} className="rounded-lg bg-indigo-primary/15 px-3 py-1.5 text-xs font-bold text-indigo-primary ring-1 ring-indigo-primary/20">
                          {t}
                        </span>
                      ))}
                    </div>
                    {result.best_probability != null && (
                      <p className="text-xs text-white/30">
                        Best probability: {(result.best_probability * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activePortfolio && uniqueSymbols.length === 1 && (
          <p className="text-center text-xs text-white/25">Add at least one more holding to enable optimization.</p>
        )}
      </div>
    </div>
  );
}
