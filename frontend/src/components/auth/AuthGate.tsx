"use client";

import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-space-black text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-space-black p-6 text-white">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Financial Advisor Agent</h1>
            <p className="text-sm text-white/42">{mode === "signin" ? "Sign in to continue" : "Create your research account"}</p>
          </div>
        </div>

        <div className="mb-4 flex rounded-xl bg-white/[0.04] p-1">
          {(["signin", "signup"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn(
                "h-9 flex-1 rounded-lg text-sm transition-colors",
                mode === item ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white"
              )}
            >
              {item === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/35">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mb-4 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm outline-none focus:border-indigo-primary/50"
          required
        />

        <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/35">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mb-4 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm outline-none focus:border-indigo-primary/50"
          required
          minLength={6}
        />

        {error && <p className="mb-4 text-sm text-red-negative">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-primary text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
