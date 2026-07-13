"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import InteractiveMarketChart from "@/components/market/InteractiveMarketChart";
import { cn } from "@/lib/utils";
import type { MarketQuote, MarketQuotePoint } from "@/lib/api";

const LEGACY_PREFS_KEY = "financial-advisor.news-categories";
const PREFS_KEY_PREFIX = "financial-advisor.news-categories.";
const MAX_CATEGORIES = 3;
const TABS = ["news", "briefing", "picks", "reports"] as const;
const REPORT_CHART_RANGES = ["1M", "3M", "6M", "1Y"] as const;
const REPORT_CHART_PERIODS: Record<ReportChartRange, string> = {
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
};
const REPORT_RS_BENCHMARK = "^IXIC";
const REPORT_RS_BENCHMARK_LABEL = "Nasdaq Composite";

type IntelligenceTab = (typeof TABS)[number];
type ReportChartRange = (typeof REPORT_CHART_RANGES)[number];

type ReportChartPoint = {
  label: string;
  chartIndex: number;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume: number;
  movingAverage?: number;
  rsLine?: number;
  change?: number;
};

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
    selected: "border-sky-300/45 bg-sky-300/[0.12] text-white shadow-[0_0_0_1px_rgba(125,211,252,0.10)]",
    iconTone: "border-sky-300/26 bg-sky-300/[0.12] text-sky-200",
    pill: "border-sky-300/22 bg-sky-300/[0.10] text-sky-100",
  },
  {
    key: "technology",
    label: "Technology",
    icon: Cpu,
    accent: "hover:border-indigo-300/34 hover:bg-indigo-300/[0.08]",
    selected: "border-indigo-300/45 bg-indigo-300/[0.12] text-white shadow-[0_0_0_1px_rgba(165,180,252,0.10)]",
    iconTone: "border-indigo-300/26 bg-indigo-300/[0.12] text-indigo-200",
    pill: "border-indigo-300/22 bg-indigo-300/[0.10] text-indigo-100",
  },
  {
    key: "crypto",
    label: "Crypto",
    icon: Bitcoin,
    accent: "hover:border-amber-300/34 hover:bg-amber-300/[0.08]",
    selected: "border-amber-300/45 bg-amber-300/[0.12] text-white shadow-[0_0_0_1px_rgba(252,211,77,0.10)]",
    iconTone: "border-amber-300/26 bg-amber-300/[0.12] text-amber-200",
    pill: "border-amber-300/22 bg-amber-300/[0.10] text-amber-100",
  },
  {
    key: "energy",
    label: "Energy",
    icon: Flame,
    accent: "hover:border-orange-300/34 hover:bg-orange-300/[0.08]",
    selected: "border-orange-300/45 bg-orange-300/[0.12] text-white shadow-[0_0_0_1px_rgba(253,186,116,0.10)]",
    iconTone: "border-orange-300/26 bg-orange-300/[0.12] text-orange-200",
    pill: "border-orange-300/22 bg-orange-300/[0.10] text-orange-100",
  },
  {
    key: "healthcare",
    label: "Healthcare",
    icon: Heart,
    accent: "hover:border-emerald-300/34 hover:bg-emerald-300/[0.08]",
    selected: "border-emerald-300/45 bg-emerald-300/[0.12] text-white shadow-[0_0_0_1px_rgba(110,231,183,0.10)]",
    iconTone: "border-emerald-300/26 bg-emerald-300/[0.12] text-emerald-200",
    pill: "border-emerald-300/22 bg-emerald-300/[0.10] text-emerald-100",
  },
  {
    key: "financials",
    label: "Financials",
    icon: Building2,
    accent: "hover:border-lime-300/34 hover:bg-lime-300/[0.08]",
    selected: "border-lime-300/45 bg-lime-300/[0.12] text-white shadow-[0_0_0_1px_rgba(190,242,100,0.10)]",
    iconTone: "border-lime-300/26 bg-lime-300/[0.12] text-lime-200",
    pill: "border-lime-300/22 bg-lime-300/[0.10] text-lime-100",
  },
  {
    key: "ai_semiconductors",
    label: "AI & Semis",
    icon: Brain,
    accent: "hover:border-violet-300/34 hover:bg-violet-300/[0.08]",
    selected: "border-violet-300/45 bg-violet-300/[0.12] text-white shadow-[0_0_0_1px_rgba(196,181,253,0.10)]",
    iconTone: "border-violet-300/26 bg-violet-300/[0.12] text-violet-200",
    pill: "border-violet-300/22 bg-violet-300/[0.10] text-violet-100",
  },
  {
    key: "consumer",
    label: "Consumer",
    icon: ShoppingBag,
    accent: "hover:border-rose-300/34 hover:bg-rose-300/[0.08]",
    selected: "border-rose-300/45 bg-rose-300/[0.12] text-white shadow-[0_0_0_1px_rgba(253,164,175,0.10)]",
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

function formatAxisPrice(value: number) {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatCurrency(value: number, currency = "USD") {
  if (!Number.isFinite(value)) return "—";
  if (currency === "USD") {
    return value >= 1000 ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${value.toFixed(2)}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: value >= 1000 ? 2 : 4 })} ${currency}`;
}

function formatLargeNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function pointChange(point: MarketQuotePoint, previous?: MarketQuotePoint) {
  if (!previous?.price) return 0;
  return point.price - previous.price;
}

function movingAverage(points: MarketQuotePoint[], index: number, window = 20) {
  const slice = points.slice(Math.max(0, index - window + 1), index + 1);
  if (slice.length < Math.min(window, 5)) return undefined;
  const total = slice.reduce((sum, point) => sum + point.price, 0);
  return total / slice.length;
}

function buildReportChartData(primary: MarketQuote, benchmark?: MarketQuote | null): ReportChartPoint[] {
  const primaryHistory = primary.history.filter((point) => Number.isFinite(point.price));
  if (primaryHistory.length === 0) return [];
  const benchmarkHistory = benchmark?.history.filter((point) => Number.isFinite(point.price)) ?? [];
  const offset = Math.max(primaryHistory.length - benchmarkHistory.length, 0);
  const primaryStart = primaryHistory[0]?.price || 1;
  const benchmarkStart = benchmarkHistory[0]?.price || 1;

  return primaryHistory.map((point, index) => {
    const benchmarkPoint = benchmarkHistory[index - offset];
    const primaryPerformance = primaryStart ? point.price / primaryStart : 1;
    const benchmarkPerformance = benchmarkPoint?.price && benchmarkStart ? benchmarkPoint.price / benchmarkStart : null;
    const rsLine = benchmarkPerformance ? (primaryPerformance / benchmarkPerformance) * 100 : undefined;

    return {
      label: point.label,
      chartIndex: index,
      price: point.price,
      open: typeof point.open === "number" ? point.open : point.price,
      high: typeof point.high === "number" ? point.high : Math.max(point.open ?? point.price, point.price),
      low: typeof point.low === "number" ? point.low : Math.min(point.open ?? point.price, point.price),
      volume: point.volume,
      movingAverage: movingAverage(primaryHistory, index),
      rsLine,
      change: pointChange(point, primaryHistory[index - 1]),
    };
  });
}

function compactReportChartData(data: ReportChartPoint[], range: ReportChartRange) {
  const visibleCount = range === "1M" ? 24 : range === "3M" ? 66 : range === "6M" ? 132 : 252;
  return data.slice(-visibleCount);
}

function quoteSourceLabel(quote: MarketQuote | null) {
  const sources = quote?.data_sources?.filter(Boolean);
  if (!sources || sources.length === 0) return "Quanfora market data";
  return sources.map((source) => source.replaceAll("_", " ")).join(" · ");
}

function isReportTickerChartable(ticker: string | undefined) {
  if (!ticker) return false;
  const normalized = ticker.trim().toUpperCase();
  return normalized.length > 0 && normalized !== "N/A" && normalized !== "UNKNOWN";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isSignedIn = !authLoading && !user?.is_guest;
  const embedded = pathname.startsWith("/discover/");
  const routeTab: IntelligenceTab | null = pathname === "/discover/picks" ? "picks" : pathname === "/discover/reports" ? "reports" : null;
  const activeTab = routeTab ?? sanitizeTab(searchParams.get("tab"));
  const [selected, setSelected] = useState<string[]>([]);
  const [hasSetPrefs, setHasSetPrefs] = useState(false);
  const [rawNews, setRawNews] = useState<NewsResponse | null>(null);
  const [workspace, setWorkspace] = useState<MarketIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [authLoading, isSignedIn, pathname, router]);

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
    router.replace(embedded ? "/discover/news" : "/news", { scroll: false });
  };

  const setTab = (tab: IntelligenceTab) => {
    if (embedded) {
      const destination = tab === "picks" ? "/discover/picks" : tab === "reports" ? "/discover/reports" : tab === "briefing" ? "/discover/news?tab=briefing" : "/discover/news";
      router.replace(destination, { scroll: false });
      return;
    }
    router.replace(`/news?tab=${tab}`, { scroll: false });
  };

  const selectedLabels = useMemo(
    () => selected.map((key) => CATEGORIES.find((category) => category.key === key)).filter((category): category is CategoryDef => Boolean(category)),
    [selected]
  );

  return (
    <main className="news-page min-h-screen">
      {!embedded && <IntroductionNav />}

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
              <p className="news-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
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
                className="news-action inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                Refresh
              </button>
              <button
                type="button"
                onClick={resetPrefs}
                className="news-action inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold transition-colors"
              >
                Change topics
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {selectedLabels.map((category) => (
              <span key={category.key} className={cn("news-topic-pill inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", category.pill)}>
                {category.label}
              </span>
            ))}
          </div>

          <div className="news-divider mb-6 flex flex-wrap gap-2 border-b pb-3">
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
            <div className="news-card flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl border">
              <Loader2 className="size-8 animate-spin text-indigo-300" />
              <p className="text-sm text-white/45">Building the intelligence brief...</p>
            </div>
          )}

          {!loading && activeTab === "news" && rawNews && rawNews.articles.length === 0 && (
            <div className="news-card flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border text-center">
              <Newspaper className="size-10 text-white/20" />
              <p className="max-w-md text-sm text-white/42">
                No source articles were returned. Refresh again or choose a different market mix.
              </p>
            </div>
          )}

          {!loading && activeTab !== "news" && workspace && workspace.briefing.length === 0 && (
            <div className="news-card flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border text-center">
              <Newspaper className="size-10 text-white/20" />
              <p className="max-w-md text-sm text-white/42">
                No intelligence cards were generated from this source set. Refresh again or choose a different market mix.
              </p>
            </div>
          )}

          <div key={activeTab}>
              {activeTab === "news" && rawNews && rawNews.articles.length > 0 && (
                <NewsTab articles={rawNews.articles} />
              )}

              {activeTab !== "news" && workspace && workspace.briefing.length > 0 && (
                <>
                  {activeTab === "briefing" && <BriefingTab cards={workspace.briefing} />}
                  {activeTab === "picks" && (
                    <PicksTab
                      picks={workspace.picks}
                      reports={workspace.reports}
                      onViewReport={(reportId) => {
                        setTab("reports");
                        window.requestAnimationFrame(() => {
                          document.getElementById(reportId)?.scrollIntoView({ behavior: "auto", block: "start" });
                        });
                      }}
                    />
                  )}
                  {activeTab === "reports" && <ReportsTab reports={workspace.reports} />}
                </>
              )}
          </div>
        </section>
      )}

      {isSignedIn && !embedded && <IntroductionFooter />}
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
        transition={{ duration: 0.22 }}
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
                    ? "news-card cursor-not-allowed text-white/28 opacity-45"
                    : cn("news-card text-white/62 hover:text-white", category.accent)
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
        active ? "news-tab-active" : "news-tab-muted"
      )}
    >
      {icon}
      {label}
      <span className="news-tab-track absolute bottom-0 left-2 right-2 h-px" />
      <motion.span
        className={cn("news-tab-underline absolute bottom-0 left-2 right-2 h-[2px] rounded-full", active ? "news-tab-underline-active" : "news-tab-underline-hover")}
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
      className="news-card group mb-6 block overflow-hidden rounded-xl border transition-colors"
    >
      <div className="grid min-h-[280px] md:grid-cols-[0.9fr_1.1fr]">
        <div className="news-media relative min-h-56 overflow-hidden">
          {article.thumbnail ? (
            <img
              src={article.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <NewsVisualFallback category={category} />
          )}
          <div className="news-image-shade absolute inset-0" />
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
      className="news-card group flex min-h-[360px] flex-col overflow-hidden rounded-xl border transition-colors"
    >
      <div className="news-media relative h-40 overflow-hidden">
        {article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <NewsVisualFallback category={category} compact />
        )}
        <div className="news-image-shade absolute inset-0" />
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
      <div className={cn("news-chip flex items-center justify-center rounded-xl border", compact ? "size-14" : "size-20", category?.pill ?? "border-white/[0.10] text-white/50")}>
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
        <span key={ticker} className="news-ticker rounded-md border px-2 py-1 font-mono text-xs text-indigo-100">
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
    <span className={cn("news-category-badge inline-flex items-center rounded-full border font-semibold", small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs", definition.pill)}>
      {definition.label}
    </span>
  );
}

function BriefingTab({ cards }: { cards: NewsBriefCard[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cards.map((card) => (
        <article key={card.id} className="news-card rounded-xl border p-5">
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
              <span key={ticker} className="news-ticker rounded-md border px-2 py-1 font-mono text-xs text-indigo-200">{ticker}</span>
            ))}
            {card.categories.map((category) => (
              <span key={category} className="news-chip rounded-md border px-2 py-1 text-xs text-white/50">{category}</span>
            ))}
          </div>

          <SourceList sources={card.sources} />
        </article>
      ))}
    </div>
  );
}

function PicksTab({
  picks,
  reports,
  onViewReport,
}: {
  picks: TodayPickCard[];
  reports: ResearchReport[];
  onViewReport: (reportId: string) => void;
}) {
  if (picks.length === 0) {
    return (
      <EmptyPanel icon={<Target className="size-10" />} message="No ticker-level research opportunities were identified from the current source set." />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {picks.map((pick) => {
        const report = findReportForPick(pick, reports);
        const companyName = displayCompanyName(pick);
        const mainRisk = pick.risk_flags.find((flag) => !isContradictorySourceRisk(flag, pick.related_news_count)) ?? "Reject the setup if follow-up news or price action fails to confirm the catalyst.";
        const evidence = compactEvidence(pick);

        return (
          <article key={pick.id} className="news-card flex min-h-[430px] flex-col rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-xl font-semibold text-white">{pick.ticker}</h2>
                  <span className="news-pick-label rounded-md border px-2 py-1 text-[11px] font-semibold">{pick.label}</span>
                </div>
                <p className="mt-1 truncate text-xs text-white/42">{companyName}</p>
                {pick.current_price != null && (
                  <p className={cn("mt-2 text-xs font-semibold", (pick.daily_change_pct ?? 0) >= 0 ? "text-emerald-200" : "text-red-200")}>
                    ${pick.current_price.toFixed(2)}
                    {pick.daily_change_pct != null && <span className="ml-2">{pick.daily_change_pct >= 0 ? "+" : ""}{pick.daily_change_pct.toFixed(2)}%</span>}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">Pick score</p>
                <p className="mt-1 font-mono text-3xl font-semibold text-white">{pct(pick.opportunity_score)}</p>
              </div>
            </div>

            <p className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 text-sm leading-6 text-white/68">
              {pick.thesis}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <PickMetric label="Pick score" value={pct(pick.opportunity_score)} />
              <PickMetric label="Confidence" value={pct(pick.confidence)} />
              <PickMetric label="Risk" value={pick.risk_level} tone={riskTone(pick.risk_level)} />
            </div>

            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="news-section-heading text-xs font-semibold uppercase tracking-[0.14em]">Score drivers</p>
                <span className="text-[11px] text-white/34">Not a price forecast</span>
              </div>
              <div className="space-y-1.5">
                {pickDriverRows(pick).map((driver) => (
                  <ScoreDriverRow key={driver.label} {...driver} />
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              <EvidenceBlock title="Evidence" icon={<BookOpenText className="size-4" />}>
                <ul className="list-disc space-y-1.5 pl-4 marker:text-indigo-200/70">
                  {evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </EvidenceBlock>
              <EvidenceBlock title="Main risk" icon={<AlertTriangle className="size-4" />}>
                <p>{mainRisk}</p>
              </EvidenceBlock>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-white/34">
              Pick score ranks review urgency from news, sentiment, relevance, market confirmation, source quality, and risk.
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              <span className="news-chip rounded-md border px-2 py-1 text-xs text-white/42">
                {pick.related_news_count} related source{pick.related_news_count === 1 ? "" : "s"}
              </span>
              {report && (
                <button
                  type="button"
                  onClick={() => onViewReport(report.id)}
                  className="news-action ml-auto inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"
                >
                  View report
                  <FileText className="size-4" />
                </button>
              )}
              <Link
                href={`/research?ticker=${encodeURIComponent(pick.ticker)}&source=research&report_type=investment`}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-[#050507] transition-colors hover:bg-white/88"
              >
                Open analysis
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ReportsTab({ reports }: { reports: ResearchReport[] }) {
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const [activeReportId, setActiveReportId] = useState(reports[0]?.id ?? "");

  useEffect(() => {
    setActiveReportId(reports[0]?.id ?? "");
  }, [reports]);

  useEffect(() => {
    if (reports.length === 0) return;

    let frame = 0;

    const updateActiveReport = () => {
      frame = 0;
      const targetY = window.innerHeight * 0.34;
      const closest = reports.reduce<{ id: string; distance: number } | null>((best, report) => {
        const element = document.getElementById(report.id);
        if (!element) return best;
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - targetY);
        if (!best || distance < best.distance) return { id: report.id, distance };
        return best;
      }, null);

      if (closest) setActiveReportId(closest.id);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveReport);
    };

    updateActiveReport();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
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
            className="news-card cursor-pointer rounded-xl border p-5 transition-colors lg:p-6"
          >
            <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/32">Editorial research memo</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">{report.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">{report.executive_summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.affected_tickers.map((ticker) => (
                  <span key={ticker} className="news-ticker rounded-md border px-2 py-1 font-mono text-xs text-indigo-200">{ticker}</span>
                ))}
              </div>
            </div>

            <ReportVisual report={report} />

            <div className="news-subpanel mt-5 rounded-xl border p-4">
              <p className="text-sm font-semibold text-white">Signal summary</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(report.signal_summary).filter(([key]) => key !== "score_breakdown").map(([key, value]) => (
                  <SignalSummaryChip key={key} label={displaySignalLabel(key)} value={String(value)} />
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
      <div className="news-rail-panel rounded-2xl border border-transparent bg-transparent p-2 transition-shadow duration-[180ms] group-hover:shadow-2xl">
        <div className="flex w-8 flex-col items-center gap-2 py-1 transition-[width] duration-[180ms] group-hover:w-32 group-hover:items-stretch">
          {reports.map((report) => {
            const ticker = report.affected_tickers[0] ?? "Memo";
            const active = report.id === activeReportId;
            return (
              <button
                key={report.id}
                type="button"
                onClick={(event) => {
                  onNavigate(report.id);
                  document.getElementById(report.id)?.scrollIntoView({ behavior: event.detail === 0 ? "auto" : "smooth", block: "start" });
                }}
                className="news-rail-item flex h-6 w-full items-center gap-3 rounded-md px-1 text-left transition-colors"
                aria-label={`Jump to ${ticker} report`}
              >
                <span
                  className={cn(
                    "h-1 w-7 shrink-0 rounded-full transition-[background-color,box-shadow] duration-150",
                    active ? "news-rail-line-active shadow-[0_0_10px_rgba(255,255,255,0.65)]" : "news-rail-line"
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

function ReportMarketChart({ report }: { report: ResearchReport }) {
  const ticker = report.affected_tickers.find(isReportTickerChartable)?.toUpperCase();
  const [range, setRange] = useState<ReportChartRange>("6M");
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [benchmark, setBenchmark] = useState<MarketQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<ReportChartPoint | null>(null);

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHoverPoint(null);

    Promise.allSettled([
      api.marketQuote(ticker, REPORT_CHART_PERIODS[range], "1d"),
      api.marketQuote(REPORT_RS_BENCHMARK, REPORT_CHART_PERIODS[range], "1d"),
    ])
      .then(([primaryResult, benchmarkResult]) => {
        if (cancelled) return;

        if (primaryResult.status !== "fulfilled") {
          setQuote(null);
          setBenchmark(null);
          setError(`No chart data is available for ${ticker}.`);
          return;
        }

        setQuote(primaryResult.value);
        setBenchmark(benchmarkResult.status === "fulfilled" ? benchmarkResult.value : null);
      })
      .catch(() => {
        if (!cancelled) setError(`No chart data is available for ${ticker}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, ticker]);

  const chartData = useMemo(() => {
    if (!quote) return [];
    return compactReportChartData(buildReportChartData(quote, benchmark), range);
  }, [benchmark, quote, range]);
  const requestLongerRange = useCallback(() => {
    const currentIndex = REPORT_CHART_RANGES.indexOf(range);
    const nextRange = REPORT_CHART_RANGES[currentIndex + 1];
    if (nextRange) setRange(nextRange);
  }, [range]);

  if (!ticker) return null;

  const activePoint = hoverPoint ?? chartData[chartData.length - 1] ?? null;
  const change = activePoint?.change ?? quote?.change ?? 0;
  const changeColor = change >= 0 ? "text-emerald-700" : "text-red-700";
  const currency = quote?.currency ?? "USD";
  const lastUpdated = activePoint?.label ?? chartData[chartData.length - 1]?.label ?? "Unavailable";

  return (
    <section className="report-market-chart mt-8 rounded-3xl border border-black/10 bg-white/45 p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.65)] sm:p-5">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#77707c]">Interactive market chart</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-mono text-2xl font-semibold tracking-tight text-[#17151c]">{ticker}</h2>
            {activePoint && (
              <>
                <span className="text-xl font-semibold text-[#2f2a35]">{formatCurrency(activePoint.price, currency)}</span>
                <span className={cn("font-mono text-sm font-semibold", changeColor)}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#5f5867]">
            Candles, volume, 20-session average, and RS line versus {REPORT_RS_BENCHMARK_LABEL}. Hover the chart to inspect each session.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORT_CHART_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                item === range
                  ? "border-[#3b2db4]/30 bg-[#6d5dfc]/14 text-[#3b2db4]"
                  : "border-black/10 bg-white/45 text-[#5f5867] hover:border-[#6d5dfc]/30 hover:text-[#3b2db4]"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[340px] rounded-2xl border border-black/[0.08] bg-[#fbfaf6] p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#77707c]">
            <Loader2 className="size-4 animate-spin" />
            Loading chart data...
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-[#77707c]">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[#77707c]">No chart history returned for this report ticker.</div>
        ) : (
          <InteractiveMarketChart
            data={chartData}
            mode="candle"
            color="#2563eb"
            positiveColor="#2563eb"
            negativeColor="#db2777"
            overlayLines={[
              { key: "movingAverage", color: "#ef4444", lineWidth: 2 },
              { key: "rsLine", color: "#1d4ed8", priceScaleId: "left", lineWidth: 2 },
            ]}
            axisFormatter={formatAxisPrice}
            timeFormatter={formatReportChartLabel}
            rangeKey={range}
            onRequestLongerRange={requestLongerRange}
            onHover={(point) => setHoverPoint(point)}
            tooltip={(point) => <ReportChartTooltip active payload={[{ payload: point }]} ticker={ticker} currency={currency} />}
            tooltipClassName="[&>div]:bg-[#fbfaf6]/95"
          />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-[#77707c] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#2563eb]" /> Price</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ef4444]" /> 20-session avg</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1d4ed8]" /> RS vs {REPORT_RS_BENCHMARK}</span>
        </div>
        <span>Provided by {quoteSourceLabel(quote)} · Last point: {lastUpdated}</span>
      </div>
    </section>
  );
}

function ReportChartTooltip({
  active,
  payload,
  ticker,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ReportChartPoint }>;
  ticker: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-56 rounded-xl border border-black/10 bg-[#fbfaf6]/95 px-3 py-2 text-xs shadow-xl shadow-black/15 backdrop-blur-md">
      <p className="font-semibold text-[#17151c]">{point.label}</p>
      <div className="mt-2 space-y-1.5 text-[#5f5867]">
        <TooltipRow label={`${ticker} close`} value={formatCurrency(point.price, currency)} strong />
        <TooltipRow label="High" value={formatCurrency(point.high ?? point.price, currency)} />
        <TooltipRow label="Low" value={formatCurrency(point.low ?? point.price, currency)} />
        <TooltipRow label="Change" value={`${(point.change ?? 0) >= 0 ? "+" : ""}${(point.change ?? 0).toFixed(2)}`} />
        <TooltipRow label="Volume" value={formatLargeNumber(point.volume)} />
        {typeof point.rsLine === "number" && <TooltipRow label="RS line" value={point.rsLine.toFixed(1)} />}
      </div>
    </div>
  );
}

function TooltipRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className={cn("font-mono tabular-nums", strong ? "font-semibold text-[#17151c]" : "text-[#403a46]")}>{value}</span>
    </div>
  );
}

function formatReportChartLabel(label: string) {
  const parsed = new Date(label);
  if (Number.isNaN(parsed.getTime())) return label;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
            className="max-h-[90dvh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#f5f2ea] text-[#17151c] shadow-2xl shadow-black/45"
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

              <ReportMarketChart report={report} />

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
                      {Object.entries(report.signal_summary).filter(([key]) => key !== "score_breakdown").map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3 border-b border-black/[0.07] py-2 last:border-b-0">
                          <span className="text-xs capitalize text-[#5f5867]">{displaySignalLabel(key)}</span>
                          <span className="font-mono text-sm font-semibold capitalize text-[#3b2db4]">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ModalScoreDrivers report={report} />

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
    <span className="news-chip rounded-md border px-2.5 py-1.5 text-xs capitalize text-white/42">
      {label}: <span className="font-mono font-semibold text-white">{value}</span>
    </span>
  );
}

function displaySignalLabel(key: string) {
  if (key === "research_priority" || key === "opportunity_score") return "Pick score";
  return key.replaceAll("_", " ");
}

function SentimentBadge({ sentiment }: { sentiment: NewsBriefCard["sentiment"] }) {
  const styles = {
    bullish: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    neutral: "news-chip text-white/62",
    bearish: "border-red-300/25 bg-red-300/10 text-red-100",
  };
  return <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold capitalize", styles[sentiment])}>{sentiment}</span>;
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="news-chip rounded-md border px-2 py-1 text-xs font-semibold text-white/45">
      {label}: <span className="font-mono text-white">{pct(value)}</span>
    </span>
  );
}

function EvidenceBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="news-subpanel rounded-xl border p-4 text-sm leading-6 text-white/52">
      <p className="news-section-heading mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function findReportForPick(pick: TodayPickCard, reports: ResearchReport[]) {
  return reports.find((report) => report.affected_tickers.some((ticker) => ticker.toUpperCase() === pick.ticker.toUpperCase()));
}

function displayCompanyName(pick: TodayPickCard) {
  const name = pick.company_name?.trim();
  return name || `${pick.ticker} research candidate`;
}

function isContradictorySourceRisk(flag: string, sourceCount: number) {
  return sourceCount > 1 && flag.toLowerCase().includes("single-source");
}

function compactEvidence(pick: TodayPickCard) {
  const items = pick.key_evidence
    .filter((item) => item.trim())
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => !isContradictorySourceRisk(item, pick.related_news_count));
  return (items.length > 0 ? items : ["Related headlines are clustered enough to justify a focused review."]).slice(0, 3);
}

function pickDriverRows(pick: TodayPickCard) {
  const breakdown = pick.score_breakdown;
  return [
    { label: "Theme relevance", value: breakdown?.relevance ?? pick.opportunity_score, tone: "indigo" as const },
    { label: "News momentum", value: breakdown?.freshness ?? pick.opportunity_score, tone: "indigo" as const },
    { label: "Sentiment", value: breakdown?.sentiment ?? pick.confidence, tone: "emerald" as const },
    { label: "Price/volume", value: breakdown?.price_volume ?? 0, tone: "emerald" as const },
    { label: "Risk penalty", value: breakdown?.risk_penalty ?? riskPenaltyFallback(pick.risk_level), tone: "danger" as const, penalty: true },
  ];
}

function reportDriverRows(report: ResearchReport) {
  const scoreBreakdown = isSignalBreakdown(report.signal_summary.score_breakdown) ? report.signal_summary.score_breakdown : null;
  if (!scoreBreakdown) return [];

  return [
    { label: "Theme relevance", value: scoreBreakdown.relevance, tone: "indigo" as const },
    { label: "News momentum", value: scoreBreakdown.freshness, tone: "indigo" as const },
    { label: "Sentiment", value: scoreBreakdown.sentiment, tone: "emerald" as const },
    { label: "Price/volume", value: scoreBreakdown.price_volume, tone: "emerald" as const },
    { label: "Risk penalty", value: scoreBreakdown.risk_penalty, tone: "danger" as const, penalty: true },
  ];
}

function riskPenaltyFallback(riskLevel: TodayPickCard["risk_level"]) {
  if (riskLevel === "critical") return 80;
  if (riskLevel === "high") return 62;
  if (riskLevel === "medium") return 34;
  return 12;
}

function PickMetric({ label, value, tone = "base" }: { label: string; value: string; tone?: RiskTone }) {
  return (
    <div className="news-subpanel rounded-lg border p-2.5">
      <p className="text-[11px] text-white/34">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold capitalize", tone === "base" ? "text-white" : riskToneClass(tone))}>{value}</p>
    </div>
  );
}

function ScoreDriverRow({
  label,
  value,
  tone,
  penalty = false,
}: {
  label: string;
  value: number;
  tone: "indigo" | "emerald" | "danger";
  penalty?: boolean;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="grid grid-cols-[112px_1fr_38px] items-center gap-2 text-[11px]">
      <span className="truncate text-white/46">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "indigo" && "bg-indigo-300",
            tone === "emerald" && "bg-emerald-300",
            tone === "danger" && "bg-red-300"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={cn("text-right font-mono", penalty ? "text-red-200" : "text-white/62")}>{pct(width)}</span>
    </div>
  );
}

function ModalScoreDrivers({ report }: { report: ResearchReport }) {
  const drivers = reportDriverRows(report);
  if (drivers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/55 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#77707c]">Score drivers</p>
      <div className="space-y-2">
        {drivers.map((driver) => (
          <ModalScoreDriverRow key={driver.label} {...driver} />
        ))}
      </div>
    </div>
  );
}

function ModalScoreDriverRow({
  label,
  value,
  tone,
  penalty = false,
}: {
  label: string;
  value: number;
  tone: "indigo" | "emerald" | "danger";
  penalty?: boolean;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="grid grid-cols-[112px_1fr_40px] items-center gap-2 text-xs">
      <span className="truncate text-[#5f5867]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "indigo" && "bg-[#6d5dfc]",
            tone === "emerald" && "bg-emerald-500",
            tone === "danger" && "bg-red-500"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={cn("text-right font-mono font-semibold", penalty ? "text-red-600" : "text-[#3b2db4]")}>{pct(width)}</span>
    </div>
  );
}

function isSignalBreakdown(value: unknown): value is {
  relevance: number;
  freshness: number;
  sentiment: number;
  price_volume: number;
  risk_penalty: number;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["relevance", "freshness", "sentiment", "price_volume", "risk_penalty"].every((key) => {
    const item = record[key];
    return typeof item === "number" && Number.isFinite(item);
  });
}

function ReportVisual({ report }: { report: ResearchReport }) {
  const label = signalText(report.signal_summary.label, "Research memo");
  const riskLevel = signalText(report.signal_summary.risk_level, "medium");
  const opportunity = signalNumber(report.signal_summary.research_priority, signalNumber(report.signal_summary.opportunity_score, 0));
  const confidence = signalNumber(report.signal_summary.confidence, 0);
  const sourceCount = signalNumber(report.signal_summary.related_news_count, report.sources.length);
  const ticker = report.affected_tickers[0] ?? "N/A";
  const tone = riskTone(riskLevel);

  return (
    <div className="news-report-visual mt-5 overflow-hidden rounded-xl border">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className="news-report-visual-side relative min-h-44 border-b p-5 lg:border-b-0 lg:border-r">
          <div className="news-grid-bg absolute inset-0 opacity-70" />
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
            <SignalBar label="Pick score" value={opportunity} tone="indigo" />
            <SignalBar label="Confidence" value={confidence} tone="emerald" />
          </div>
          <div className="news-subpanel mt-5 rounded-xl border p-4">
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
    <div className="news-subpanel rounded-xl border p-4">
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
    <div className="news-subpanel rounded-lg border p-3">
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
    <div className="news-subpanel rounded-xl border p-3">
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
          const className = "news-source-row flex items-center gap-3 rounded-lg border px-3 py-2 text-xs text-white/48";
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
    <div className="news-card flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl border text-center text-white/38">
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
