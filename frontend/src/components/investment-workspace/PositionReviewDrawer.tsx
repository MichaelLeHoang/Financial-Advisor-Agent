"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarClock, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InvestmentHoldingRecord } from "@/components/investment-workspace/InvestmentWorkspaceProvider";
import type { InvestmentPolicyAlert, InvestmentThesis, InvestmentThesisPayload } from "@/lib/api";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";
import { DatePicker } from "@/components/ui/date-picker";

interface PositionReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: InvestmentHoldingRecord | null;
  thesis: InvestmentThesis | null;
  policyAlert: InvestmentPolicyAlert | null;
  value: number;
  weight: number;
  currency: string;
  saving: boolean;
  onClassify: () => Promise<void>;
  onSaveThesis: (payload: InvestmentThesisPayload) => Promise<void>;
  onRecordDecision: (action: "hold" | "trim", rationale: string, exception?: string) => Promise<void>;
}

export default function PositionReviewDrawer({
  open, onOpenChange, record, thesis, policyAlert, value, weight, currency, saving,
  onClassify, onSaveThesis, onRecordDecision,
}: PositionReviewDrawerProps) {
  const [statement, setStatement] = useState("");
  const [supporting, setSupporting] = useState("");
  const [risks, setRisks] = useState("");
  const [conditions, setConditions] = useState("");
  const [nextReview, setNextReview] = useState("");
  const [status, setStatus] = useState<InvestmentThesisPayload["status"]>("active");
  const [rationale, setRationale] = useState("");
  const [exception, setException] = useState("");

  useEffect(() => {
    setStatement(thesis?.statement ?? "");
    setSupporting(thesis?.supporting_evidence.join("\n") ?? "");
    setRisks(thesis?.risk_evidence.join("\n") ?? "");
    setConditions(thesis?.invalidation_conditions.join("\n") ?? "");
    setNextReview(thesis?.next_review_at?.slice(0, 10) ?? "");
    setStatus(thesis?.status ?? "active");
    setRationale("");
    setException("");
  }, [record?.holding.id, thesis]);

  if (!record) return null;
  const { holding, portfolio } = record;
  const eligible = holding.book_type === "investment";
  const lineItems = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

  const save = async () => {
    await onSaveThesis({
      statement,
      supporting_evidence: lineItems(supporting),
      risk_evidence: lineItems(risks),
      invalidation_conditions: lineItems(conditions),
      status,
      next_review_at: nextReview ? new Date(`${nextReview}T12:00:00Z`).toISOString() : null,
    });
  };

  const decide = async (action: "hold" | "trim") => {
    await onRecordDecision(action, rationale, exception || undefined);
    setRationale("");
    setException("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!inset-y-0 !left-auto !right-0 !top-0 !h-dvh !max-h-dvh !w-full !max-w-[480px] !translate-x-0 !translate-y-0 !rounded-none border-y-0 border-r-0 sm:!w-[min(480px,100vw)]" aria-label={`${holding.symbol} position review`}>
        <DialogHeader className="border-b border-[var(--theme-border)] pb-5 pr-12">
          <DialogTitle>{holding.symbol} Position Review</DialogTitle>
          <DialogDescription>{portfolio.name} · Owner-authored review, not an order ticket</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-[var(--theme-border)] pb-5 text-sm">
            <div><dt className="text-[var(--text-muted)]">Position value</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(value, currency)}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Portfolio weight</dt><dd className="mt-1 font-semibold tabular-nums">{weight.toFixed(1)}%</dd></div>
            <div><dt className="text-[var(--text-muted)]">Purpose</dt><dd className="mt-1 font-semibold capitalize">{holding.book_type}</dd></div>
            <div><dt className="text-[var(--text-muted)]">Policy</dt><dd className={policyAlert ? "mt-1 font-semibold text-amber-300" : "mt-1 font-semibold text-emerald-400"}>{policyAlert ? "Above limit" : "Within recorded limits"}</dd></div>
          </dl>

          {!eligible ? (
            <section className="py-6">
              <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 text-amber-300" /><div><h3 className="font-semibold">Classify before reviewing</h3><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Theses and investment decisions can only be attached to positions explicitly owned by the Investment book.</p></div></div>
              <button type="button" disabled={saving} onClick={() => void onClassify()} className="mt-5 h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-45">{saving ? "Saving…" : "Classify as Investment"}</button>
            </section>
          ) : (
            <>
              <section className="py-6">
                <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">Ownership thesis</h3><WorkspaceSelectMenu ariaLabel="Thesis status" value={status} options={[{ value: "active", label: "Active" }, { value: "needs_review", label: "Needs review" }, { value: "invalidated", label: "Invalidated" }]} onValueChange={(value) => setStatus(value as InvestmentThesisPayload["status"])} className="h-9 text-xs" align="end" /></div>
                <label className="block text-xs font-semibold text-[var(--text-muted)]">Thesis statement<textarea value={statement} onChange={(event) => setStatement(event.target.value)} rows={4} className="mt-2 w-full resize-y border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm font-normal text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-emerald-400/35" /></label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <EvidenceField label="Supporting evidence" value={supporting} onChange={setSupporting} />
                  <EvidenceField label="Risk evidence" value={risks} onChange={setRisks} />
                </div>
                <div className="mt-4"><EvidenceField label="Invalidation conditions" value={conditions} onChange={setConditions} /></div>
                <div className="mt-4 text-xs font-semibold text-[var(--text-muted)]"><span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" /> Next review</span><DatePicker aria-label="Next review date" value={nextReview} onValueChange={setNextReview} allowClear className="mt-2 h-10 font-normal" /></div>
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={saving || !statement.trim()} onClick={() => void save()} className="h-10 rounded-full bg-emerald-400 px-4 text-sm font-semibold text-black disabled:opacity-45">{saving ? "Saving…" : "Save thesis"}</button><Link href={`/invest/research?symbol=${encodeURIComponent(holding.symbol)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border-strong)] px-4 text-sm font-semibold"><BookOpen className="size-4" /> Open research</Link></div>
              </section>

              <section className="border-t border-[var(--theme-border)] py-6">
                <h3 className="font-semibold">Record decision</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">This writes an immutable review record. It does not execute a trade.</p>
                <textarea aria-label="Decision rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} placeholder="Why is this decision consistent with the thesis and policy?" className="mt-4 w-full resize-y border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400/35" />
                <textarea aria-label="Policy exception" value={exception} onChange={(event) => setException(event.target.value)} rows={2} placeholder="Policy exception, if required" className="mt-3 w-full resize-y border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400/35" />
                <div className="mt-4 flex gap-2"><button type="button" disabled={saving || !rationale.trim()} onClick={() => void decide("hold")} className="h-10 rounded-full border border-[var(--theme-border-strong)] px-4 text-sm font-semibold disabled:opacity-45">Hold</button><button type="button" disabled={saving || !rationale.trim()} onClick={() => void decide("trim")} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-45">Trim</button></div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-[var(--text-muted)]">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder="One item per line" className="mt-2 w-full resize-y border border-[var(--theme-border-strong)] bg-[var(--surface-control)] p-3 text-sm font-normal text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-emerald-400/35" /></label>;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
