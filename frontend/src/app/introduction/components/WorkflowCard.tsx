"use client";

import type { LucideIcon } from "lucide-react";

export type WorkflowCardData = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type WorkflowCardProps = {
  card: WorkflowCardData;
};

export function WorkflowCard({ card }: WorkflowCardProps) {
  const Icon = card.icon;

  return (
    <article
      aria-label={`${card.label}: ${card.detail}`}
      className="workflow-card w-full rounded-lg border border-white/[0.09] bg-white/[0.035] px-3.5 py-3 text-left text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)]"
    >
      <div className="flex items-start gap-3">
        <span className="workflow-card-icon grid size-8 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.055] text-indigo-200">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="workflow-card-title block truncate text-sm font-semibold leading-5 text-white/86">{card.label}</span>
          <span className="workflow-card-detail mt-1 hidden text-xs leading-5 text-white/43 sm:block lg:hidden xl:block">
            {card.detail}
          </span>
        </span>
      </div>
    </article>
  );
}
