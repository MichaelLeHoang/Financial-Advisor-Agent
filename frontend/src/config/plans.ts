import type { ComponentType } from "react";
import {
  Sparkles, TrendingUp, Pin, PieChart, Brain, MessageSquare,
  Shield, Atom, FlaskConical, LineChart, BookOpen,
  BarChart3, Layers, TestTube, Signal, Download, Zap,
} from "lucide-react";

export type PlanId = "free" | "pro" | "trader" | "quant" | "execution";

export interface PlanConfig {
  id: PlanId;
  name: string;
  subtitle: string;
  priceLabel: string;
  priceNote?: string;
  description: string;
  features: string[];
  highlighted: boolean;
  ctaLabel: string;
  inviteOnly?: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    subtitle: "Research Starter",
    priceLabel: "$0",
    priceNote: "per month",
    description: "Show product value without exposing advanced trading workflows.",
    features: [
      "AI research teaser",
      "Basic market lookup",
      "1 watchlist",
      "1 portfolio",
      "Limited sentiment & news Q&A",
    ],
    highlighted: false,
    ctaLabel: "Get Started",
  },
  {
    id: "pro",
    name: "Pro",
    subtitle: "Portfolio Research",
    priceLabel: "$19",
    priceNote: "per month",
    description: "Best for long-term investors who want deeper portfolio analytics.",
    features: [
      "Extended AI usage",
      "5 portfolios",
      "50 watchlist assets",
      "Classical portfolio optimization",
      "Saved reports",
      "Basic risk dashboard",
    ],
    highlighted: false,
    ctaLabel: "Upgrade to Pro",
  },
  {
    id: "trader",
    name: "Trader",
    subtitle: "Strategy Lab",
    priceLabel: "$49",
    priceNote: "per month",
    description: "For active traders who backtest, journal, and automate alerts.",
    features: [
      "Backtesting engine",
      "Saved strategies",
      "Strategy alerts",
      "Telegram & Discord alerts",
      "Trade journal",
      "Basic ML signal ranking",
    ],
    highlighted: true,
    ctaLabel: "Upgrade to Trader",
  },
  {
    id: "quant",
    name: "Quant",
    subtitle: "Advanced AI",
    priceLabel: "$149",
    priceNote: "per month",
    description: "High-value tier for quantitative research and advanced validation.",
    features: [
      "Quantum optimization",
      "Multi-strategy comparison",
      "Monte Carlo validation",
      "Walk-forward validation",
      "Export center",
      "Premium LLM routing",
      "Bring-your-own API keys",
    ],
    highlighted: false,
    ctaLabel: "Upgrade to Quant",
  },
  {
    id: "execution",
    name: "Execution",
    subtitle: "Add-on",
    priceLabel: "$199+",
    priceNote: "invite only",
    description: "Separate tier because execution adds legal, safety, and support risk.",
    features: [
      "Paper trading",
      "Broker connection",
      "Live execution with strict risk controls",
    ],
    highlighted: false,
    ctaLabel: "Request Access",
    inviteOnly: true,
  },
];

/* ── Plan rank for gating logic ── */
const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, trader: 2, quant: 3, execution: 4 };

export function planMeetsMinimum(current: PlanId, required: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function getPlanById(id: PlanId): PlanConfig {
  return PLANS.find((p) => p.id === id)!;
}

/* ── Navigation items by plan ── */

export interface NavEntry {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  minPlan: PlanId;
}

export const ALL_NAV: NavEntry[] = [
  { href: "/dashboard", icon: Sparkles, label: "Dashboard", minPlan: "free" },
  { href: "/", icon: MessageSquare, label: "AI Advisor", minPlan: "free" },
  { href: "/market", icon: TrendingUp, label: "Market", minPlan: "free" },
  { href: "/sentiment", icon: Brain, label: "Sentiment", minPlan: "free" },
  { href: "/watchlist", icon: Pin, label: "Watchlist", minPlan: "free" },
  { href: "/portfolio", icon: PieChart, label: "Portfolio", minPlan: "free" },
  { href: "/risk", icon: Shield, label: "Risk", minPlan: "pro" },
  { href: "/reports", icon: BarChart3, label: "Reports", minPlan: "pro" },
  { href: "/backtest", icon: FlaskConical, label: "Backtest Lab", minPlan: "trader" },
  { href: "/strategies", icon: Layers, label: "Strategies", minPlan: "trader" },
  { href: "/journal", icon: BookOpen, label: "Journal", minPlan: "trader" },
  { href: "/quantum", icon: Atom, label: "Quantum", minPlan: "quant" },
  { href: "/strategy-compare", icon: LineChart, label: "Strategy Compare", minPlan: "quant" },
  { href: "/validation", icon: TestTube, label: "Validation", minPlan: "quant" },
  { href: "/signals", icon: Signal, label: "Signals", minPlan: "quant" },
  { href: "/export", icon: Download, label: "Export", minPlan: "quant" },
];

export function getNavigationForPlan(plan: PlanId): NavEntry[] {
  return ALL_NAV.filter((item) => planMeetsMinimum(plan, item.minPlan));
}

/* ── Feature comparison table ── */

export type CheckState = true | false | string; // true=✓, false=✗, string=limit label

export interface ComparisonRow {
  feature: string;
  free: CheckState;
  pro: CheckState;
  trader: CheckState;
  quant: CheckState;
  execution: CheckState;
}

export const COMPARISON_TABLE: ComparisonRow[] = [
  { feature: "AI market research",       free: "Limited", pro: true,  trader: true,  quant: true,  execution: false },
  { feature: "Watchlists",               free: "1",       pro: "10",  trader: "25",  quant: "50",  execution: false },
  { feature: "Portfolios",               free: "1",       pro: "5",   trader: "10",  quant: "25",  execution: false },
  { feature: "News / RAG Q&A",           free: "Limited", pro: true,  trader: true,  quant: true,  execution: false },
  { feature: "Classical optimization",    free: false,     pro: true,  trader: true,  quant: true,  execution: false },
  { feature: "Risk dashboard",           free: false,     pro: true,  trader: true,  quant: true,  execution: false },
  { feature: "Backtesting",              free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "Saved strategies",         free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "Strategy alerts",          free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "Telegram / Discord alerts",free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "Trade journal",            free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "ML signal ranking",        free: false,     pro: false, trader: true,  quant: true,  execution: false },
  { feature: "Quantum optimization",     free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Strategy comparison",      free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Monte Carlo validation",   free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Walk-forward validation",  free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Export center",            free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Premium LLM routing",      free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "BYO API keys",             free: false,     pro: false, trader: false, quant: true,  execution: false },
  { feature: "Paper trading",            free: false,     pro: false, trader: false, quant: false, execution: true },
  { feature: "Live execution",           free: false,     pro: false, trader: false, quant: false, execution: true },
];
