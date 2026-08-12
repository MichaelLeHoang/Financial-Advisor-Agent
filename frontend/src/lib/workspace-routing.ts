const DEFAULT_APP_PATH = "/home";

export function normalizeAppPath(value: string | null | undefined, fallback = DEFAULT_APP_PATH) {
  if (!value || isUnsafeAppPath(value)) return fallback;

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

export function authCallbackHref(nextPath = DEFAULT_APP_PATH) {
  return `/auth/callback?next=${encodeURIComponent(normalizeAppPath(nextPath))}`;
}

function isUnsafeAppPath(value: string) {
  let decoded = value;

  for (let pass = 0; pass < 3; pass += 1) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) {
      return true;
    }

    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return true;
    }
  }

  return !decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\");
}
