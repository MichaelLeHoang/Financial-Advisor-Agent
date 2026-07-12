import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * OAuth callback route.
 *
 * After a user signs in with Google/Facebook/Discord via Supabase OAuth,
 * Supabase redirects here with a `code` query param. We exchange that code
 * for a session, then redirect the user into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/home";

  // Prevent open redirect — only allow relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/home";
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // In production behind a load balancer, honour x-forwarded-host.
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocal = process.env.NODE_ENV === "development";

        if (isLocal) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  // If something went wrong, send user back to login with an error hint.
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
