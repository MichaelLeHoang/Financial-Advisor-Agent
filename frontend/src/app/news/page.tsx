"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Bitcoin,
  BookOpenText,
  Brain,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  FileText,
  Flame,
  Heart,
  LineChart,
  Loader2,
  Newspaper,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  ShoppingBag,
  Target,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { MarketIntelligenceResponse, NewsArticle, NewsBriefCard, NewsResponse, ResearchReport, TodayPickCard } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { IntroductionFooter, IntroductionNav } from "@/app/introduction/components";
import { cn } from "@/lib/utils";

const LEGACY_PREFS_KEY = "financial-advisor.news-categories";
const PREFS_KEY_PREFIX = "financial-advisor.news-categories.";
const MAX_CATEGORIES = 3;
const TABS = ["news", "briefing", "picks", "reports"] as const;

type IntelligenceTab = (typeof TABS)[number];

type CategoryDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  selected: string;
  iconTone: string;
  pill: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "market",
    label: "Market Overview",
    icon: BarChart3,
    accent: "hover:border-sky-300/34 hover:bg-sky-300/[0.08]",
    selected: "border-sky-300/45 bg-sky-300/[0.12] text-sky-50 shadow-[0_0_0_1px_rgba(125,211,252,0.10)]",
    iconTone: "border-sky-300/26 bg-sky-300/[0.12] text-sky-200",
    pill: "border-sky-300/22 bg-sky-300/[0.10] text-sky-100",
  },
  {
    key: "technology",
    label: "Technology",
    icon: Cpu,
    accent: "hover:border-indigo-300/34 hover:bg-indigo-300/[0.08]",
    selected: "border-indigo-300/45 bg-indigo-300/[0.12] text-indigo-50 shadow-[0_0_0_1px_rgba(165,180,252,0.10)]",
    iconTone: "border-indigo-300/26 bg-indigo-300/[0.12] text-indigo-200",
    pill: "border-indigo-300/22 bg-indigo-300/[0.10] text-indigo-100",
  },
  {
    key: "crypto",
    label: "Crypto",
    icon: Bitcoin,
    accent: "hover:border-amber-300/34 hover:bg-amber-300/[0.08]",
    selected: "border-amber-300/45 bg-amber-300/[0.12] text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.10)]",
    iconTone: "border-amber-300/26 bg-amber-300/[0.12] text-amber-200",
    pill: "border-amber-300/22 bg-amber-300/[0.10] text-amber-100",
  },
  {
    key: "energy",
    label: "Energy",
    icon: Flame,
    accent: "hover:border-orange-300/34 hover:bg-orange-300/[0.08]",
    selected: "border-orange-300/45 bg-orange-300/[0.12] text-orange-50 shadow-[0_0_0_1px_rgba(253,186,116,0.10)]",
    iconTone: "border-orange-300/26 bg-orange-300/[0.12] text-orange-200",
    pill: "border-orange-300/22 bg-orange-300/[0.10] text-orange-100",
  },
  {
    key: "healthcare",
    label: "Healthcare",
    icon: Heart,
    accent: "hover:border-emerald-300/34 hover:bg-emerald-300/[0.08]",
    selected: "border-emerald-300/45 bg-emerald-300/[0.12] text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.10)]",
    iconTone: "border-emerald-300/26 bg-emerald-300/[0.12] text-emerald-200",
    pill: "border-emerald-300/22 bg-emerald-300/[0.10] text-emerald-100",
  },
  {
    key: "financials",
    label: "Financials",
    icon: Building2,
    accent: "hover:border-lime-300/34 hover:bg-lime-300/[0.08]",
    selected: "border-lime-300/45 bg-lime-300/[0.12] text-lime-50 shadow-[0_0_0_1px_rgba(190,242,100,0.10)]",
    iconTone: "border-lime-300/26 bg-lime-300/[0.12] text-lime-200",
    pill: "border-lime-300/22 bg-lime-300/[0.10] text-lime-100",
  },
  {
    key: "ai_semiconductors",
    label: "AI & Semis",
    icon: Brain,
    accent: "hover:border-violet-300/34 hover:bg-violet-300/[0.08]",
    selected: "border-violet-300/45 bg-violet-300/[0.12] text-violet-50 shadow-[0_0_0_1px_rgba(196,181,253,0.10)]",
    iconTone: "border-violet-300/26 bg-violet-300/[0.12] text-violet-200",
    pill: "border-violet-300/22 bg-violet-300/[0.10] text-violet-100",
  },
  {
    key: "consumer",
    label: "Consumer",
    icon: ShoppingBag,
    accent: "hover:border-rose-300/34 hover:bg-rose-300/[0.08]",
    selected: "border-rose-300/45 bg-rose-300/[0.12] text-rose-50 shadow-[0_0_0_1px_rgba(253,164,175,0.10)]",
    iconTone: "border-rose-300/26 bg-rose-300/[0.12] text-rose-200",
    pill: "border-rose-300/22 bg-rose-300/[0.10] text-rose-100",
  },
];

function scopedPrefsKey(userId: string) {
  return `${PREFS_KEY_PREFIX}${userId}`;
}

function sanitizeTab(value: string | null): IntelligenceTab {
  return TABS.includes(value as IntelligenceTab) ? (value as IntelligenceTab) : "news";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Time unavailable";
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
    return "Time unavailable";
  }
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

type RiskTone = "base" | "success" | "warning" | "danger";

function riskTone(level: string): RiskTone {
  const normalized = level.toLowerCase();
  if (normalized === "low") return "success";
  if (normalized === "medium") return "warning";
  if (normalized === "high" || normalized === "critical") return "danger";
  return "base";
}

function riskToneClass(tone: RiskTone) {
  const styles: Record<RiskTone, string> = {
    base: "text-white/78",
    success: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
  };
  return styles[tone];
}

function NewsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !authLoading && !user?.is_guest;
  const activeTab = sanitizeTab(searchParams.get("tab"));
  const [selected, setSelected] = useState<string[]>([]);
  const [hasSetPrefs, setHasSetPrefs] = useState(false);
  const [rawNews, setRawNews] = useState<NewsResponse | null>(null);
  const [workspace, setWorkspace] = useState<MarketIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) router.replace("/login?next=/news");
  }, [authLoading, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;
    const scopedKey = scopedPrefsKey(user.id);
    const saved = window.localStorage.getItem(scopedKey) ?? window.localStorage.getItem(LEGACY_PREFS_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((key) => CATEGORIES.some((category) => category.key === key)).slice(0, MAX_CATEGORIES);
        if (valid.length > 0) {
          setSelected(valid);
          setHasSetPrefs(true);
          window.localStorage.setItem(scopedKey, JSON.stringify(valid));
          window.localStorage.removeItem(LEGACY_PREFS_KEY);
        }
      }
    } catch {
      window.localStorage.removeItem(scopedKey);
    }
  }, [isSignedIn, user?.id]);

  const fetchWorkspace = useCallback(async () => {
    if (!isSignedIn || selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const [newsResponse, intelligenceResponse] = await Promise.all([
        api.news(selected, 30),
        api.marketIntelligence(selected, 30),
      ]);
      setRawNews(newsResponse);
      setWorkspace(intelligenceResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build market intelligence.");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, selected]);

  useEffect(() => {
    if (isSignedIn && hasSetPrefs) void fetchWorkspace();
  }, [fetchWorkspace, hasSetPrefs, isSignedIn]);

  const toggleCategory = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, key];
    });
  };

  const confirmCategories = () => {
    if (selected.length === 0 || !user?.id) return;
    window.localStorage.setItem(scopedPrefsKey(user.id), JSON.stringify(selected));
    setHasSetPrefs(true);
  };

  const resetPrefs = () => {
    if (user?.id) window.localStorage.removeItem(scopedPrefsKey(user.id));
    window.localStorage.removeItem(LEGACY_PREFS_KEY);
    setSelected([]);
    setRawNews(null);
    setWorkspace(null);
    setHasSetPrefs(false);
    router.replace("/news", { scroll: false });
  };

  const setTab = (tab: IntelligenceTab) => {
    router.replace(`/news?tab=${tab}`, { scroll: false });
  };

  const selectedLabels = useMemo(
    () => selected.map((key) => CATEGORIES.find((category) => category.key === key)).filter((category): category is CategoryDef => Boolean(category)),
    [selected]
  );

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      {(authLoading || !isSignedIn) && (
        <section className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl flex-col items-center justify-center px-6 pb-16 pt-32">
          <Loader2 className="size-8 animate-spin text-indigo-300" />
          <p className="mt-4 text-sm text-white/45">Checking market intelligence access...</p>
        </section>
      )}

      {isSignedIn && !hasSetPrefs && (
        <CategorySetup selected={selected} onToggle={toggleCategory} onConfirm={confirmCategories} />
      )}

      {isSignedIn && hasSetPrefs && (
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/55">
                <SearchCheck className="size-3.5 text-indigo-300" />
                Evidence-first market workspace
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Market Intelligence</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">
                A disciplined brief built from your selected market themes. Use it to triage catalysts, source quality, and risk before opening deeper Quanfora 2.1 analysis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={fetchWorkspace}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 text-sm font-semibold text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                Refresh
              </button>
              <button
                type="button"
                onClick={resetPrefs}
                className="inline-flex h-10 items-center rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 text-sm font-semibold text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Change topics
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {selectedLabels.map((category) => (
              <span key={category.key} className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", category.pill)}>
                {category.label}
              </span>
            ))}
          </div>

          <div className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
            <TabButton active={activeTab === "news"} icon={<Newspaper className="size-4" />} label="News" onClick={() => setTab("news")} />
            <TabButton active={activeTab === "briefing"} icon={<Newspaper className="size-4" />} label="Briefing" onClick={() => setTab("briefing")} />
            <TabButton active={activeTab === "picks"} icon={<Target className="size-4" />} label="Today's Picks" onClick={() => setTab("picks")} />
            <TabButton active={activeTab === "reports"} icon={<FileText className="size-4" />} label="Reports" onClick={() => setTab("reports")} />
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {loading && !workspace && !rawNews && (
            <div className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025]">
              <Loader2 className="size-8 animate-spin text-indigo-300" />
              <p className="text-sm text-white/45">Building the intelligence brief...</p>
            </div>
          )}

          {!loading && activeTab === "news" && rawNews && rawNews.articles.length === 0 && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] text-center">
              <Newspaper className="size-10 text-white/20" />
              <p className="max-w-md text-sm text-white/42">
                No source articles were returned. Refresh again or choose a different market mix.
              </p>
            </div>
          )}

          {!loading && activeTab !== "news" && workspace && workspace.briefing.length === 0 && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] text-center">
              <Newspaper className="size-10 text-white/20" />
              <p className="max-w-md text-sm text-white/42">
                No intelligence cards were generated from this source set. Refresh again or choose a different market mix.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {activeTab === "news" && rawNews && rawNews.articles.length > 0 && (
                <NewsTab articles={rawNews.articles} />
              )}

              {activeTab !== "news" && workspace && workspace.briefing.length > 0 && (
                <>
                  {activeTab === "briefing" && <BriefingTab cards={workspace.briefing} />}
                  {activeTab === "picks" && <PicksTab picks={workspace.picks} onViewReports={() => setTab("reports")} />}
                  {activeTab === "reports" && <ReportsTab reports={workspace.reports} />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {isSignedIn && <IntroductionFooter />}
    </main>
  );
}

function CategorySetup({
  selected,
  onToggle,
  onConfirm,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-4xl flex-col items-center justify-center px-6 pb-16 pt-32">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full"
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.05]">
            <Newspaper className="size-6 text-indigo-200" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Choose your intelligence brief</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/48">
            Select up to {MAX_CATEGORIES} market themes. Quanfora will turn the news tape into briefing cards, research opportunities, and memo-style reports.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((category) => {
            const isSelected = selected.includes(category.key);
            const isDisabled = !isSelected && selected.length >= MAX_CATEGORIES;
            const Icon = category.icon;
            return (
              <button
                key={category.key}
                type="button"
                disabled={isDisabled}
                onClick={() => onToggle(category.key)}
                className={cn(
                  "relative flex min-h-32 flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? category.selected
                    : isDisabled
                    ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-white/28"
                    : cn("border-white/[0.08] bg-white/[0.035] text-white/62 hover:text-white", category.accent)
                )}
              >
                <span className={cn("flex size-9 items-center justify-center rounded-lg border", category.iconTone)}>
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-semibold">{category.label}</span>
                {isSelected && (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-white text-[#050507]">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-sm text-white/38">{selected.length}/{MAX_CATEGORIES} selected</p>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={onConfirm}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-[#050507] transition-colors hover:bg-white/88 disabled:opacity-40"
          >
            Build workspace
            <ChevronRight className="size-4" />
          </button>
        </div>
      </motion.div>
    </section>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative inline-flex h-11 items-center gap-2 px-2 text-sm font-semibold transition-colors sm:px-3",
        active ? "text-white" : "text-white/48 hover:text-white"
      )}
    >
      {icon}
      {label}
      <span className="absolute bottom-0 left-2 right-2 h-px bg-white/12" />
      <motion.span
        className={cn("absolute bottom-0 left-2 right-2 h-[2px] rounded-full", active ? "bg-white" : "bg-white/45")}
        initial={false}
        animate={{ scaleX: active ? 1 : 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
      />
    </button>
  );
}

function NewsTab({ articles }: { articles: NewsArticle[] }) {
  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div>
      {featured && <FeaturedNewsArticle article={featured} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((article) => (
          <NewsArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}

function FeaturedNewsArticle({ article }: { article: NewsArticle }) {
  const category = CATEGORIES.find((item) => item.key === article.category);
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-6 block overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] transition-colors hover:border-white/[0.16] hover:bg-white/[0.055]"
    >
      <div className="grid min-h-[280px] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative min-h-56 overflow-hidden bg-white/[0.035]">
          {article.thumbnail ? (
            <img
              src={article.thumbnail}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <NewsVisualFallback category={category} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4">
            <CategoryBadge category={article.category} />
          </div>
        </div>
        <div className="flex flex-col justify-center p-5 md:p-7">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-white/38">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo(article.published_at)}
            </span>
            <span>{article.publisher || "Unknown source"}</span>
            <ExternalLink className="ml-auto size-4 text-white/25 transition-colors group-hover:text-white/60" />
          </div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl">{article.title}</h2>
          {article.summary && (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/52">{article.summary}</p>
          )}
          <TickerRow tickers={article.tickers} />
        </div>
      </div>
    </a>
  );
}

function NewsArticleCard({ article }: { article: NewsArticle }) {
  const category = CATEGORIES.find((item) => item.key === article.category);
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] transition-colors hover:border-white/[0.16] hover:bg-white/[0.055]"
    >
      <div className="relative h-40 overflow-hidden bg-white/[0.035]">
        {article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <NewsVisualFallback category={category} compact />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/78 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          <CategoryBadge category={article.category} small />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-3 text-sm font-semibold leading-6 text-white/88 group-hover:text-white">{article.title}</h3>
        {article.summary && (
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/42">{article.summary}</p>
        )}
        <div className="mt-auto pt-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] text-white/30">
            <span className="truncate">{article.publisher || "Unknown source"}</span>
            <span>·</span>
            <span className="shrink-0">{timeAgo(article.published_at)}</span>
            <ExternalLink className="ml-auto size-3.5 text-white/22 transition-colors group-hover:text-white/55" />
          </div>
          <TickerRow tickers={article.tickers.slice(0, 3)} compact />
        </div>
      </div>
    </a>
  );
}

function NewsVisualFallback({ category, compact = false }: { category?: CategoryDef; compact?: boolean }) {
  const Icon = category?.icon ?? Newspaper;
  return (
    <div className={cn("flex h-full w-full items-center justify-center", category?.iconTone ?? "border-white/[0.10] bg-white/[0.05] text-white/45")}>
      <div className={cn("flex items-center justify-center rounded-xl border bg-black/20", compact ? "size-14" : "size-20", category?.pill ?? "border-white/[0.10] text-white/50")}>
        <Icon className={compact ? "size-7" : "size-10"} />
      </div>
    </div>
  );
}

function TickerRow({ tickers, compact = false }: { tickers: string[]; compact?: boolean }) {
  if (tickers.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-0" : "mt-5")}>
      {tickers.slice(0, compact ? 3 : 5).map((ticker) => (
        <span key={ticker} className="rounded-md border border-white/[0.10] bg-black/24 px-2 py-1 font-mono text-xs text-indigo-100">
          {ticker}
        </span>
      ))}
    </div>
  );
}

function CategoryBadge({ category, small = false }: { category: string; small?: boolean }) {
  const definition = CATEGORIES.find((item) => item.key === category);
  if (!definition) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full border font-semibold", small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs", definition.pill)}>
      {definition.label}
    </span>
  );
}

function BriefingTab({ cards }: { cards: NewsBriefCard[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map((card) => (
        <article key={card.id} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SentimentBadge sentiment={card.sentiment} />
            <ScorePill label="Impact" value={card.impact_score} />
            <ScorePill label="Confidence" value={card.confidence} />
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-white/35">
              <Clock className="size-3" />
              {timeAgo(card.published_at)}
            </span>
          </div>

          <h2 className="text-lg font-semibold leading-snug text-white">{card.headline}</h2>
          <p className="mt-3 text-sm leading-6 text-white/58">{card.summary}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EvidenceBlock title="Why it matters" icon={<LineChart className="size-4" />}>
              <p>{card.why_it_matters}</p>
            </EvidenceBlock>
            <EvidenceBlock title="Risk flags" icon={<ShieldAlert className="size-4" />}>
              <ul className="space-y-1.5">
                {card.risk_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </EvidenceBlock>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {card.tickers.map((ticker) => (
              <span key={ticker} className="rounded-md border border-white/[0.10] bg-black/20 px-2 py-1 font-mono text-xs text-indigo-200">{ticker}</span>
            ))}
            {card.categories.map((category) => (
              <span key={category} className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-xs text-white/50">{category}</span>
            ))}
          </div>

          <SourceList sources={card.sources} />
        </article>
      ))}
    </div>
  );
}

function PicksTab({ picks, onViewReports }: { picks: TodayPickCard[]; onViewReports: () => void }) {
  if (picks.length === 0) {
    return (
      <EmptyPanel icon={<Target className="size-10" />} message="No ticker-level research opportunities were identified from the current source set." />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {picks.map((pick) => (
        <article key={pick.id} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-2xl font-semibold text-white">{pick.ticker}</h2>
                <span className="rounded-md border border-indigo-300/25 bg-indigo-300/10 px-2 py-1 text-xs font-semibold text-indigo-100">{pick.label}</span>
              </div>
              <p className="mt-1 text-sm text-white/38">{pick.company_name ?? "Company name unavailable"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/30">Quote</p>
              <p className="mt-1 text-sm text-white/55">
                {pick.current_price == null ? "Unavailable" : `$${pick.current_price.toFixed(2)}`}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Opportunity" value={pct(pick.opportunity_score)} />
            <Metric label="Confidence" value={pct(pick.confidence)} />
            <Metric label="Risk" value={pick.risk_level} tone={riskTone(pick.risk_level)} />
          </div>

          <p className="mt-4 text-sm leading-6 text-white/62">{pick.thesis}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <EvidenceBlock title="Key evidence" icon={<BookOpenText className="size-4" />}>
              <ul className="space-y-1.5">
                {pick.key_evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </EvidenceBlock>
            <EvidenceBlock title="Risk flags" icon={<AlertTriangle className="size-4" />}>
              <ul className="space-y-1.5">
                {pick.risk_flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </EvidenceBlock>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-xs text-white/35">{pick.related_news_count} related source item(s)</span>
            <button
              type="button"
              onClick={onViewReports}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.05] px-3 text-sm font-semibold text-white/68 hover:bg-white/[0.09] hover:text-white"
            >
              View report
              <FileText className="size-4" />
            </button>
            <Link
              href={`/research?ticker=${encodeURIComponent(pick.ticker)}&source=research`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-[#050507] hover:bg-white/88"
            >
              Open analysis
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportsTab({ reports }: { reports: ResearchReport[] }) {
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const [activeReportId, setActiveReportId] = useState(reports[0]?.id ?? "");

  useEffect(() => {
    setActiveReportId(reports[0]?.id ?? "");
  }, [reports]);

  if (reports.length === 0) {
    return (
      <EmptyPanel icon={<FileText className="size-10" />} message="No memo-style reports are available yet. Refresh the workspace or choose themes with ticker-level sources." />
    );
  }

  return (
    <div className="relative">
      <ReportTickerRail reports={reports} activeReportId={activeReportId} onNavigate={setActiveReportId} />
      <div className="space-y-5">
        {reports.map((report) => (
          <article
            id={report.id}
            key={report.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedReport(report)}
            onMouseEnter={() => setActiveReportId(report.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedReport(report);
              }
            }}
            className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.035] p-5 transition-colors hover:border-white/[0.16] hover:bg-white/[0.052] lg:p-6"
          >
            <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/32">Editorial research memo</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">{report.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">{report.executive_summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.affected_tickers.map((ticker) => (
                  <span key={ticker} className="rounded-md border border-white/[0.10] bg-black/25 px-2 py-1 font-mono text-xs text-indigo-200">{ticker}</span>
                ))}
              </div>
            </div>

            <ReportVisual report={report} />

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Signal summary</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(report.signal_summary).map(([key, value]) => (
                  <SignalSummaryChip key={key} label={key.replaceAll("_", " ")} value={String(value)} />
                ))}
              </div>
            </div>

            <div onClick={(event) => event.stopPropagation()}>
              <SourceList sources={report.sources} />
            </div>

            <p className="mt-5 border-t border-white/[0.08] pt-4 text-xs leading-5 text-white/35">{report.disclaimer}</p>
          </article>
        ))}
      </div>

      <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}

function ReportTickerRail({
  reports,
  activeReportId,
  onNavigate,
}: {
  reports: ResearchReport[];
  activeReportId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="group fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
      <div className="rounded-2xl border border-transparent bg-transparent p-2 transition-all duration-200 group-hover:border-white/[0.10] group-hover:bg-[#151517]/95 group-hover:shadow-2xl group-hover:shadow-black/35">
        <div className="flex w-8 flex-col items-center gap-2 py-1 transition-all duration-200 group-hover:w-32 group-hover:items-stretch">
          {reports.map((report) => {
            const ticker = report.affected_tickers[0] ?? "Memo";
            const active = report.id === activeReportId;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => {
                  onNavigate(report.id);
                  document.getElementById(report.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex h-6 w-full items-center gap-3 rounded-md px-1 text-left transition-colors hover:bg-white/[0.06]"
                aria-label={`Jump to ${ticker} report`}
              >
                <span
                  className={cn(
                    "h-1 w-7 shrink-0 rounded-full transition-all duration-200",
                    active ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.65)]" : "bg-white/30 group-hover:bg-white/45"
                  )}
                />
                <span className="hidden min-w-0 flex-1 overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:block group-hover:opacity-100">
                  <span className={cn("font-mono text-sm font-semibold", active ? "text-white" : "text-white/68")}>{ticker}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportModal({ report, onClose }: { report: ResearchReport | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {report && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.article
            role="dialog"
            aria-modal="true"
            aria-label={report.title}
            className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#f5f2ea] text-[#17151c] shadow-2xl shadow-black/45"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-[#f5f2ea]/92 px-6 py-4 backdrop-blur-md sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5f5867]">Market Intelligence Memo</p>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-black/10 text-[#17151c]/60 transition-colors hover:bg-black/[0.06] hover:text-[#17151c]"
                aria-label="Close report"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <header className="border-b border-black/10 pb-8">
                <div className="mb-5 flex flex-wrap gap-2">
                  {report.affected_tickers.map((ticker) => (
                    <span key={ticker} className="rounded-full border border-[#6d5dfc]/25 bg-[#6d5dfc]/10 px-3 py-1 font-mono text-xs font-semibold text-[#3b2db4]">
                      {ticker}
                    </span>
                  ))}
                </div>
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#17151c] sm:text-5xl">{report.title}</h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4c4653]">{report.executive_summary}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#77707c]">
                  <span>{report.created_at ? new Date(report.created_at).toLocaleDateString() : "Date unavailable"}</span>
                  <span>{report.sources.length} source{report.sources.length === 1 ? "" : "s"}</span>
                  <span>{signalText(report.signal_summary.label, "Research memo")}</span>
                </div>
              </header>

              <div className="grid gap-8 py-8 lg:grid-cols-[1fr_260px]">
                <div className="space-y-8">
                  <MemoSection title="What happened" body={report.sections.what_happened} />
                  <MemoSection title="Why it matters" body={report.sections.why_it_matters} />
                  <MemoListSection title="Bull case" items={report.bull_case} />
                  <MemoListSection title="Bear case" items={report.bear_case} />
                  <MemoListSection title="Risk flags" items={report.risk_flags} />
                  <MemoListSection title="What to watch next" items={report.what_to_watch_next} />
                </div>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-black/10 bg-white/55 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#77707c]">Signal summary</p>
                    <div className="space-y-2">
                      {Object.entries(report.signal_summary).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3 border-b border-black/[0.07] py-2 last:border-b-0">
                          <span className="text-xs capitalize text-[#5f5867]">{key.replaceAll("_", " ")}</span>
                          <span className="font-mono text-sm font-semibold capitalize text-[#3b2db4]">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/55 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#77707c]">Sources</p>
                    <div className="space-y-3">
                      {report.sources.map((source, index) => (
                        source.url ? (
                          <a
                            key={`${source.url}-${index}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl border border-black/[0.07] bg-white/55 p-3 text-sm leading-5 text-[#403a46] transition-colors hover:bg-white"
                          >
                            <span className="font-medium">{source.title}</span>
                            <span className="mt-1 block text-xs text-[#77707c]">{source.publisher ?? "Unknown publisher"}</span>
                          </a>
                        ) : (
                          <div key={`${source.title}-${index}`} className="rounded-xl border border-black/[0.07] bg-white/55 p-3 text-sm leading-5 text-[#403a46]">
                            <span className="font-medium">{source.title}</span>
                            <span className="mt-1 block text-xs text-[#77707c]">{source.publisher ?? "Unknown publisher"}</span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </aside>
              </div>

              <footer className="border-t border-black/10 pt-6">
                <h2 className="text-xl font-semibold text-[#17151c]">Disclaimer</h2>
                <p className="mt-3 text-sm leading-7 text-[#5f5867]">{report.disclaimer}</p>
              </footer>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MemoSection({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-[#17151c]">{title}</h2>
      <p className="mt-3 text-base leading-8 text-[#403a46]">{body}</p>
    </section>
  );
}

function MemoListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-[#17151c]">{title}</h2>
      <ul className="mt-4 space-y-3 text-base leading-7 text-[#403a46]">
        {items.map((item) => (
          <li key={item} className="border-l-2 border-[#6d5dfc]/35 pl-4">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignalSummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-xs capitalize text-white/42">
      {label}: <span className="font-mono font-semibold text-white">{value}</span>
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: NewsBriefCard["sentiment"] }) {
  const styles = {
    bullish: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    neutral: "border-white/[0.10] bg-white/[0.05] text-white/62",
    bearish: "border-red-300/25 bg-red-300/10 text-red-100",
  };
  return <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold capitalize", styles[sentiment])}>{sentiment}</span>;
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-xs font-semibold text-white/45">
      {label}: <span className="font-mono text-white">{pct(value)}</span>
    </span>
  );
}

function EvidenceBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/18 p-4 text-sm leading-6 text-white/52">
      <p className="news-section-heading mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function ReportVisual({ report }: { report: ResearchReport }) {
  const label = signalText(report.signal_summary.label, "Research memo");
  const riskLevel = signalText(report.signal_summary.risk_level, "medium");
  const opportunity = signalNumber(report.signal_summary.opportunity_score, 0);
  const confidence = signalNumber(report.signal_summary.confidence, 0);
  const sourceCount = signalNumber(report.signal_summary.related_news_count, report.sources.length);
  const ticker = report.affected_tickers[0] ?? "N/A";
  const tone = riskTone(riskLevel);

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#090a0e]">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className="relative min-h-44 border-b border-white/[0.08] bg-white/[0.025] p-5 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative flex h-full flex-col justify-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-indigo-300/24 bg-indigo-300/[0.10] font-mono text-2xl font-semibold text-indigo-100">
                  {ticker.slice(0, 4)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{ticker}</p>
                  <p className="mt-1 text-xs text-white/42">{label}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <VisualStat label="Risk" value={riskLevel} tone={tone} />
              <VisualStat label="Sources" value={String(sourceCount)} />
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SignalBar label="Opportunity score" value={opportunity} tone="indigo" />
            <SignalBar label="Confidence" value={confidence} tone="emerald" />
          </div>
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/18 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="news-section-heading text-sm font-semibold">Evidence balance</p>
              <span className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-xs text-white/48">
                {report.sources.length} linked source{report.sources.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <VisualStat label="Bull case" value={String(report.bull_case.length)} />
              <VisualStat label="Bear case" value={String(report.bear_case.length)} />
              <VisualStat label="Risk flags" value={String(report.risk_flags.length)} tone={report.risk_flags.length > 2 ? "danger" : "base"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalBar({ label, value, tone }: { label: string; value: number; tone: "indigo" | "emerald" }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/18 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/78">{label}</p>
        <p className="font-mono text-sm font-semibold text-white">{pct(width)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn("h-full rounded-full", tone === "indigo" ? "bg-indigo-300" : "bg-emerald-300")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function VisualStat({ label, value, tone = "base" }: { label: string; value: string; tone?: RiskTone }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold capitalize", riskToneClass(tone))}>{value}</p>
    </div>
  );
}

function signalNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function signalText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function Metric({ label, value, tone = "base" }: { label: string; value: string; tone?: RiskTone }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/18 p-3">
      <p className="text-xs text-white/35">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold capitalize", tone === "base" ? "text-white" : riskToneClass(tone))}>{value}</p>
    </div>
  );
}

function SourceList({ sources }: { sources: { title: string; url: string | null; publisher: string | null; published_at: string | null }[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-5 border-t border-white/[0.08] pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/30">Sources</p>
      <div className="space-y-2">
        {sources.map((source, index) => {
          const content = (
            <>
              <span className="min-w-0 flex-1 truncate">{source.title}</span>
              <span className="hidden shrink-0 text-white/28 sm:inline">{source.publisher ?? "Unknown"}</span>
              <ExternalLink className="size-3.5 shrink-0 text-white/25" />
            </>
          );
          const className = "flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-white/48 hover:bg-white/[0.05] hover:text-white";
          return source.url ? (
            <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noopener noreferrer" className={className}>
              {content}
            </a>
          ) : (
            <div key={`${source.title}-${index}`} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyPanel({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] text-center text-white/38">
      {icon}
      <p className="max-w-md text-sm">{message}</p>
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={null}>
      <NewsPageContent />
    </Suspense>
  );
}
