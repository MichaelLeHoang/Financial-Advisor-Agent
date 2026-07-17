"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Panel, PanelHeading, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import {
  DEFAULT_INVESTMENT_POLICY,
  useInvestmentPolicy,
} from "@/components/investment-policy/InvestmentPolicyProvider";
import type { InvestmentPolicyPayload } from "@/lib/api";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";

export default function InvestmentPolicyPage() {
  const { policy, validation, loading, saving, error, savePolicy } = useInvestmentPolicy();
  const [draft, setDraft] = useState<InvestmentPolicyPayload>(DEFAULT_INVESTMENT_POLICY);

  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);

  const setNumber = (field: "max_position_weight" | "max_sector_weight" | "max_drawdown" | "minimum_cash_weight", value: number) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    try {
      await savePolicy(draft);
    } catch {
      // Provider restores the previous policy and exposes the error.
    }
  };

  return (
    <WorkspacePage dense eyebrow="Investment policy" title="Define the boundaries before the decision" description="Saved constraints generate deterministic alerts and never change positions automatically." actions={<SecondaryLink href="/invest">Back to Invest</SecondaryLink>}>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel>
          <PanelHeading title="Position and portfolio limits" detail={loading ? "Loading account policy" : policy ? `Saved ${new Date(policy.updated_at).toLocaleDateString()}` : "Not saved yet"} />
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberPolicyField label="Maximum single-position weight" value={draft.max_position_weight} onChange={(value) => setNumber("max_position_weight", value)} />
            <NumberPolicyField label="Maximum sector weight" value={draft.max_sector_weight} onChange={(value) => setNumber("max_sector_weight", value)} />
            <NumberPolicyField label="Minimum cash weight" value={draft.minimum_cash_weight} onChange={(value) => setNumber("minimum_cash_weight", value)} />
            <NumberPolicyField label="Maximum drawdown tolerance" value={draft.max_drawdown} onChange={(value) => setNumber("max_drawdown", value)} />
            <div className="text-sm font-semibold">Time horizon<WorkspaceSelectMenu ariaLabel="Policy time horizon" value={draft.time_horizon} options={[{ value: "long_term", label: "Long term" }, { value: "medium_term", label: "Medium term" }, { value: "short_term", label: "Short term" }]} onValueChange={(value) => setDraft((current) => ({ ...current, time_horizon: value }))} className="mt-2 w-full rounded-lg" /></div>
            <div className="text-sm font-semibold">Rebalance cadence<WorkspaceSelectMenu ariaLabel="Policy rebalance cadence" value={String(draft.rebalancing_policy.cadence ?? "quarterly")} options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "semiannual", label: "Semiannual" }, { value: "annual", label: "Annual" }]} onValueChange={(value) => setDraft((current) => ({ ...current, rebalancing_policy: { ...current.rebalancing_policy, cadence: value } }))} className="mt-2 w-full rounded-lg" /></div>
          </div>
          <fieldset className="mt-6 border-t border-[var(--theme-border)] pt-5"><legend className="pr-3 text-sm font-semibold">Permitted assets</legend><div className="flex flex-wrap gap-4">{["equity", "etf", "cash", "bond"].map((asset) => <label key={asset} className="inline-flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={draft.permitted_assets.includes(asset)} onChange={(event) => setDraft((current) => ({ ...current, permitted_assets: event.target.checked ? [...current.permitted_assets, asset] : current.permitted_assets.filter((item) => item !== asset) }))} className="size-4 accent-emerald-400" />{asset}</label>)}</div></fieldset>
          <button type="button" onClick={() => void save()} disabled={loading || saving} className="mt-7 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-45"><Save className="size-4" />{saving ? "Saving..." : "Save and validate"}</button>
          {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        </Panel>

        <Panel>
          <PanelHeading title="Deterministic review" action={validation?.compliant ? <CheckCircle2 className="size-5 text-emerald-400" /> : <AlertTriangle className="size-5 text-amber-300" />} />
          {!validation ? <p className="text-sm leading-6 text-[var(--text-muted)]">Save the policy to check recorded holdings. Market forecasts and agent opinions are not used in this validation.</p> : <><Status tone={validation.compliant ? "positive" : "warning"}>{validation.compliant ? "Within policy" : `${validation.alerts.filter((alert) => alert.severity === "breach").length} breaches`}</Status><div className="mt-4 divide-y divide-[var(--theme-border)]">{validation.alerts.length ? validation.alerts.map((alert) => <div key={`${alert.code}-${alert.symbol ?? "portfolio"}`} className="py-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{alert.symbol ?? "Portfolio"}</p><Status tone={alert.severity === "breach" ? "warning" : "neutral"}>{alert.severity}</Status></div><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{alert.message}</p>{alert.observed != null && alert.limit != null && <p className="mt-1 text-xs text-[var(--text-subtle)]">Observed {alert.observed.toFixed(1)}% · Limit {alert.limit.toFixed(1)}%</p>}</div>) : <p className="py-4 text-sm text-[var(--text-muted)]">No recorded policy issues.</p>}</div></>}
        </Panel>
      </div>
    </WorkspacePage>
  );
}

function NumberPolicyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block text-sm font-semibold">{label}<div className="mt-2 flex items-center gap-2"><input type="number" min="0" max="100" step="0.5" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-3 outline-none focus:ring-2 focus:ring-emerald-400/35" /><span className="text-sm text-[var(--text-muted)]">%</span></div></label>;
}
