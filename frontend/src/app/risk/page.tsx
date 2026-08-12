"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, PieChart, ShieldCheck } from "lucide-react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import type { Portfolio, RiskSnapshotResult } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePortfolioBookView } from "@/components/portfolio/PortfolioBookViewProvider";
import PortfolioBookSwitch from "@/components/portfolio/PortfolioBookSwitch";
import { LockedFeature } from "@/components/LockedFeature";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { cn } from "@/lib/utils";

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution_addon: 4 };

export default function RiskPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { book } = usePortfolioBookView();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [result, setResult] = useState<RiskSnapshotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const canUseRisk = PLAN_RANK[user.plan] >= PLAN_RANK.pro;

  useEffect(() => {
    if (!canUseRisk) return;
    api.portfolios()
      .then((items) => {
        setPortfolios(items);
        setSelectedPortfolioId((current) => current || items[0]?.id || "");
      })
      .catch(() => setPortfolios([]));
  }, [canUseRisk]);

  const allocations = useMemo(
    () => Object.entries(result?.snapshot.allocations.by_asset ?? {}).sort((a, b) => b[1].weight - a[1].weight),
    [result]
  );
  const assetClasses = useMemo(
    () => Object.entries(result?.snapshot.allocations.by_asset_class ?? {}).sort((a, b) => b[1] - a[1]),
    [result]
  );
  const correlations = result?.snapshot.correlation_matrix ?? {};
  const symbols = Object.keys(correlations);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [book]);

  if (!canUseRisk) {
    return (
      <LockedFeature
        title="Risk Dashboard is available on Pro"
        description="Review concentration, volatility, drawdown, allocation, and correlation risk for your portfolios."
        requiredPlan="pro"
        benefits={["Portfolio risk score", "Allocation and concentration analysis", "Correlation matrix"]}
      />
    );
  }

  const generateSnapshot = async () => {
    if (!selectedPortfolioId) {
      setError("Create a portfolio before generating a risk snapshot.");
      return;
    }
    setLoading(true);
    setError(null);
    setUpgradeMessage(null);
    try {
      setResult(await api.portfolioRisk(selectedPortfolioId, book));
    } catch (err) {
      if (isUpgradeRequiredError(err)) setUpgradeMessage(err.detail.message);
      else setError(err instanceof Error ? err.message : "Unable to generate risk snapshot.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-primary)]">Portfolio Risk</h1>
            {pathname.startsWith("/portfolio/") && <PortfolioBookSwitch className="mt-4" />}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Concentration, volatility, drawdown, and correlation research for the {book === "investment" ? "Investment" : "Trade"} book.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedPortfolioId}
              onChange={(event) => setSelectedPortfolioId(event.target.value)}
              className="h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-primary/40"
            >
              {portfolios.length === 0 ? <option value="">No portfolios</option> : portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
              ))}
            </select>
            <Button onClick={generateSnapshot} disabled={loading} className="theme-accent-surface on-accent h-11 rounded-xl px-5">
              {loading ? "Analyzing..." : "Generate snapshot"}
            </Button>
          </div>
        </div>

        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {error && <div className="rounded-xl border border-red-negative/25 bg-red-negative/10 px-4 py-3 text-sm text-red-negative">{error}</div>}

        {result ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric icon={ShieldCheck} label="Risk score" value={`${result.snapshot.metrics.risk_score ?? 0}/100`} />
              <Metric icon={PieChart} label="Total value" value={formatCurrency(result.snapshot.metrics.total_value ?? 0)} />
              <Metric icon={Activity} label="Volatility" value={formatPercent(result.snapshot.metrics.annualized_volatility ?? 0)} />
              <Metric icon={AlertTriangle} label="Max drawdown" value={formatPercent(result.snapshot.metrics.max_drawdown_estimate ?? 0)} tone="negative" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="space-y-4 p-5">
                  <div className="text-sm font-semibold">Asset allocation</div>
                  {allocations.map(([symbol, item]) => (
                    <AllocationRow key={symbol} label={symbol} sublabel={item.asset_type} value={item.weight} amount={item.market_value} />
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="space-y-4 p-5">
                  <div className="text-sm font-semibold">Asset class exposure</div>
                  {assetClasses.map(([label, value]) => (
                    <AllocationRow key={label} label={label} value={value} />
                  ))}
                  {result.snapshot.ai_explanation && (
                    <p className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card-hover)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
                      {result.snapshot.ai_explanation}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {symbols.length > 0 && (
              <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <div className="mb-4 text-sm font-semibold">Correlation matrix</div>
                  <HorizontalScroll>
                    <div className="grid w-max gap-1" style={{ gridTemplateColumns: `96px repeat(${symbols.length}, 72px)` }}>
                      <div />
                      {symbols.map((symbol) => <Cell key={symbol} label={symbol} header />)}
                      {symbols.map((row) => (
                        <div key={`${row}-row`} className="contents">
                          <Cell key={`${row}-label`} label={row} header />
                          {symbols.map((col) => <Cell key={`${row}-${col}`} label={formatCorrelation(correlations[row]?.[col])} tone={correlations[row]?.[col] ?? 0} />)}
                        </div>
                      ))}
                    </div>
                  </HorizontalScroll>
                </CardContent>
              </Card>
            )}

            <p className="text-xs leading-5 text-[var(--text-muted)]">{result.disclaimer}</p>
          </>
        ) : (
          <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
            <CardContent className="p-6 text-sm leading-6 text-[var(--text-muted)]">
              Select a portfolio with holdings and generate a snapshot to review allocation, concentration, volatility, and correlation risk.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone?: "negative" }) {
  return (
    <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-card)] py-0 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          {label}
          <Icon className={cn("h-4 w-4 text-indigo-primary", tone === "negative" && "text-red-negative")} />
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function AllocationRow({ label, sublabel, value, amount }: { label: string; sublabel?: string; value: number; amount?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{sublabel}</span></span>
        <span className="text-[var(--text-secondary)]">{formatPercent(value)}{amount !== undefined ? ` · ${formatCurrency(amount)}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-control)]">
        <div className="h-full rounded-full bg-indigo-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
    </div>
  );
}

function Cell({ label, header = false, tone }: { label: string; header?: boolean; tone?: number }) {
  const intensity = tone === undefined ? 0 : Math.min(0.28, Math.abs(tone) * 0.22);
  return (
    <div
      className={cn("flex h-10 items-center justify-center rounded-lg border border-[var(--theme-border)] px-2 text-xs", header ? "bg-[var(--surface-card-hover)] font-semibold" : "text-[var(--text-secondary)]")}
      style={!header ? { backgroundColor: tone && tone < 0 ? `rgba(239,68,68,${intensity})` : `rgba(99,102,241,${intensity})` } : undefined}
    >
      {label}
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCorrelation(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "n/a";
}
