"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

export type Plan = "free" | "pro" | "trader" | "quant" | "execution_addon";

export interface AuthUser {
  id: string;
  email: string | null;
  display_name?: string | null;
  plan: Plan;
  is_guest?: boolean;
}

interface AuthContextValue {
  user: AuthUser;
  token: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "faa.supabase.session";
const GUEST_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: null,
  display_name: "Guest",
  plan: "free",
  is_guest: true,
};

interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Sign in is not configured for this environment.");
  }
  return { url, anonKey };
}

function normalizeUser(payload: any): AuthUser {
  const metadata = payload.user_metadata ?? {};
  return {
    id: payload.id,
    email: payload.email ?? null,
    display_name: metadata.display_name ?? metadata.full_name ?? null,
    plan: metadata.plan ?? "free",
    is_guest: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as AuthSession;
    setSession(parsed);
    api.setAuthToken(parsed.access_token);
  }, []);

  const persistSession = (nextSession: AuthSession) => {
    setSession(nextSession);
    api.setAuthToken(nextSession.access_token);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  };

  const authenticate = async (email: string, password: string, mode: "signin" | "signup") => {
    setError(null);
    const { url, anonKey } = supabaseConfig();
    const endpoint = mode === "signin" ? `${url}/auth/v1/token?grant_type=password` : `${url}/auth/v1/signup`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error_description ?? data.msg ?? data.message ?? "Sign in failed";
      setError(message);
      throw new Error(message);
    }

    if (!data.access_token) {
      const message = "Check your email to confirm your account, then sign in.";
      setError(message);
      throw new Error(message);
    }

    persistSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: normalizeUser(data.user),
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? GUEST_USER,
      token: session?.access_token ?? null,
      loading: false,
      error,
      signIn: (email, password) => authenticate(email, password, "signin"),
      signUp: (email, password) => authenticate(email, password, "signup"),
      signOut: () => {
        setSession(null);
        setError(null);
        api.setAuthToken(null);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [session, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
