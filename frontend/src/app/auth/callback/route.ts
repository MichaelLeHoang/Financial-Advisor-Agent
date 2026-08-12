import { NextResponse } from "next/server";
import { normalizeAppPath } from "@/lib/workspace-routing";

/**
 * OAuth callback route.
 *
 * Supabase returns a PKCE authorization code here. The login page owns the
 * browser client and verifier, so forward the code there with a safe target.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const next = normalizeAppPath(searchParams.get("next"));
  const origin = trustedRedirectOrigin(requestUrl);

  if (code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("code", code);
    return NextResponse.redirect(loginUrl);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", searchParams.get("error_description") ?? "oauth_failed");
  return NextResponse.redirect(loginUrl);
}

function trustedRedirectOrigin(requestUrl: URL) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl) return requestUrl.origin;

  try {
    return new URL(configuredSiteUrl).origin;
  } catch {
    return requestUrl.origin;
  }
}
