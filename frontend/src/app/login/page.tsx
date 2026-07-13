"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Provider } from "@supabase/supabase-js";
import { ChevronDown, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { HighlightPill } from "@/components/ui/highlight-pill";
import { cn } from "@/lib/utils";
import { normalizeAppPath, onboardingHref } from "@/lib/workspace-routing";

const QUOTES = [
  {
    text: "An investment operation is one which, upon thorough analysis, promises safety of principal and an adequate return. Operations not meeting these requirements are speculative.",
    source: "Benjamin Graham and David Dodd",
  },
  {
    text: "Know your circle of competence, and stick within it. The size of that circle is not very important; knowing its boundaries, however, is vital.",
    source: "Warren Buffett",
  },
  {
    text: "Most investors are primarily oriented toward return, how much they can make, and pay little attention to risk, how much they can lose.",
    source: "Seth Klarman",
  },
  {
    text: "The four most dangerous words in investing are: this time it's different.",
    source: "Sir John Templeton",
  },
];

function getSafeNextTarget() {
  if (typeof window === "undefined") return "/home";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return "/home";
  const target = new URL(normalizeAppPath(next), window.location.origin);
  if (target.pathname === "/" && target.searchParams.has("session")) {
    const sessionId = target.searchParams.get("session");
    return sessionId ? `/ai/${encodeURIComponent(sessionId)}` : "/ai";
  }
  return normalizeAppPath(`${target.pathname}${target.search}${target.hash}`);
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithOAuth, user, loading, error: authError } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [otherOptionsOpen, setOtherOptionsOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const previousTheme = document.body.dataset.theme;
    const lockTheme = () => {
      document.body.dataset.theme = "Deep Space";
      document.body.dataset.authThemeLock = "true";
    };

    lockTheme();
    const frame = window.requestAnimationFrame(lockTheme);

    return () => {
      window.cancelAnimationFrame(frame);
      delete document.body.dataset.authThemeLock;
      if (previousTheme) {
        document.body.dataset.theme = previousTheme;
      } else {
        delete document.body.dataset.theme;
      }
    };
  }, []);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) setFormError(callbackError.slice(0, 300));
  }, []);

  useEffect(() => {
    if (!loading && !user.is_guest) {
      window.localStorage.setItem("financial-advisor.coverSeen", "true");
      const next = getSafeNextTarget();
      const onboardingIntent = window.sessionStorage.getItem("quanfora.onboarding.intent") === "signup";
      if (onboardingIntent) {
        window.sessionStorage.removeItem("quanfora.onboarding.intent");
        router.replace(onboardingHref(next));
      } else {
        router.replace(next);
      }
    }
  }, [loading, router, user.is_guest]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((index) => (index + 1) % QUOTES.length);
    }, 7200);

    return () => window.clearInterval(timer);
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Enter your email address.");
      return;
    }
    if (!password) {
      setFormError("Enter your password.");
      return;
    }
    if (authMode === "signup" && !policyAccepted) {
      setFormError("Please agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === "signin") {
        await signIn(email, password);
      } else {
        window.sessionStorage.setItem("quanfora.onboarding.intent", "signup");
        await signUp(email, password, getSafeNextTarget());
      }
      router.replace(authMode === "signup" ? onboardingHref(getSafeNextTarget()) : getSafeNextTarget());
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: Provider) => {
    setFormError(null);
    setOauthLoading(provider);
    try {
      if (authMode === "signup") window.sessionStorage.setItem("quanfora.onboarding.intent", "signup");
      await signInWithOAuth(provider, getSafeNextTarget());
    } catch {
      setOauthLoading(null);
    }
  };

  const activeQuote = QUOTES[quoteIndex];
  const activeQuoteWords = activeQuote.text.split(" ");
  const highlightedQuoteWords = Math.ceil(activeQuoteWords.length / 2);
  const highlightedQuoteText = activeQuoteWords.slice(0, highlightedQuoteWords).join(" ");
  const mutedQuoteText = activeQuoteWords.slice(highlightedQuoteWords).join(" ");

  return (
    <main className="login-theme-lock flex min-h-screen bg-[#070707] text-white">
      <Link
        href="/"
        aria-label="Quanfora home"
        className="fixed left-5 top-5 z-30 flex size-9 items-center justify-center rounded-full text-white/78 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <img src="/logo.svg" alt="" className="size-7 object-contain brightness-0 invert" />
      </Link>

      <section className="relative m-2 hidden min-h-[calc(100vh-1rem)] w-[48%] overflow-hidden md:block lg:w-1/2">
        <img
          src="/sign-in.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/18" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_76%,rgba(255,255,255,0.22),transparent_24%),linear-gradient(90deg,rgba(0,0,0,0.72),rgba(0,0,0,0.16)_58%,rgba(255,255,255,0.08))]" />
        <div className="relative z-10 flex h-full w-full items-center justify-center px-8 text-center xl:px-12">
          <div className="w-full max-w-[52rem]">
            <div className="relative h-80 w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeQuote.text}
                  initial={{ opacity: 0, y: 14, filter: "blur(7px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(7px)" }}
                  transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
                >
                  <p
                    className="mx-auto text-white/44"
                    style={{
                      width: "min(100%, 50rem)",
                      whiteSpace: "normal",
                      overflowWrap: "normal",
                      wordBreak: "normal",
                      fontSize: "clamp(1.2rem, 1.9vw, 2rem)",
                      lineHeight: 1.52,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    <span className="text-white">&quot;{highlightedQuoteText}</span>
                    {mutedQuoteText ? ` ${mutedQuoteText}` : ""}
                    &quot;
                  </p>
                  <p className="mt-8 text-sm text-white/42">{activeQuote.source}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-10 md:w-[52%] lg:w-1/2 lg:px-12">
        <div className="flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col">
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-10 text-center">
              <h1 className="font-serif text-2xl font-normal tracking-[-0.01em] text-white/90">
                Welcome to Quanfora
              </h1>
              <p className="mt-4 text-sm text-white/42">Sign in or create an account</p>
            </div>

            <div className="space-y-3">
              <OAuthButton
                label="Continue with Google"
                disabled={Boolean(oauthLoading)}
                loading={oauthLoading === "google"}
                onClick={() => handleOAuthSignIn("google")}
                icon={<GoogleIcon />}
              />
              <OAuthButton
                label="Continue with Discord"
                disabled={Boolean(oauthLoading)}
                loading={oauthLoading === "discord"}
                onClick={() => handleOAuthSignIn("discord")}
                icon={<DiscordIcon />}
              />
            </div>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-sm text-white/38">or</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <button
              type="button"
              aria-expanded={otherOptionsOpen}
              onClick={() => setOtherOptionsOpen((open) => !open)}
              className="flex h-14 w-full items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.045] px-5 text-sm font-medium text-white/82 transition-colors hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Show other options
              <ChevronDown className={cn("size-4 text-white/45 transition-transform", otherOptionsOpen && "rotate-180")} />
            </button>

            <AnimatePresence initial={false}>
              {otherOptionsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-5">
                    <div className="mb-4 grid grid-cols-2 border border-white/[0.08] bg-white/[0.035] p-1" role="tablist" aria-label="Authentication mode">
                      {(["signin", "signup"] as const).map((mode) => {
                        const isActive = authMode === mode;

                        return (
                          <div key={mode} className="relative">
                            {isActive && (
                              <HighlightPill layoutId="login-auth-mode-pill" className="absolute inset-0 bg-white" />
                            )}
                            <button
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => {
                                setAuthMode(mode);
                                setFormError(null);
                              }}
                              className={cn(
                                "relative z-10 h-10 w-full text-sm font-medium transition-colors",
                                isActive ? "text-black" : "text-white/46 hover:text-white"
                              )}
                            >
                              {mode === "signin" ? "Sign in" : "Sign up"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <form noValidate onSubmit={submitAuth} className="space-y-4">
                      <label className="relative block">
                        <span className="sr-only">Email</span>
                        <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/32" />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="Email"
                          autoComplete="email"
                          className="h-14 w-full border border-white/[0.10] bg-transparent pl-12 pr-4 text-base text-white outline-none transition-colors placeholder:text-white/30 hover:border-white/18 focus:border-white/30"
                        />
                      </label>

                      <label className="relative block">
                        <span className="sr-only">Password</span>
                        <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/32" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password"
                          autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                          className="h-14 w-full border border-white/[0.10] bg-transparent pl-12 pr-12 text-base text-white outline-none transition-colors placeholder:text-white/30 hover:border-white/18 focus:border-white/30"
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/34 transition-colors hover:text-white/70"
                        >
                          {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                      </label>

                      <AnimatePresence mode="wait" initial={false}>
                        {authMode === "signin" ? (
                          <motion.div
                            key="signin-options"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="text-right"
                          >
                            <button type="button" className="text-sm text-indigo-300 transition-colors hover:text-indigo-100">
                              Forgot password?
                            </button>
                          </motion.div>
                        ) : (
                          <motion.label
                            key="signup-policy"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-start gap-3 border border-white/[0.08] bg-white/[0.025] p-3 text-left"
                          >
                            <input
                              type="checkbox"
                              checked={policyAccepted}
                              onChange={(event) => setPolicyAccepted(event.target.checked)}
                              className="mt-1 size-4 border-white/15 bg-transparent accent-white"
                              aria-describedby="signup-policy-consent"
                            />
                            <span id="signup-policy-consent" className="text-xs leading-5 text-white/46">
                              I agree to the{" "}
                              <Link href="/terms" target="_blank" className="text-white/78 underline underline-offset-2 hover:text-white">
                                Terms of Service
                              </Link>{" "}
                              and{" "}
                              <Link href="/privacy" target="_blank" className="text-white/78 underline underline-offset-2 hover:text-white">
                                Privacy Policy
                              </Link>
                              .
                            </span>
                          </motion.label>
                        )}
                      </AnimatePresence>

                      {(formError || authError) && (
                        <p className="border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                          {formError || authError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || (authMode === "signup" && !policyAccepted)}
                        className="h-12 w-full border border-white bg-white text-sm font-semibold text-black transition-colors hover:bg-white/86 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {submitting ? "Working..." : authMode === "signin" ? "Sign in" : "Create account"}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 text-center text-xs leading-6 text-white/38">
            By signing in you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-white/70">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-white/70">
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

function OAuthButton({
  icon,
  label,
  onClick,
  disabled,
  loading,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-3 border border-white/[0.08] bg-transparent text-sm font-medium text-white/82 transition-colors hover:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" /> : icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 3.958c1.475 0 2.796.509 3.838 1.5l2.854-2.854C14.959.992 12.696 0 10 0a9.995 9.995 0 0 0-8.933 5.508l3.325 2.58c.787-2.371 3-4.13 5.608-4.13Z" fill="#EA4335" />
      <path d="M19.575 10.23c0-.655-.063-1.288-.158-1.897H10v3.759h5.392a4.648 4.648 0 0 1-1.992 2.991l3.22 2.5c1.88-1.741 2.955-4.316 2.955-7.354Z" fill="#4285F4" />
      <path d="M4.388 11.912A6.075 6.075 0 0 1 4.07 10c0-.667.112-1.308.317-1.913L1.063 5.508A9.964 9.964 0 0 0 0 10c0 1.617.383 3.142 1.067 4.492l3.32-2.58Z" fill="#FBBC05" />
      <path d="M10 20c2.7 0 4.97-.887 6.62-2.42l-3.22-2.5c-.896.603-2.05.958-3.4.958-2.608 0-4.82-1.759-5.612-4.13l-3.325 2.58C2.712 17.758 6.091 20 10 20Z" fill="#34A853" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}
