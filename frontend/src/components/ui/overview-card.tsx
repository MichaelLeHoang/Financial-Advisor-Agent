"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Info,
  Minus,
} from "lucide-react";
import type {
  Overview,
  OverviewAssetAssessment,
  OverviewMetric,
  OverviewPoint,
} from "@/lib/api";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

function verdictLabel(value: Overview["verdict"]) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function verdictTone(verdict: Overview["verdict"]): OverviewMetric["tone"] {
  if (["buy", "bullish"].includes(verdict)) return "positive";
  if (["sell", "bearish"].includes(verdict)) return "negative";
  if (verdict === "insufficient_data") return "info";
  return "neutral";
}

function toneClass(tone: OverviewMetric["tone"]) {
  if (tone === "positive") return "border-green-positive/25 bg-green-positive/10 text-green-positive";
  if (tone === "negative") return "border-red-negative/25 bg-red-negative/10 text-red-negative";
  if (tone === "info") return "border-indigo-primary/25 bg-indigo-primary/10 text-indigo-primary";
  return "border-[var(--theme-border)] bg-[var(--surface-control)] text-[var(--text-secondary)]";
}

function VerdictIcon({ verdict }: { verdict: Overview["verdict"] }) {
  if (["buy", "bullish"].includes(verdict)) return <ArrowUpRight className="size-4" aria-hidden="true" />;
  if (["sell", "bearish"].includes(verdict)) return <ArrowDownRight className="size-4" aria-hidden="true" />;
  if (verdict === "insufficient_data") return <AlertCircle className="size-4" aria-hidden="true" />;
  return <Minus className="size-4" aria-hidden="true" />;
}

function PointIcon({ tone }: { tone: OverviewPoint["tone"] }) {
  if (tone === "positive") return <CheckCircle2 className="mt-0.5 size-4 text-green-positive" aria-hidden="true" />;
  if (tone === "negative") return <AlertTriangle className="mt-0.5 size-4 text-amber-warning" aria-hidden="true" />;
  return <Info className="mt-0.5 size-4 text-indigo-primary" aria-hidden="true" />;
}

function OverviewPoints({ title, items }: { title: string; items: OverviewPoint[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="mt-3 divide-y divide-[var(--theme-border)]">
        {items.map((item) => (
          <div key={`${item.title}-${item.detail}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <PointIcon tone={item.tone} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.detail}</p>
              {item.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.sources.slice(0, 3).map((source) => (
                    <SourceChip key={`${source.label}-${source.source}-${source.url ?? ""}`} source={source} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceChip({ source }: { source: Overview["sources"][number] }) {
  const label = source.label || source.source;
  const className = cn(
    APP_RADIUS.pill,
    "inline-flex min-w-0 max-w-full items-center gap-1.5 border border-[var(--theme-border)] bg-[var(--surface-control)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]",
  );
  const content = (
    <>
      <span className="truncate">{label}</span>
      {source.url && <ExternalLink className="size-3 shrink-0" aria-hidden="true" />}
    </>
  );
  if (!source.url) return <span className={className}>{content}</span>;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className={cn(className, "transition-colors hover:border-[var(--theme-border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none")}
    >
      {content}
    </a>
  );
}

function EvidenceBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const tone = status === "complete" ? "positive" : status === "insufficient" ? "negative" : "info";
  return (
    <span className={cn(APP_RADIUS.pill, "inline-flex border px-2 py-0.5 text-[11px] font-semibold", toneClass(tone))}>
      {label} evidence
    </span>
  );
}

function AssetAssessment({ asset }: { asset: OverviewAssetAssessment }) {
  const riskItems = asset.risks ?? [];
  const limitations = asset.limitations ?? [];
  return (
    <section
      aria-label={`${asset.symbol} assessment`}
      className={cn(APP_RADIUS.surface, "border border-[var(--theme-border)] bg-[var(--surface-panel)] p-4 sm:p-5")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{asset.symbol}</h3>
            <EvidenceBadge status={asset.evidence_status} />
          </div>
          {asset.company_name && asset.company_name !== asset.symbol && (
            <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{asset.company_name}</p>
          )}
        </div>
        <span className={cn(APP_RADIUS.control, "inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold", toneClass(verdictTone(asset.verdict)))}>
          <VerdictIcon verdict={asset.verdict} />
          {verdictLabel(asset.verdict)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[var(--theme-border)] py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--text-muted)]">Confidence</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{Math.round(asset.confidence * 100)}%</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Exact agreement</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{Math.round(asset.agreement * 100)}%</dd>
        </div>
        <div>
          <dt className="text-[var(--text-muted)]">Evidence coverage</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{Math.round(asset.evidence_coverage * 100)}%</dd>
        </div>
      </dl>

      {asset.metrics.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {asset.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className="min-w-0">
              <dt className="text-xs leading-5 text-[var(--text-muted)]">{metric.label}</dt>
              <dd className={cn("mt-0.5 truncate text-sm font-semibold", metric.tone === "positive" ? "text-green-positive" : metric.tone === "negative" ? "text-red-negative" : "text-[var(--text-primary)]")}>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {riskItems.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Measured risks</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
            {riskItems.map((risk) => (
              <li key={`${risk.title}-${risk.detail}`} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-warning" aria-hidden="true" />
                <span>{risk.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className={cn(APP_RADIUS.nested, "mt-4 border border-amber-warning/25 bg-amber-warning/10 p-3")}>
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-warning">
            <Info className="size-4" aria-hidden="true" /> Evidence limitations
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--text-secondary)]">
            {limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
          </ul>
        </div>
      )}

      {(asset.sources.length > 0 || asset.as_of) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {asset.sources.slice(0, 4).map((source) => (
            <SourceChip key={`${asset.symbol}-${source.label}-${source.source}-${source.url ?? ""}`} source={source} />
          ))}
          {asset.as_of && <span className="text-[11px] text-[var(--text-subtle)]">As of {new Date(asset.as_of).toLocaleString()}</span>}
        </div>
      )}
    </section>
  );
}

export function OverviewCard({
  overview,
  className,
  onQuestionSelect,
}: {
  overview: Overview;
  className?: string;
  onQuestionSelect?: (question: string) => void;
}) {
  const assets = overview.asset_assessments ?? [];
  const limitations = overview.limitations ?? [];
  return (
    <article className={cn(APP_RADIUS.surface, "border border-[var(--theme-border)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-muted)]">Consensus overview</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{overview.title}</h2>
        </div>
        <span className={cn(APP_RADIUS.control, "inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm font-bold", toneClass(verdictTone(overview.verdict)))}>
          <VerdictIcon verdict={overview.verdict} />
          {verdictLabel(overview.verdict)}
        </span>
      </div>

      <p className="mt-4 max-w-[75ch] text-base leading-7 text-[var(--text-secondary)]">{overview.summary}</p>

      {assets.length > 0 ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {assets.map((asset) => <AssetAssessment key={asset.symbol} asset={asset} />)}
        </div>
      ) : overview.metrics.length > 0 ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {overview.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className={cn(APP_RADIUS.nested, "border p-3", toneClass(metric.tone))}>
              <p className="text-xs font-medium opacity-75">{metric.label}</p>
              <p className="mt-1 text-base font-semibold text-current">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {assets.length === 0 && (
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <OverviewPoints title="Driving catalysts" items={overview.catalysts} />
          <OverviewPoints title="Risk factors" items={overview.risks} />
        </div>
      )}

      {assets.length === 0 && limitations.length > 0 && (
        <div className={cn(APP_RADIUS.nested, "mt-5 border border-amber-warning/25 bg-amber-warning/10 p-3 text-sm text-[var(--text-secondary)]")}>
          <p className="font-semibold text-amber-warning">Evidence limitations</p>
          <ul className="mt-2 space-y-1">{limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
        </div>
      )}

      {(overview.sources.length > 0 || overview.next_questions.length > 0) && (
        <div className="mt-5 border-t border-[var(--theme-border)] pt-4">
          {overview.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Evidence sources">
              {overview.sources.slice(0, 8).map((source) => (
                <SourceChip key={`${source.label}-${source.source}-${source.url ?? ""}`} source={source} />
              ))}
            </div>
          )}
          {overview.next_questions.length > 0 && (
            <div className="mt-4 space-y-2">
              {overview.next_questions.slice(0, 4).map((question) => (
                onQuestionSelect ? (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onQuestionSelect(question)}
                    className={cn(APP_RADIUS.control, "group/question -mx-2 flex w-[calc(100%+1rem)] items-start gap-2 px-2 py-1.5 text-left text-sm leading-6 text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-control-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none")}
                  >
                    <ArrowRight className="mt-1 size-4 shrink-0 text-indigo-primary transition-transform duration-150 group-hover/question:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    <span>{question}</span>
                  </button>
                ) : (
                  <div key={question} className="flex gap-2 text-sm leading-6 text-[var(--text-muted)]">
                    <ArrowRight className="mt-1 size-4 shrink-0 text-indigo-primary" aria-hidden="true" />
                    <span>{question}</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-[var(--text-subtle)]">{overview.disclaimer}</p>
    </article>
  );
}
