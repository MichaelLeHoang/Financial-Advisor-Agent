"use client";

import type { ComponentType } from "react";
import type { PlanId } from "@/config/plans";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import { planAllows } from "@/config/workspace-navigation";
import { Panel, WorkspacePage } from "@/components/workspace/WorkspaceUI";

export function WorkspaceDestination({
  eyebrow,
  title,
  description,
  icon: Icon,
  emptyTitle,
  emptyDescription,
  requiredPlan,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
  requiredPlan?: Extract<PlanId, "pro" | "trader" | "quant">;
  children?: React.ReactNode;
}) {
  const { user } = useAuth();
  if (requiredPlan && !planAllows(user.plan, requiredPlan)) {
    return <LockedFeature title={`${title} is available on ${requiredPlan}`} description={description} requiredPlan={requiredPlan} />;
  }

  return (
    <WorkspacePage eyebrow={eyebrow} title={title} description={description}>
      {children ?? (
        <Panel className="flex min-h-64 items-center justify-center border-dashed text-center">
          <div className="max-w-md">
            <Icon className="mx-auto size-6 text-[var(--text-muted)]" />
            <h2 className="mt-5 text-base font-semibold">{emptyTitle ?? `No ${title.toLowerCase()} yet`}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{emptyDescription}</p>
          </div>
        </Panel>
      )}
    </WorkspacePage>
  );
}

