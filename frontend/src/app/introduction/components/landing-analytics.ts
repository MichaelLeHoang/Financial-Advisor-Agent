"use client";

export type LandingEventName =
  | "landing_launch_app_click"
  | "landing_sample_research_click"
  | "landing_pricing_click"
  | "landing_scattered_workspace_view"
  | "landing_journey_step_view"
  | "platform_overview_view"
  | "platform_multi_agent_phase_view"
  | "platform_cta_click";

type LandingEventPayload = Record<string, boolean | number | string | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, payload?: LandingEventPayload) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackLandingEvent(eventName: LandingEventName, payload: LandingEventPayload = {}) {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...payload });
    return;
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
}
