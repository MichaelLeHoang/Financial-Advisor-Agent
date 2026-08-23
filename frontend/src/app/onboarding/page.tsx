"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Layers3,
  LineChart,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import WorkspaceSelectMenu from "@/components/ui/workspace-select-menu";
import {
  useOnboarding,
  type InvestmentHorizon,
  type OnboardingStep,
  type RiskTolerance,
  type TradingHoldingPeriod,
  type WorkspacePreference,
} from "@/components/onboarding/OnboardingProvider";
import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";
import { loginHref, normalizeAppPath, onboardingHref } from "@/lib/workspace-routing";

const HORIZON_OPTIONS = [
  { value: "3-5-years", label: "3–5 years" },
  { value: "5-10-years", label: "5–10 years" },
  { value: "10-plus-years", label: "10+ years" },
];

const RISK_OPTIONS = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "growth", label: "Growth" },
];

const HOLDING_PERIOD_OPTIONS = [
  { value: "intraday", label: "Intraday" },
  { value: "swing", label: "Swing" },
  { value: "position", label: "Position" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { preferences, loading: onboardingLoading, saving, error, savePreferences, recordEntryEvent } = useOnboarding();
  const [step, setStep] = useState<OnboardingStep>("choice");
  const [choice, setChoice] = useState<WorkspacePreference | null>(null);
  const [nextPath, setNextPath] = useState("/home");
  const [nextReady, setNextReady] = useState(false);
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [horizon, setHorizon] = useState<InvestmentHorizon>("5-10-years");
  const [holdingPeriod, setHoldingPeriod] = useState<TradingHoldingPeriod>("swing");
  const [paperOnly, setPaperOnly] = useState(true);
  const hydratedUserRef = useRef<string | null>(null);
  const trackedUserRef = useRef<string | null>(null);

  useEffect(() => {
    setNextPath(normalizeAppPath(new URLSearchParams(window.location.search).get("next")));
    setNextReady(true);
  }, []);

  useEffect(() => {
    if (!loading && nextReady && user.is_guest) router.replace(loginHref(onboardingHref(nextPath)));
  }, [loading, nextPath, nextReady, router, user.is_guest]);

  useEffect(() => {
    if (!preferences || user.is_guest || hydratedUserRef.current === user.id) return;
    hydratedUserRef.current = user.id;
    setChoice(preferences.workspacePreference);
    setRisk(preferences.riskTolerance);
    setHorizon(preferences.investmentHorizon);
    setHoldingPeriod(preferences.tradingHoldingPeriod);
    setPaperOnly(preferences.paperTradingOnly);
    setStep(preferences.status === "pending" ? preferences.currentStep : "choice");
  }, [preferences, user.id, user.is_guest]);

  useEffect(() => {
    if (!nextReady || !preferences || user.is_guest || trackedUserRef.current === user.id) return;
    trackedUserRef.current = user.id;
    void recordEntryEvent(
      preferences.status === "pending" && preferences.currentStep === "preferences" ? "onboarding_resumed" : "onboarding_started",
      nextPath,
      { status: preferences.status, step: preferences.currentStep },
    );
  }, [nextPath, nextReady, preferences, recordEntryEvent, user.id, user.is_guest]);

  const continueToPreferences = async () => {
    if (!choice) return;
    try {
      await savePreferences({
        status: "pending",
        workspacePreference: choice,
        currentStep: "preferences",
        investmentHorizon: horizon,
        riskTolerance: risk,
        tradingHoldingPeriod: holdingPeriod,
        paperTradingOnly: paperOnly,
        completedAt: null,
        skippedAt: null,
      });
      setStep("preferences");
    } catch {
      // The provider exposes the actionable persistence error below the form.
    }
  };

  const finish = async (status: "complete" | "skipped") => {
    const timestamp = new Date().toISOString();
    try {
      await savePreferences({
        status,
        workspacePreference: choice,
        currentStep: step,
        investmentHorizon: horizon,
        riskTolerance: risk,
        tradingHoldingPeriod: holdingPeriod,
        paperTradingOnly: paperOnly,
        completedAt: status === "complete" ? timestamp : null,
        skippedAt: status === "skipped" ? timestamp : null,
      });
      await recordEntryEvent(status === "complete" ? "onboarding_completed" : "onboarding_skipped", nextPath, { preference: choice ?? "unset" });
      await recordEntryEvent("destination_restored", nextPath, { source: "onboarding" });
      window.localStorage.setItem("financial-advisor.coverSeen", "true");
      router.replace(nextPath);
    } catch {
      // Do not navigate until the account-scoped preference is durable.
    }
  };

  const busy = loading || onboardingLoading || saving;
  const currentStep = step === "choice" ? 1 : 2;
  const destinationName = nextPath === "/invest" ? "Invest" : nextPath === "/trade" ? "Trade" : "Quanfora";

  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 py-5 text-[var(--text-primary)] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--theme-border)] pb-5">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            disabled={busy}
            onClick={() => (step === "preferences" ? setStep("choice") : router.push("/"))}
            aria-label={step === "preferences" ? "Back to workspace choice" : "Go back"}
            className="rounded-lg justify-self-start"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <img src="/logo.png" width={32} height={32} alt="Quanfora" className="size-8 object-contain" />
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void finish("skipped")}
            className="rounded-lg px-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] justify-self-end"
          >
            Skip for now
          </Button>
        </header>

        <section aria-labelledby="onboarding-title" className="mx-auto max-w-4xl py-10 sm:py-14 lg:py-16">
          <div className="flex items-center justify-between gap-6">
            <p className="font-label text-xs font-semibold uppercase tracking-[0.08em] text-indigo-primary">
              One account · two focused workspaces
            </p>
            <p className="shrink-0 text-xs font-medium text-[var(--text-subtle)]">Step {currentStep} of 2</p>
          </div>
          <div
            role="progressbar"
            aria-label={`Onboarding progress: step ${currentStep} of 2`}
            aria-valuemin={1}
            aria-valuemax={2}
            aria-valuenow={currentStep}
            className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--surface-selected)]"
          >
            <div
              className={cn(
                "h-full rounded-full bg-indigo-primary transition-[width] duration-150 ease-out motion-reduce:transition-none",
                currentStep === 1 ? "w-1/2" : "w-full",
              )}
            />
          </div>

          <h1 id="onboarding-title" className="mt-8 max-w-3xl text-balance font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            {step === "choice" ? "How do you manage capital?" : "Set your starting guardrails"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
            {step === "choice"
              ? "This sets your starting context, not what you can access. Move between Invest and Trade at any time."
              : "Start with practical defaults. You can review and expand these policies inside each workspace."}
          </p>

          {step === "choice" ? (
            <div className="mt-10 grid gap-3 md:grid-cols-3" role="group" aria-label="Starting workspace">
              <Choice
                active={choice === "investing"}
                disabled={busy}
                icon={BriefcaseBusiness}
                title="Long-term investing"
                detail="Theses, allocation, concentration, and reviews"
                onClick={() => setChoice("investing")}
              />
              <Choice
                active={choice === "trading"}
                disabled={busy}
                icon={LineChart}
                title="Active trading"
                detail="Plans, sizing, paper orders, and review"
                onClick={() => setChoice("trading")}
              />
              <Choice
                active={choice === "both"}
                disabled={busy}
                icon={Layers3}
                title="Both"
                detail="One portfolio with two distinct decision books"
                onClick={() => setChoice("both")}
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-6 border-y border-[var(--theme-border)] py-7 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-7">
              {(choice === "investing" || choice === "both") && (
                <>
                  <Field label="Investment horizon">
                    <WorkspaceSelectMenu
                      ariaLabel="Investment horizon"
                      value={horizon}
                      options={HORIZON_OPTIONS}
                      onValueChange={(value) => setHorizon(value as InvestmentHorizon)}
                      className="h-12 w-full rounded-lg px-4"
                    />
                  </Field>
                  <Field label="Risk tolerance">
                    <WorkspaceSelectMenu
                      ariaLabel="Risk tolerance"
                      value={risk}
                      options={RISK_OPTIONS}
                      onValueChange={(value) => setRisk(value as RiskTolerance)}
                      className="h-12 w-full rounded-lg px-4"
                    />
                  </Field>
                </>
              )}
              {(choice === "trading" || choice === "both") && (
                <>
                  <Field label="Typical holding period">
                    <WorkspaceSelectMenu
                      ariaLabel="Typical holding period"
                      value={holdingPeriod}
                      options={HOLDING_PERIOD_OPTIONS}
                      onValueChange={(value) => setHoldingPeriod(value as TradingHoldingPeriod)}
                      className="h-12 w-full rounded-lg px-4"
                    />
                  </Field>
                  <label
                    htmlFor="paper-trading-first"
                    className={cn(
                      APP_RADIUS.nested,
                      "flex min-h-20 cursor-pointer items-center justify-between gap-4 border border-[var(--theme-border)] bg-[var(--surface-card)] px-4 py-3 transition-colors hover:bg-[var(--surface-card-hover)]",
                    )}
                  >
                    <span>
                      <strong className="block text-sm font-semibold">Paper trading first</strong>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">Keep every execution simulated</span>
                    </span>
                    <Checkbox
                      id="paper-trading-first"
                      checked={paperOnly}
                      onCheckedChange={(checked) => setPaperOnly(checked === true)}
                      disabled={busy}
                      className="on-accent"
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className={cn(
                APP_RADIUS.nested,
                "mt-6 flex items-start gap-3 border border-red-negative/30 bg-red-negative/10 px-4 py-3 text-sm text-[var(--text-secondary)]",
              )}
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-negative" />
              <p><strong className="text-[var(--text-primary)]">We couldn’t save your setup.</strong> {error} Try again.</p>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              type="button"
              size="lg"
              disabled={!choice || busy}
              onClick={() => (step === "choice" ? void continueToPreferences() : void finish("complete"))}
              className="theme-solid-action h-12 w-full rounded-lg px-5 font-semibold sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving…
                </>
              ) : (
                <>
                  {step === "choice" ? "Continue" : `Open ${destinationName}`}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Choice({
  active,
  disabled,
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: LucideIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        APP_RADIUS.nested,
        "relative min-h-44 border p-5 text-left outline-none transition-[background-color,border-color,opacity] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-indigo-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        active
          ? "border-indigo-primary/60 bg-[var(--surface-accent-soft)]"
          : "border-[var(--theme-border)] bg-[var(--surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-card-hover)]",
      )}
    >
      <span className="flex items-start justify-between gap-4">
        <Icon aria-hidden="true" className={cn("size-5", active ? "text-indigo-primary" : "text-[var(--text-muted)]")} />
        {active && (
          <span className="on-accent flex size-6 items-center justify-center rounded-full bg-indigo-primary" aria-hidden="true">
            <Check className="size-3.5" />
          </span>
        )}
      </span>
      <strong className="mt-8 block text-base font-semibold">{title}</strong>
      <span className="mt-2 block text-sm leading-6 text-[var(--text-muted)]">{detail}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">{label}</p>
      {children}
    </div>
  );
}
