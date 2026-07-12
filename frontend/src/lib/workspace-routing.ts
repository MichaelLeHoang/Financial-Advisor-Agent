const DEFAULT_APP_PATH = "/home";

export function normalizeAppPath(value: string | null | undefined, fallback = DEFAULT_APP_PATH) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const origin = "https://quanfora.local";
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function loginHref(nextPath = DEFAULT_APP_PATH) {
  return `/login?next=${encodeURIComponent(normalizeAppPath(nextPath))}`;
}

export function onboardingHref(nextPath = DEFAULT_APP_PATH) {
  return `/onboarding?next=${encodeURIComponent(normalizeAppPath(nextPath))}`;
}
