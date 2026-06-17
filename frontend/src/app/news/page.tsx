"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  Bitcoin,
  Brain,
  Building2,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  Flame,
  Heart,
  Loader2,
  Newspaper,
  RefreshCw,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import type { NewsArticle, NewsResponse } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { IntroductionNav, IntroductionFooter } from "@/app/introduction/components";

const PREFS_KEY = "financial-advisor.news-categories";
const MAX_CATEGORIES = 3;

type CategoryDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
};

const CATEGORIES: CategoryDef[] = [
  { key: "market", label: "Market Overview", icon: BarChart3, gradient: "from-indigo-500 to-violet-500" },
  { key: "technology", label: "Technology", icon: Cpu, gradient: "from-blue-500 to-cyan-400" },
  { key: "crypto", label: "Crypto", icon: Bitcoin, gradient: "from-amber-500 to-orange-500" },
  { key: "energy", label: "Energy", icon: Flame, gradient: "from-red-500 to-orange-500" },
  { key: "healthcare", label: "Healthcare", icon: Heart, gradient: "from-emerald-500 to-teal-400" },
  { key: "financials", label: "Financials", icon: Building2, gradient: "from-green-500 to-emerald-400" },
  { key: "ai_semiconductors", label: "AI & Semis", icon: Brain, gradient: "from-purple-500 to-pink-500" },
  { key: "consumer", label: "Consumer", icon: ShoppingBag, gradient: "from-rose-500 to-pink-400" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function NewsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !authLoading && !user?.is_guest;
  const [selected, setSelected] = useState<string[]>([]);
  const [hasSetPrefs, setHasSetPrefs] = useState(false);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [lastFetch, setLastFetch] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) router.replace("/login?next=/news");
  }, [authLoading, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    const saved = window.localStorage.getItem(PREFS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelected(parsed);
          setHasSetPrefs(true);
        }
      } catch {
        /* ignore */
      }
    }
  }, [isSignedIn]);

  // Fetch news whenever selected categories change
  const fetchNews = useCallback(async () => {
    if (!isSignedIn) return;
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.news(selected, 30);
      setArticles(res.articles);
      setLastFetch(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch news");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, selected]);

  useEffect(() => {
    if (isSignedIn && hasSetPrefs) {
      fetchNews();
    }
  }, [isSignedIn, hasSetPrefs, fetchNews]);

  const toggleCategory = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, key];
    });
  };

  const confirmCategories = () => {
    if (selected.length === 0) return;
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(selected));
    setHasSetPrefs(true);
  };

  const resetPrefs = () => {
    window.localStorage.removeItem(PREFS_KEY);
    setHasSetPrefs(false);
    setSelected([]);
    setArticles([]);
    setLastFetch(null);
  };

  const featured = articles[0];
  const rest = articles.slice(1);
  const allSourcesFailed = Boolean(
    lastFetch
    && lastFetch.sources_attempted
    && (lastFetch.sources_succeeded ?? 0) === 0
  );

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      {(authLoading || !isSignedIn) && (
        <section className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl flex-col items-center justify-center px-6 pb-16 pt-32">
          <Loader2 className="size-8 animate-spin text-indigo-400" />
          <p className="mt-4 text-sm text-white/40">Checking news access...</p>
        </section>
      )}

      {/* Category Picker (Onboarding) */}
      {isSignedIn && !hasSetPrefs && (
        <section className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl flex-col items-center justify-center px-6 pb-16 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full text-center"
          >
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_40px_rgba(99,102,241,0.3)]">
              <Newspaper className="size-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What markets interest you?
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base text-white/50">
              Choose up to {MAX_CATEGORIES} categories to personalize your news feed. You can always change this later.
            </p>

            <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const isSelected = selected.includes(cat.key);
                const isDisabled = !isSelected && selected.length >= MAX_CATEGORIES;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleCategory(cat.key)}
                    className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border px-4 py-5 text-center transition-all duration-200 ${
                      isSelected
                        ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_24px_rgba(99,102,241,0.15)]"
                        : isDisabled
                        ? "cursor-not-allowed border-white/[0.04] bg-white/[0.02] opacity-40"
                        : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${cat.gradient} ${isSelected ? "shadow-lg" : "opacity-70 group-hover:opacity-100"} transition-opacity`}>
                      <Icon className="size-5 text-white" />
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/60"}`}>
                      {cat.label}
                    </span>
                    {isSelected && (
                      <motion.div
                        layoutId="cat-check"
                        className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white"
                      >
                        ✓
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-white/35">
                {selected.length}/{MAX_CATEGORIES} selected
              </p>
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={confirmCategories}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-8 text-sm font-semibold text-white shadow-[0_0_28px_rgba(99,102,241,0.3)] transition-all hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:shadow-none"
              >
                Continue
                <ChevronRight className="size-4" />
              </button>
            </div>
          </motion.div>
        </section>
      )}

      {/* News Feed */}
      {isSignedIn && hasSetPrefs && (
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-28 sm:pt-32">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financial News</h1>
              <p className="mt-1 text-sm text-white/40">Personalized feed from Yahoo Finance</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchNews}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={resetPrefs}
                className="inline-flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Change topics
              </button>
            </div>
          </motion.div>

          {/* Active Category Pills */}
          <div className="mb-8 flex flex-wrap gap-2">
            {selected.map((key) => {
              const cat = CATEGORIES.find((c) => c.key === key);
              if (!cat) return null;
              const Icon = cat.icon;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${cat.gradient} px-3.5 py-1.5 text-xs font-medium text-white shadow-sm`}
                >
                  <Icon className="size-3" />
                  {cat.label}
                </span>
              );
            })}
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && articles.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Loader2 className="size-8 animate-spin text-indigo-400" />
              <p className="text-sm text-white/40">Fetching latest news…</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && articles.length === 0 && !error && (
            <div className="flex flex-col items-center gap-4 py-20">
              <Newspaper className="size-10 text-white/20" />
              <p className="max-w-md text-center text-sm text-white/40">
                {allSourcesFailed
                  ? "News providers did not respond in time. Refresh again or try a different category."
                  : "No articles found. Try different categories."}
              </p>
            </div>
          )}

          {/* Articles */}
          <AnimatePresence mode="wait">
            {articles.length > 0 && (
              <motion.div
                key="articles"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* Featured Article */}
                {featured && (
                  <a
                    href={featured.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mb-8 block overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.02] transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_0_48px_rgba(99,102,241,0.08)]"
                  >
                    <div className="flex flex-col md:flex-row">
                      {/* Featured thumbnail or gradient */}
                      <div className="relative h-52 w-full overflow-hidden md:h-auto md:w-2/5">
                        {featured.thumbnail ? (
                          <img
                            src={featured.thumbnail}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-600/30 to-cyan-500/20">
                            <Zap className="size-12 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/80 to-transparent md:bg-gradient-to-r" />
                      </div>
                      <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
                        <div className="mb-3 flex items-center gap-3">
                          <CategoryBadge category={featured.category} />
                          <span className="flex items-center gap-1 text-xs text-white/30">
                            <Clock className="size-3" />
                            {timeAgo(featured.published_at)}
                          </span>
                        </div>
                        <h2 className="text-xl font-bold leading-tight text-white/90 transition-colors group-hover:text-white sm:text-2xl">
                          {featured.title}
                        </h2>
                        {featured.summary && (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/40">
                            {featured.summary}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-2 text-xs text-white/30">
                          <span>{featured.publisher}</span>
                          {featured.tickers.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-indigo-400/70">
                                {featured.tickers.slice(0, 3).join(", ")}
                              </span>
                            </>
                          )}
                          <ExternalLink className="ml-auto size-3.5 text-white/20 transition-colors group-hover:text-indigo-400" />
                        </div>
                      </div>
                    </div>
                  </a>
                )}

                {/* Grid */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article, i) => (
                    <motion.a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-[0_0_36px_rgba(99,102,241,0.06)]"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-36 w-full overflow-hidden">
                        {article.thumbnail ? (
                          <img
                            src={article.thumbnail}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-900/40 to-slate-900/60">
                            <Newspaper className="size-8 text-white/10" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/70 to-transparent" />
                        <div className="absolute bottom-3 left-3">
                          <CategoryBadge category={article.category} small />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white/85 transition-colors group-hover:text-white">
                          {article.title}
                        </h3>
                        {article.summary && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/35">
                            {article.summary}
                          </p>
                        )}
                        <div className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-white/25">
                          <span>{article.publisher}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {timeAgo(article.published_at)}
                          </span>
                          {article.tickers.length > 0 && (
                            <>
                              <span className="ml-auto font-mono text-indigo-400/50">
                                {article.tickers[0]}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {isSignedIn && <IntroductionFooter />}
    </main>
  );
}

function CategoryBadge({ category, small = false }: { category: string; small?: boolean }) {
  const cat = CATEGORIES.find((c) => c.key === category);
  if (!cat) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${cat.gradient} font-medium text-white shadow-sm ${
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {cat.label}
    </span>
  );
}
