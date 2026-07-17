"use client";

import { useParams } from "next/navigation";
import { FileText, Scale } from "lucide-react";
import { Metric, Panel, PanelHeading, SecondaryLink, Status, WorkspacePage } from "@/components/workspace/WorkspaceUI";
import { useInvestmentWorkspace } from "@/components/investment-workspace/InvestmentWorkspaceProvider";

export default function InvestmentPositionPage() {
  const params = useParams<{ positionId: string }>();
  const symbol = params.positionId.toUpperCase();
  const { investmentHoldings, theses, decisions, quotes, currencyRates, policyValidation, preferences } = useInvestmentWorkspace();
  const record = investmentHoldings.find(({ holding }) => holding.symbol.toUpperCase() === symbol);
  const holding = record?.holding;
  const quote = holding ? quotes.get(holding.symbol.toUpperCase()) : null;
  const quoteCurrency = (quote?.currency || holding?.cost_currency || "USD").toUpperCase();
  const exposure = holding ? holding.quantity * (quote?.price || holding.average_cost) * (currencyRates.get(quoteCurrency) ?? 1) : 0;
  const total = investmentHoldings.reduce((sum, item) => {
    const itemQuote = quotes.get(item.holding.symbol.toUpperCase());
    const currency = (itemQuote?.currency || item.holding.cost_currency || "USD").toUpperCase();
    return sum + item.holding.quantity * (itemQuote?.price || item.holding.average_cost) * (currencyRates.get(currency) ?? 1);
  }, 0);
  const weight = total ? (exposure / total) * 100 : 0;
  const thesis = theses.find((item) => item.holding_id === holding?.id);
  const positionAlert = policyValidation?.alerts.find((alert) => alert.holding_ids?.includes(holding?.id ?? "") || alert.symbol === symbol);
  const history = decisions.filter((item) => item.holding_id === holding?.id);

  return (
    <WorkspacePage dense eyebrow="Investment position" title={symbol} description="Ownership purpose, thesis evidence, policy state, and owner decisions attached to this Investment position." actions={<SecondaryLink href="/invest">Back to Invest</SecondaryLink>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Investment weight" value={holding ? `${weight.toFixed(1)}%` : "Not found"} />
        <Metric label="Policy status" value={positionAlert ? "Needs attention" : "Within recorded limits"} tone={positionAlert ? "warning" : "neutral"} />
        <Metric label="Thesis status" value={thesisHealth(thesis)} tone={thesisHealth(thesis) === "Healthy" ? "positive" : "warning"} />
        <Metric label="Estimated value" value={formatMoney(exposure, preferences.displayCurrency)} detail="Current quote and FX" />
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <Panel><PanelHeading title="Investment thesis" action={<FileText className="size-4 text-emerald-400" />} />{thesis ? <><p className="text-sm leading-6 text-[var(--text-secondary)]">{thesis.statement}</p><dl className="mt-5 space-y-3 border-t border-[var(--theme-border)] pt-4 text-sm"><Row label="Supporting evidence" value={`${thesis.supporting_evidence.length} recorded`} /><Row label="Risk evidence" value={`${thesis.risk_evidence.length} recorded`} /><Row label="Invalidation conditions" value={`${thesis.invalidation_conditions.length} recorded`} /><Row label="Next review" value={thesis.next_review_at ? new Date(thesis.next_review_at).toLocaleDateString() : "Not scheduled"} /></dl></> : <p className="text-sm leading-6 text-[var(--text-muted)]">No ownership thesis has been recorded. Open this position from the Investment overview to complete its review.</p>}</Panel>
        <Panel><PanelHeading title="Policy and risk" action={<Scale className="size-4 text-amber-300" />} /><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-[var(--text-muted)]">Purpose</span><Status tone={holding?.book_type === "investment" ? "positive" : "warning"}>{holding?.book_type ?? "not found"}</Status></div><Row label="Concentration" value={positionAlert?.message ?? "Within recorded position limit"} /><Row label="Policy evidence" value={policyValidation ? new Date(policyValidation.validated_at).toLocaleDateString() : "Not validated"} /></div></Panel>
      </div>
      <Panel className="mt-5"><PanelHeading title="Decision history" detail="Immutable owner-authored review records" /><div className="divide-y divide-[var(--theme-border)]">{history.length ? history.map((item) => <div key={item.id} className="grid gap-2 py-4 text-sm sm:grid-cols-[90px_1fr_auto]"><strong className="capitalize">{item.action}</strong><span>{item.rationale}</span><time className="text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString()}</time></div>) : <p className="py-5 text-sm text-[var(--text-muted)]">No investment decision has been recorded for this position.</p>}</div></Panel>
    </WorkspacePage>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-[var(--text-muted)]">{label}</dt><dd className="text-right">{value}</dd></div>; }
function thesisHealth(thesis?: { status: string; next_review_at?: string | null }) { if (!thesis) return "Missing"; if (thesis.status === "invalidated") return "Invalidated"; if (thesis.status === "needs_review" || (thesis.next_review_at && new Date(thesis.next_review_at) < new Date())) return "Needs review"; return "Healthy"; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
