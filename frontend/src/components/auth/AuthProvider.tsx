"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Provider, Session, User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { clearLocalChatHistory, notifyChatPrivacyReset } from "@/lib/local-chat-history";
import { clearAccountScopedBrowserState } from "@/lib/privacy-storage";
import { authCallbackHref, normalizeAppPath } from "@/lib/workspace-routing";

export type Plan = "free" | "pro" | "trader" | "quant" | "execution_addon";

export interface AuthUser {
  id: string;
  email: string | null;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  plan: Plan;
  is_guest?: boolean;
}

interface AuthContextValue {
  user: AuthUser;
  token: string | null;
  loading: boolean;
  error: string | null;
  updateProfile: (profile: Partial<Pick<AuthUser, "display_name" | "username" | "avatar_url">>) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nextPath?: string) => Promise<void>;
  signInWithOAuth: (provider: Provider, nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: null,
  display_name: "Guest",
  plan: "free",
  is_guest: true,
};
const E2E_AUTH_ENABLED = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH === "1";
const E2E_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "e2e@quanfora.local",
  display_name: "E2E Researcher",
  plan: "trader",
  is_guest: false,
};

function normalizeUser(payload: User): AuthUser {
  const metadata = payload.user_metadata ?? {};
  const appMetadata = payload.app_metadata ?? {};
  return {
    id: payload.id,
    email: payload.email ?? null,
    display_name: metadata.display_name ?? metadata.full_name ?? null,
    username: metadata.username ?? null,
    avatar_url: metadata.avatar_url ?? null,
    plan: isPlan(appMetadata.plan) ? appMetadata.plan : "free",
    is_guest: false,
  };
}

function isPlan(value: unknown): value is Plan {
  return value === "free"
    || value === "pro"
    || value === "trader"
    || value === "quant"
    || value === "execution_addon";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(E2E_AUTH_ENABLED ? E2E_USER : GUEST_USER);
  const [loading, setLoading] = useState(!E2E_AUTH_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const previousIdentityRef = useRef<string | null>(null);
  const appliedAccessTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    let sessionGeneration = 0;
    if (E2E_AUTH_ENABLED) {
      return () => {
        mounted = false;
      };
    }
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const supabase = getSupabaseBrowserClient();

    const applySession = async (nextSession: Session | null, forceProfileRefresh = false) => {
      if (!mounted) return;
      const nextAccessToken = nextSession?.access_token ?? null;
      if (!forceProfileRefresh && appliedAccessTokenRef.current === nextAccessToken) return;
      appliedAccessTokenRef.current = nextAccessToken;
      const generation = ++sessionGeneration;
      const isCurrent = () => mounted && generation === sessionGeneration;

      setAuthSession(nextSession);
      api.setAuthToken(nextAccessToken);

      if (!nextSession) {
        setUser(GUEST_USER);
        setLoading(false);
        return;
      }

      let fallbackUser = normalizeUser(nextSession.user);
      setUser(fallbackUser);
      // The verified session already gives the app a safe identity and token.
      // Release route hydration now while fresher profile/plan data loads in parallel.
      setLoading(false);

      const [freshUserResult, apiUserResult] = await Promise.allSettled([
        supabase.auth.getUser(),
        api.me(),
      ]);
      if (!isCurrent()) return;

      if (freshUserResult.status === "fulfilled" && freshUserResult.value.data.user) {
        fallbackUser = normalizeUser(freshUserResult.value.data.user);
      }
      if (apiUserResult.status === "fulfilled" && !apiUserResult.value.is_guest) {
        const apiUser = apiUserResult.value;
        setUser({
          ...fallbackUser,
          ...apiUser,
          display_name: apiUser.display_name ?? fallbackUser.display_name,
          username: apiUser.username ?? fallbackUser.username,
          avatar_url: apiUser.avatar_url ?? fallbackUser.avatar_url,
        });
      } else {
        setUser(fallbackUser);
      }
    };

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) setError(sessionError.message);
        return applySession(data.session);
      })
      .catch((sessionError: Error) => {
        if (!mounted) return;
        setError(sessionError.message);
        api.setAuthToken(null);
        setUser(GUEST_USER);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void applySession(nextSession, event === "USER_UPDATED");
    });

    return () => {
      mounted = false;
      sessionGeneration += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const identity = user.is_guest ? "guest" : `user:${user.id}`;
    const previousIdentity = previousIdentityRef.current;
    previousIdentityRef.current = identity;

    if (previousIdentity && previousIdentity !== identity) {
      clearLocalChatHistory();
      clearAccountScopedBrowserState();
      notifyChatPrivacyReset();
    }
  }, [loading, user.id, user.is_guest]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
    if (data.session) {
      setAuthSession(data.session);
      api.setAuthToken(data.session.access_token);
    }
  };

  const signUp = async (email: string, password: string, nextPath = "/home") => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${authCallbackHref(nextPath)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }

    if (!data.session) {
      const message = "Check your email to confirm your account, then sign in.";
      setError(message);
      throw new Error(message);
    }

    setAuthSession(data.session);
    api.setAuthToken(data.session.access_token);
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearLocalChatHistory();
    notifyChatPrivacyReset();
    setAuthSession(null);
    setUser(GUEST_USER);
    setError(null);
    api.setAuthToken(null);
  };

  const signInWithOAuth = async (provider: Provider, nextPath = "/home") => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const safeNext = normalizeAppPath(nextPath);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${authCallbackHref(safeNext)}`,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      throw oauthError;
    }
  };

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>((profile) => {
    setUser((currentUser) => {
      if (currentUser.is_guest) return currentUser;

      return {
        ...currentUser,
        ...profile,
      };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: authSession?.access_token ?? null,
      loading,
      error,
      updateProfile,
      signIn,
      signUp,
      signInWithOAuth,
      signOut,
    }),
    [authSession, user, loading, error, updateProfile]
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
