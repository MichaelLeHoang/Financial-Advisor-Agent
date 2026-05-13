"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

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
  signUp: (email: string, password: string) => Promise<void>;
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
  const [user, setUser] = useState<AuthUser>(GUEST_USER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const supabase = getSupabaseBrowserClient();

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setAuthSession(nextSession);
      api.setAuthToken(nextSession?.access_token ?? null);

      if (!nextSession) {
        setUser(GUEST_USER);
        setLoading(false);
        return;
      }

      let fallbackUser = normalizeUser(nextSession.user);
      setUser(fallbackUser);

      try {
        const { data: freshUserData } = await supabase.auth.getUser();
        if (freshUserData.user) {
          fallbackUser = normalizeUser(freshUserData.user);
          if (mounted) setUser(fallbackUser);
        }

        const apiUser = await api.me();
        if (mounted && !apiUser.is_guest) {
          setUser({
            ...fallbackUser,
            ...apiUser,
            display_name: apiUser.display_name ?? fallbackUser.display_name,
            username: apiUser.username ?? fallbackUser.username,
            avatar_url: apiUser.avatar_url ?? fallbackUser.avatar_url,
          });
        }
      } catch {
        if (mounted) setUser(fallbackUser);
      } finally {
        if (mounted) setLoading(false);
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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

  const signUp = async (email: string, password: string) => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
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
    setAuthSession(null);
    setUser(GUEST_USER);
    setError(null);
    api.setAuthToken(null);
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
