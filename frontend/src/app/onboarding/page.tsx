"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, LineChart } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOnboarding, type InvestmentHorizon, type OnboardingStep, type RiskTolerance, type TradingHoldingPeriod, type WorkspacePreference } from "@/components/onboarding/OnboardingProvider";
import { loginHref, normalizeAppPath, onboardingHref } from "@/lib/workspace-routing";

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
      { status: preferences.status, step: preferences.currentStep }
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

  return (
    <main className="min-h-screen bg-[#070809] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5"><button type="button" disabled={busy} onClick={() => step === "preferences" ? setStep("choice") : router.push("/")} aria-label="Go back" className="flex size-10 items-center justify-center border border-white/12 hover:bg-white/5 disabled:opacity-40"><ArrowLeft className="size-4" /></button><img src="/logo.svg" alt="Quanfora" className="h-7 brightness-0 invert" /><button type="button" disabled={busy} onClick={() => void finish("skipped")} className="text-sm text-white/55 hover:text-white disabled:opacity-40">Skip for now</button></header>
        <div className="mx-auto max-w-3xl py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase text-emerald-300">One account · two focused workspaces</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold sm:text-5xl">{step === "choice" ? "How do you manage capital?" : "Set your starting guardrails"}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/58">{step === "choice" ? "This changes your starting context, not what you can access. You can move between Invest and Trade at any time." : "Keep this lightweight. Policies can be reviewed and expanded inside each workspace."}</p>

          {step === "choice" ? <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Choice active={choice === "investing"} icon={BriefcaseBusiness} title="Long-term investing" detail="Theses, allocation, concentration, and reviews" onClick={() => setChoice("investing")} />
            <Choice active={choice === "trading"} icon={LineChart} title="Active trading" detail="Plans, sizing, paper orders, and review" onClick={() => setChoice("trading")} />
            <Choice active={choice === "both"} icon={Check} title="Both" detail="One portfolio with two distinct decision books" onClick={() => setChoice("both")} />
          </div> : <div className="mt-10 grid gap-6 border-y border-white/10 py-7 sm:grid-cols-2">
            {(choice === "investing" || choice === "both") && <><Field label="Investment horizon"><select value={horizon} onChange={(event) => setHorizon(event.target.value as InvestmentHorizon)}><option value="3-5-years">3–5 years</option><option value="5-10-years">5–10 years</option><option value="10-plus-years">10+ years</option></select></Field><Field label="Risk tolerance"><select value={risk} onChange={(event) => setRisk(event.target.value as RiskTolerance)}><option value="conservative">Conservative</option><option value="moderate">Moderate</option><option value="growth">Growth</option></select></Field></>}
            {(choice === "trading" || choice === "both") && <><Field label="Typical holding period"><select value={holdingPeriod} onChange={(event) => setHoldingPeriod(event.target.value as TradingHoldingPeriod)}><option value="intraday">Intraday</option><option value="swing">Swing</option><option value="position">Position</option></select></Field><label className="flex items-center justify-between gap-4 border-b border-white/12 py-3 text-sm"><span><strong className="block">Paper trading first</strong><span className="mt-1 block text-xs text-white/45">Keep every execution simulated</span></span><input type="checkbox" checked={paperOnly} onChange={(event) => setPaperOnly(event.target.checked)} className="size-4 accent-sky-300" /></label></>}
          </div>}

          {error && <p role="alert" className="mt-6 border-l-2 border-rose-400 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">Workspace setup could not be saved. {error}</p>}
          <div className="mt-8 flex justify-end"><button type="button" disabled={!choice || busy} onClick={() => step === "choice" ? void continueToPreferences() : void finish("complete")} className="inline-flex h-12 items-center gap-2 bg-white px-5 text-sm font-semibold text-black disabled:opacity-30">{saving ? "Saving..." : step === "choice" ? "Continue" : `Open ${nextPath === "/invest" ? "Invest" : nextPath === "/trade" ? "Trade" : "Quanfora"}`} <ArrowRight className="size-4" /></button></div>
        </div>
      </div>
    </main>
  );
}

function Choice({ active, icon: Icon, title, detail, onClick }: { active: boolean; icon: typeof BriefcaseBusiness; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-48 border p-5 text-left transition-colors ${active ? "border-emerald-300 bg-emerald-300/8" : "border-white/12 hover:bg-white/5"}`}><Icon className={active ? "size-5 text-emerald-300" : "size-5 text-white/55"} /><strong className="mt-10 block text-base">{title}</strong><span className="mt-2 block text-sm leading-6 text-white/48">{detail}</span></button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<div className="mt-2 [&_select]:h-11 [&_select]:w-full [&_select]:border [&_select]:border-white/12 [&_select]:bg-black [&_select]:px-3 [&_select]:text-sm">{children}</div></label>; }
