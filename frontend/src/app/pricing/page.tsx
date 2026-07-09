"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Crown,
  GraduationCap,
  Lock,
  Sparkles,
} from "lucide-react";

import {
  COMPARISON_TABLE,
  PLANS,
  type CheckState,
  type PlanConfig,
  type PlanId,
} from "@/config/plans";
import { useAuth } from "@/components/auth/AuthProvider";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { api, type AuthUser as ApiAuthUser, type BillingSubscription } from "@/lib/api";

type CheckoutPlanId = Extract<ApiAuthUser["plan"], "pro" | "trader" | "quant">;
type BillingCycle = "monthly" | "yearly";

const YEARLY_DISCOUNT = 0.2;

function checkoutPlanFor(planId: PlanId): CheckoutPlanId | null {
  return planId === "pro" || planId === "trader" || planId === "quant" ? planId : null;
}

function normalizePlanId(plan: ApiAuthUser["plan"] | PlanId): PlanId {
  return plan === "execution_addon" ? "execution" : plan;
}

function formatPlan(plan: string) {
  return plan.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PlanId | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setNotice("Checkout complete. Your plan will update after Stripe confirms the subscription.");
    } else if (checkout === "cancelled") {
      setNotice("Checkout cancelled. No changes were made to your plan.");
    }
  }, []);

  useEffect(() => {
    if (user.is_guest) return;

    api.billingSubscription()
      .then(setBilling)
      .catch((err) => setError(err.message));
  }, [user.is_guest]);

  const currentPlan = normalizePlanId((billing?.publishable_plan ?? user.plan) as ApiAuthUser["plan"]);
  const status = billing?.subscription.status ?? (currentPlan === "free" ? "inactive" : "active");
  const hasStripeCustomer = Boolean(billing?.subscription.stripe_customer_id);

  const handleUpgrade = async (planId: PlanId) => {
    setError(null);

    if (planId === "free") {
      router.push(user.is_guest ? "/login?next=/session" : "/session");
      return;
    }

    if (planId === "execution") {
      setNotice("Execution access is invite only. Use the request access path when broker execution is enabled.");
      return;
    }

    if (user.is_guest) {
      router.push(`/login?next=/pricing&plan=${planId}`);
      return;
    }

    const checkoutPlan = checkoutPlanFor(planId);
    if (!checkoutPlan) return;

    setLoadingPlan(planId);
    try {
      const session = await api.createCheckoutSession(checkoutPlan);
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open Stripe Checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const openPortal = async () => {
    setError(null);

    if (user.is_guest) {
      router.push("/login?next=/pricing");
      return;
    }

    setLoadingPlan("portal");
    try {
      const session = await api.createCustomerPortalSession(window.location.href);
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open Stripe Customer Portal.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-[#050507] text-white" data-theme="Deep Space">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.16),transparent_56%)]" />
        <div className="absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-cyan-500/[0.045] blur-[110px]" />
      </div>

      <PricingNav isGuest={Boolean(user.is_guest)} />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pb-24 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h1 className="font-heading text-4xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Choose your research plan.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/44 sm:text-lg">
            Unlock deeper AI research, portfolio analytics, backtesting, risk controls, and advanced validation for the workflow you actually use.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3">
            <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
            {billingCycle === "yearly" && (
              <p className="text-sm font-medium text-indigo-300">Save 20% with yearly billing.</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!user.is_guest && (
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/62">
                <Crown className="h-4 w-4 text-green-positive" />
                {formatPlan(currentPlan)} <span className="text-white/28">/</span> {status}
              </div>
            )}
            {!user.is_guest && (
              <button
                type="button"
                onClick={openPortal}
                disabled={loadingPlan !== null || !hasStripeCustomer}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CreditCard className="h-4 w-4" />
                {loadingPlan === "portal" ? "Opening..." : "Manage subscription"}
              </button>
            )}
          </div>
        </motion.section>

        {(notice || error) && (
          <div
            className={`mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-negative/25 bg-red-negative/10 text-red-negative"
                : "border-indigo-primary/25 bg-indigo-primary/10 text-white/70"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error ?? notice}</span>
          </div>
        )}

        <section className="mt-12">
          <div className="relative overflow-hidden rounded-[1.45rem] px-4 py-8 shadow-[0_38px_120px_rgba(0,0,0,0.36)] sm:px-8 sm:py-10 lg:px-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pay-background.webp"
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-65"
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,7,0.62),rgba(5,5,7,0.82)),radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.22),transparent_48%)]"
              aria-hidden="true"
            />

            <div className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {PLANS.filter((plan) => plan.id !== "execution").map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  isCurrent={plan.id === currentPlan}
                  isLoading={loadingPlan === plan.id}
                  isGuest={Boolean(user.is_guest)}
                  loadingPlan={loadingPlan}
                  billingCycle={billingCycle}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>

            <BusinessAccess onRequestExecution={() => handleUpgrade("execution")} />
          </div>
        </section>

        <ComparisonTable />

        <div className="mx-auto mt-14 max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 text-center text-xs leading-relaxed text-white/30">
          This platform provides research, analytics, backtesting, journaling, and risk-management tools. It does not provide personalized financial advice, does not guarantee returns, and should not be used as the sole basis for investment decisions.
        </div>
      </main>
    </div>
  );
}

function PricingNav({ isGuest }: { isGuest: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
      <nav className="mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center justify-center gap-6 rounded-full bg-[#1f2024]/86 px-4 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" aria-hidden="true" className="size-6 object-contain" />
          <span className="hidden text-sm font-semibold text-white/92 sm:block">Quanfora</span>
        </Link>
        <div className="flex items-center gap-1 text-sm font-semibold text-white/58">
          <Link href="/pricing" className="rounded-full px-2.5 py-1.5 text-white/92 transition-colors hover:bg-white/[0.08] hover:text-white">
            Pricing
          </Link>
          <Link href="/help" className="hidden rounded-full px-2.5 py-1.5 transition-colors hover:bg-white/[0.08] hover:text-white sm:inline-flex">
            Help
          </Link>
          {isGuest ? (
            <Link href="/login?next=/session" className="rounded-full bg-white px-4 py-2 font-semibold text-black transition-all hover:bg-white/86">
              Join free
            </Link>
          ) : (
            <Link href="/session" className="rounded-full bg-white px-4 py-2 font-semibold text-black transition-all hover:bg-white/86">
              Open app
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

function BillingCycleToggle({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] p-1 text-sm font-semibold text-white/44 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      role="radiogroup"
      aria-label="Billing cycle"
    >
      {(["monthly", "yearly"] as const).map((cycle) => {
        const isSelected = value === cycle;
        return (
          <button
            key={cycle}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(cycle)}
            className={`min-w-24 rounded-full px-5 py-2.5 transition-all duration-200 ${
              isSelected
                ? "bg-white/[0.10] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                : "text-white/42 hover:bg-white/[0.04] hover:text-white/68"
            }`}
          >
            {cycle === "monthly" ? "Monthly" : "Yearly"}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  index,
  isCurrent,
  isLoading,
  isGuest,
  loadingPlan,
  billingCycle,
  onUpgrade,
}: {
  plan: PlanConfig;
  index: number;
  isCurrent: boolean;
  isLoading: boolean;
  isGuest: boolean;
  loadingPlan: PlanId | "portal" | null;
  billingCycle: BillingCycle;
  onUpgrade: (planId: PlanId) => void;
}) {
  const isRecommended = plan.highlighted;
  const price = getDisplayedPrice(plan, billingCycle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className={`relative flex min-h-[520px] flex-col rounded-[1.15rem] border p-6 transition-all duration-300 ${
        isCurrent
          ? "border-green-positive/30 bg-green-positive/[0.075] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)]"
          : isRecommended
            ? "border-indigo-500/55 bg-[#101225]/95 shadow-[0_0_0_1px_rgba(99,102,241,0.24),0_20px_60px_rgba(99,102,241,0.16)] hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.48),0_28px_82px_rgba(99,102,241,0.28)]"
            : "border-white/[0.10] bg-[#0f1117]/94 shadow-[0_18px_58px_rgba(0,0,0,0.18)] hover:-translate-y-1 hover:border-indigo-primary/45 hover:bg-[#141827]/96 hover:shadow-[0_24px_76px_rgba(0,0,0,0.28),0_0_32px_rgba(99,102,241,0.12)]"
      }`}
    >
      <div className="mb-5 flex min-h-12 items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold leading-none text-white">{plan.name}</h2>
            {isRecommended && !isCurrent && (
              <span className="on-accent rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-bold leading-none text-white">
                Popular
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-white/42">{plan.subtitle}</p>
        </div>
        {isCurrent && (
          <span className="rounded-full border border-green-positive/24 bg-green-positive/12 px-2.5 py-1 text-xs font-semibold text-green-positive">
            Active
          </span>
        )}
      </div>

      <div className="mb-5 flex items-end gap-2">
        <span className="text-5xl font-bold tracking-tight text-white">{price.label}</span>
        {price.note && <span className="pb-1.5 text-xs leading-tight text-white/36">{price.note}</span>}
      </div>

      <button
        type="button"
        onClick={() => onUpgrade(plan.id)}
        disabled={loadingPlan !== null || isCurrent}
        className={`mb-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all active:scale-[0.98] ${
          isCurrent
            ? "border border-green-positive/20 bg-green-positive/10 text-green-positive"
            : isRecommended
              ? "on-accent bg-indigo-500 text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_6px_18px_rgba(99,102,241,0.3)] hover:bg-indigo-400"
              : "border border-white/[0.10] bg-[#171a23] text-white/76 hover:bg-[#202432] hover:text-white"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {isCurrent
          ? "Current plan"
          : isLoading
            ? "Opening Checkout..."
            : isGuest && plan.id !== "free"
              ? "Sign in to upgrade"
              : plan.ctaLabel}
        {!isCurrent && !isLoading && <ArrowRight className="h-4 w-4" />}
      </button>

      <p className="mb-6 text-sm leading-relaxed text-white/42">{plan.description}</p>

      <ul className="flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-white/62">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" /> {feature}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function getDisplayedPrice(plan: PlanConfig, billingCycle: BillingCycle) {
  if (billingCycle === "monthly" || plan.id === "execution") {
    return { label: plan.priceLabel, note: plan.priceNote };
  }

  const monthlyPrice = Number(plan.priceLabel.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(monthlyPrice)) {
    return { label: plan.priceLabel, note: plan.priceNote };
  }

  if (monthlyPrice === 0) {
    return { label: "$0", note: "per year" };
  }

  return {
    label: `$${Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT))}`,
    note: "per year",
  };
}

function BusinessAccess({ onRequestExecution }: { onRequestExecution: () => void }) {
  const executionPlan = PLANS.find((plan) => plan.id === "execution")!;

  return (
    <div className="relative mt-8 grid gap-5 md:grid-cols-2">
      <div className="rounded-[1.15rem] border border-white/[0.10] bg-[#0f1117]/88 p-6 text-center shadow-[0_18px_58px_rgba(0,0,0,0.18)]">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
          <Lock className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold text-white">Execution access</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/44">{executionPlan.description}</p>
        <button
          type="button"
          onClick={onRequestExecution}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-white/[0.10] bg-[#171a23] px-6 text-sm font-medium text-white/70 transition-all hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
        >
          {executionPlan.ctaLabel}
        </button>
      </div>

      <div className="rounded-[1.15rem] border border-white/[0.10] bg-[#0f1117]/88 p-6 text-center shadow-[0_18px_58px_rgba(0,0,0,0.18)]">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-indigo-primary/22 bg-indigo-primary/[0.12] text-indigo-300">
          <Building2 className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold text-white">Teams and education</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/44">
          Need shared research workflows, billing support, or classroom access? We can help map the right plan.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact-sales"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.10] bg-[#171a23] px-6 text-sm font-medium text-white/70 transition-all hover:bg-[#202432] hover:text-white"
          >
            Contact sales
          </Link>
          <Link
            href="/help"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-white/48 transition-all hover:bg-white/[0.06] hover:text-white/72"
          >
            <GraduationCap className="h-4 w-4" /> Learn more
          </Link>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable() {
  const planIds: PlanId[] = ["free", "pro", "trader", "quant", "execution"];
  const planLabels = ["Free", "Pro", "Trader", "Quant", "Execution"];

  return (
    <section className="mt-20">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-indigo-400">
          <Sparkles className="h-3.5 w-3.5" /> Compare
        </span>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">Plan access at a glance</h2>
      </div>

      <HorizontalScroll className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-4 text-left font-medium text-white/50">Feature</th>
              {planLabels.map((label, index) => (
                <th key={label} className={`px-4 py-4 text-center font-semibold ${planIds[index] === "trader" ? "text-indigo-400" : "text-white/70"}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_TABLE.map((row, index) => (
              <tr key={row.feature} className={`border-b border-white/[0.04] ${index % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-5 py-3 text-white/55">{row.feature}</td>
                {planIds.map((planId) => {
                  const value = row[planId] as CheckState;

                  return (
                    <td key={planId} className="px-4 py-3 text-center">
                      {value === true ? (
                        <Check className="mx-auto h-4 w-4 text-indigo-400" />
                      ) : value === false ? (
                        <span className="text-white/15">-</span>
                      ) : (
                        <span className="text-white/50">{value}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScroll>
    </section>
  );
}
