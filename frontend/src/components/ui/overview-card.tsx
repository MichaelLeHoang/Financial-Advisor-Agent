"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Info, TrendingUp } from "lucide-react";
import type { Overview, OverviewMetric, OverviewPoint } from "@/lib/api";
import { cn } from "@/lib/utils";

function verdictLabel(value: Overview["verdict"]) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toneClass(tone: OverviewMetric["tone"]) {
  if (tone === "positive") return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100";
  if (tone === "negative") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (tone === "info") return "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100";
  return "border-white/[0.08] bg-white/[0.03] text-white/74";
}

function PointIcon({ tone }: { tone: OverviewPoint["tone"] }) {
  if (tone === "positive") return <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" />;
  if (tone === "negative") return <AlertTriangle className="mt-0.5 size-4 text-amber-warning" />;
  return <Info className="mt-0.5 size-4 text-cyan-200" />;
}

function OverviewPoints({ title, items }: { title: string; items: OverviewPoint[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-white/86">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={`${item.title}-${item.detail}`} className="flex gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3">
            <PointIcon tone={item.tone} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white/82">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-white/58">{item.detail}</p>
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
  const className = "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white/52";
  const content = (
    <>
      <span className="truncate">{label}</span>
      {source.url && <ExternalLink className="size-3 shrink-0" />}
    </>
  );
  if (!source.url) return <span className={className}>{content}</span>;
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className={cn(className, "transition-colors hover:text-white")}>
      {content}
    </a>
  );
}

export function OverviewCard({ overview, className }: { overview: Overview; className?: string }) {
  return (
    <article className={cn("rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Overview</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{overview.title}</h2>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold", toneClass(overview.verdict.includes("sell") || overview.verdict === "bearish" ? "negative" : overview.verdict.includes("buy") || overview.verdict === "bullish" ? "positive" : "neutral"))}>
          <TrendingUp className="size-4" />
          {verdictLabel(overview.verdict)}
        </span>
      </div>

      <p className="mt-4 text-base leading-7 text-white/72">{overview.summary}</p>

      {overview.metrics.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {overview.metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className={cn("rounded-xl border p-3", toneClass(metric.tone))}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/38">{metric.label}</p>
              <p className="mt-1 text-base font-semibold text-current">{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <OverviewPoints title="Driving Catalysts" items={overview.catalysts} />
        <OverviewPoints title="Risk Factors" items={overview.risks} />
      </div>

      {(overview.sources.length > 0 || overview.next_questions.length > 0) && (
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          {overview.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {overview.sources.slice(0, 8).map((source) => (
                <SourceChip key={`${source.label}-${source.source}-${source.url ?? ""}`} source={source} />
              ))}
            </div>
          )}
          {overview.next_questions.length > 0 && (
            <div className="mt-4 space-y-2">
              {overview.next_questions.slice(0, 4).map((question) => (
                <div key={question} className="flex gap-2 text-sm leading-6 text-white/56">
                  <ArrowRight className="mt-1 size-4 shrink-0 text-indigo-primary" />
                  <span>{question}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-white/36">{overview.disclaimer}</p>
    </article>
  );
}
