"use client";

import { motion } from "motion/react";
import { Lock, ArrowRight, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getPlanById, type PlanId } from "@/config/plans";

interface LockedFeatureProps {
  featureKey?: string;
  title: string;
  description?: string;
  requiredPlan: PlanId;
  benefits?: string[];
  ctaLabel?: string;
}

/**
 * Full-page locked feature component.
 * Shows when a user lands on a gated page they don't have access to.
 */
export function LockedFeature({
  title,
  description,
  requiredPlan,
  benefits = [],
  ctaLabel,
}: LockedFeatureProps) {
  const router = useRouter();
  const plan = getPlanById(requiredPlan);
  const label = ctaLabel ?? `Upgrade to ${plan.name}`;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-lg text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
          <Lock className="h-7 w-7 text-white/30" />
        </div>

        <h2 className="text-2xl font-bold text-white">{title}</h2>

        {description && (
          <p className="mx-auto mt-3 max-w-md text-base text-white/45">{description}</p>
        )}

        <p className="mt-4 text-sm text-white/35">
          Available on the <span className="font-medium text-indigo-400">{plan.name}</span> plan
          {plan.priceLabel !== "$0" && ` — starting at ${plan.priceLabel}/mo`}.
        </p>

        {benefits.length > 0 && (
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/55">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> {b}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] transition-all hover:bg-indigo-400 active:scale-[0.98]"
        >
          {label}
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  );
}

/* ── Compact inline upgrade prompt ── */

interface UpgradePromptProps {
  featureKey?: string;
  message: string;
  requiredPlan: PlanId;
  compact?: boolean;
}

/**
 * Inline upgrade prompt — use inside pages where a specific card/section is locked.
 */
export function UpgradePrompt({
  message,
  requiredPlan,
  compact = false,
}: UpgradePromptProps) {
  const router = useRouter();
  const plan = getPlanById(requiredPlan);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => router.push("/pricing")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-500/15"
      >
        <Lock className="h-3 w-3" /> Upgrade to {plan.name}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Lock className="h-4 w-4 text-white/30" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-white/55">{message}</p>
          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/20"
          >
            Upgrade to {plan.name} <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
