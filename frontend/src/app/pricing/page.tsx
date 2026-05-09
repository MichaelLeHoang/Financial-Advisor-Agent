"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Lock, Crown, Zap, ArrowRight, X } from "lucide-react";
import { PLANS, type PlanId } from "@/config/plans";
import { useAuth } from "@/components/auth/AuthProvider";

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const currentPlan: PlanId = (user?.plan as PlanId) ?? "free";

  const handleUpgrade = (planId: PlanId) => {
    // TODO: Connect to Stripe Checkout session
    console.info(`[Mock] Stripe Checkout will be connected in the backend billing sprint. Target plan: ${planId}`);
    alert(`Stripe Checkout will be connected in the backend billing sprint.\n\nTarget plan: ${planId}`);
  };

  return (
    <div className="relative min-h-screen bg-[#050507]">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-indigo-600/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-cyan-500/[0.04] blur-[100px]" />
      </div>

      {/* X close button */}
      <button
        type="button"
        onClick={() => {
          const referrer = document.referrer;
          const isSameOrigin = referrer && new URL(referrer).origin === window.location.origin;
          if (isSameOrigin) {
            router.back();
          } else {
            router.push("/");
          }
        }}
        aria-label="Close pricing"
        className="fixed right-6 top-6 z-50 flex h-10 w-10 items-center justify-center"
      >
        <X className="h-5 w-5 text-white/30 transition-colors duration-200 hover:text-white/80" />
      </button>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/45">
            Unlock more AI research, portfolio tools, backtesting, and advanced analytics.
          </p>
        </motion.div>

        {/* Plan cards grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.filter((p) => p.id !== "execution").map((plan, i) => {
            const isCurrent = plan.id === currentPlan;
            const isRecommended = plan.highlighted;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                  isCurrent
                    ? "border-green-positive/30 bg-green-positive/[0.06] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)]"
                    : isRecommended
                    ? "border-indigo-500/40 bg-gradient-to-b from-indigo-500/[0.08] to-transparent shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_20px_60px_rgba(99,102,241,0.12)]"
                    : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.1] hover:bg-white/[0.04]"
                }`}
              >
                {/* Badges */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-green-positive px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(52,211,153,0.35)]">
                    <Crown className="h-3 w-3" /> Current Plan
                  </div>
                )}
                {isRecommended && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)]">
                    <Zap className="h-3 w-3" /> Recommended
                  </div>
                )}

                {/* Plan info */}
                <div className="mb-4 mt-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-white/40">{plan.subtitle}</p>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{plan.priceLabel}</span>
                  {plan.priceNote && <span className="ml-2 text-sm text-white/35">{plan.priceNote}</span>}
                </div>

                <p className="mb-6 text-sm leading-relaxed text-white/40">{plan.description}</p>

                {/* Feature list */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="h-11 flex items-center justify-center rounded-xl border border-green-positive/20 bg-green-positive/10 text-sm font-medium text-green-positive">
                    Active
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.id)}
                    className={`group/btn flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                      isRecommended
                        ? "bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] hover:bg-indigo-400"
                        : "border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {plan.ctaLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Execution add-on */}
        {(() => {
          const exec = PLANS.find((p) => p.id === "execution")!;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="group mx-auto mt-8 max-w-2xl rounded-2xl bg-white/[0.06] p-px transition-all duration-300 hover:bg-gradient-to-r hover:from-amber-300 hover:via-yellow-500 hover:to-orange-400 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.14),0_18px_50px_rgba(251,191,36,0.16)]"
            >
              <div className="rounded-[calc(1rem-1px)] bg-space-black/95 p-6 text-center transition-colors duration-300 group-hover:bg-[#11100a]/95">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  <Lock className="h-3 w-3" /> Invite Only
                </div>
                <h3 className="text-lg font-bold text-white">
                  {exec.name} <span className="text-white/40">— {exec.subtitle}</span>
                </h3>
                <p className="mt-2 text-sm text-white/40">{exec.description}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {exec.features.map((f) => (
                    <span key={f} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50">{f}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-6 inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 text-sm font-medium text-white/60 transition-all hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  {exec.ctaLabel}
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* Disclaimer */}
        <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-center text-xs leading-relaxed text-white/30">
          This platform provides research, analytics, backtesting, journaling, and risk-management tools. It does not provide personalized financial advice, does not guarantee returns, and should not be used as the sole basis for investment decisions.
        </div>
      </div>
    </div>
  );
}
