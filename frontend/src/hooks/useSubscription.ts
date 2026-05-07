import { useState, useCallback, useMemo } from "react";
import type { PlanId } from "@/config/plans";
import { planMeetsMinimum } from "@/config/plans";
import { getFeature } from "@/config/features";

/**
 * Mock subscription hook.
 * TODO: Replace with real Supabase + Stripe subscription state
 * once the backend billing sprint is complete.
 */
export function useSubscription() {
  // TODO: Fetch real plan from backend via /api/v1/billing/subscription
  const [currentPlan, setCurrentPlan] = useState<PlanId>("free");
  const [isLoading] = useState(false);

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      const feature = getFeature(featureKey);
      if (!feature) return false;
      return planMeetsMinimum(currentPlan, feature.minPlan);
    },
    [currentPlan]
  );

  const getRequiredPlan = useCallback((featureKey: string): PlanId | undefined => {
    return getFeature(featureKey)?.minPlan;
  }, []);

  const upgradeToPlan = useCallback((planId: PlanId) => {
    // TODO: Open Stripe Checkout session via /api/v1/billing/create-checkout-session
    console.info(`[Mock] Stripe Checkout will be connected in the backend billing sprint. Target plan: ${planId}`);
    alert(`Stripe Checkout will be connected in the backend billing sprint.\n\nTarget plan: ${planId}`);
  }, []);

  const manageBilling = useCallback(() => {
    // TODO: Open Stripe Customer Portal via /api/v1/billing/create-customer-portal-session
    console.info("[Mock] Stripe Customer Portal will be connected in the backend billing sprint.");
    alert("Stripe Customer Portal will be connected in the backend billing sprint.");
  }, []);

  return useMemo(
    () => ({ currentPlan, isLoading, hasFeature, getRequiredPlan, upgradeToPlan, manageBilling, setCurrentPlan }),
    [currentPlan, isLoading, hasFeature, getRequiredPlan, upgradeToPlan, manageBilling]
  );
}
