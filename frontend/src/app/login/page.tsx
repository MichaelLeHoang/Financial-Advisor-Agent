"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import type { Provider } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Zap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

function getSafeNextTarget() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/") || next.startsWith("//")) return "/";
  const target = new URL(next, window.location.origin);
  if (target.pathname === "/" && target.searchParams.has("session")) return "/";
  return `${target.pathname}${target.search}${target.hash}`;
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

  useEffect(() => {
    if (!loading && !user.is_guest) {
      router.replace(getSafeNextTarget());
    }
  }, [loading, router, user.is_guest]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (authMode === "signup" && !policyAccepted) {
      setFormError("Please agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }
    setSubmitting(true);
    try {
      if (authMode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      router.replace(getSafeNextTarget());
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    const referrer = document.referrer;
    const isSameOrigin = referrer && new URL(referrer).origin === window.location.origin;
    if (isSameOrigin) {
      router.back();
    } else {
      router.push("/introduction");
    }
  };

  const handleOAuthSignIn = async (provider: Provider) => {
    setFormError(null);
    if (authMode === "signup" && !policyAccepted) {
      setFormError("Please agree to the Terms of Service and Privacy Policy before continuing.");
      return;
    }
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider, getSafeNextTarget());
      // signInWithOAuth redirects to the OAuth provider — we don't reach here
      // unless there's a client-side error (caught below).
    } catch {
      setOauthLoading(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* ── Animated background ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0b14] via-[#0d0f1a] to-[#07080b]" />
        {/* indigo orb - top */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.35, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-indigo-600/20 blur-[140px]"
        />
        {/* cyan orb - bottom-right */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-cyan-500/15 blur-[120px]"
        />
        {/* purple orb - left */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute bottom-1/3 left-0 h-[400px] w-[400px] -translate-x-1/3 rounded-full bg-purple-600/12 blur-[100px]"
        />
        {/* subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <button
        type="button"
        aria-label="Go back"
        onClick={goBack}
        className="group absolute left-5 top-5 z-20 flex h-10 w-10 items-center justify-center text-white/42 transition-colors hover:text-white focus:outline-none focus-visible:text-white sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
      </button>

      {/* ── Login card ── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_80px_rgba(0,0,0,0.5),0_0_60px_rgba(99,102,241,0.08)] backdrop-blur-xl sm:p-10">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_10px_28px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]"
          >
            <Zap className="h-7 w-7 text-white" />
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-8 text-center"
          >
            <h1 className="text-2xl font-bold text-white">
              {authMode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p className="mt-2 text-sm text-white/40">
              {authMode === "signin"
                ? "Sign in to access your financial workspace"
                : "Start your AI-powered financial journey"}
            </p>
          </motion.div>

          {/* Auth mode toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 flex rounded-xl bg-white/[0.04] p-1"
          >
            <button
              type="button"
              onClick={() => setAuthMode("signin")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                authMode === "signin"
                  ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${
                authMode === "signup"
                  ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Sign up
            </button>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            onSubmit={submitAuth}
            className="space-y-4"
          >
            {/* Email */}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-indigo-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-11 pr-12 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-indigo-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition-colors hover:text-white/50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Forgot password */}
            {authMode === "signin" && (
              <div className="text-right">
                <button type="button" className="text-xs text-indigo-400/70 transition-colors hover:text-indigo-400">
                  Forgot password?
                </button>
              </div>
            )}

            {authMode === "signup" && (
              <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-left">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(event) => setPolicyAccepted(event.target.checked)}
                  className="mt-1 size-4 rounded border-white/15 bg-white/5 accent-indigo-500"
                  aria-describedby="signup-policy-consent"
                />
                <span id="signup-policy-consent" className="text-xs leading-5 text-white/48">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-300 transition-colors hover:text-white">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-300 transition-colors hover:text-white">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}

            {/* Error */}
            {(formError || authError) && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{formError || authError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || (authMode === "signup" && !policyAccepted)}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_8px_22px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.6),0_14px_36px_rgba(99,102,241,0.35)] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  {authMode === "signin" ? "Get Started" : "Create Account"}
                </>
              )}
            </button>
          </motion.form>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="my-6 flex items-center gap-4"
          >
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            <span className="text-xs text-white/25">Or sign in with</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </motion.div>

          {/* Social buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-3 gap-3"
          >
            <SocialButton label="Google" onClick={() => handleOAuthSignIn("google")} disabled={!!oauthLoading} loading={oauthLoading === "google"}>
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </SocialButton>

            <SocialButton label="Facebook" onClick={() => handleOAuthSignIn("facebook")} disabled={!!oauthLoading} loading={oauthLoading === "facebook"}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </SocialButton>

            <SocialButton label="Discord" onClick={() => handleOAuthSignIn("discord")} disabled={!!oauthLoading} loading={oauthLoading === "discord"}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </SocialButton>
          </motion.div>
        </div>

        {/* Back to app link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center"
        >
          <a
            href="/"
            className="text-xs text-white/30 transition-colors hover:text-white/50"
          >
            ← Continue as Guest
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}

function SocialButton({
  children,
  label,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Sign in with ${label}`}
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : (
        children
      )}
    </button>
  );
}
