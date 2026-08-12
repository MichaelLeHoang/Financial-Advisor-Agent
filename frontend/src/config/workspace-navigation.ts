import type { Plan } from "@/components/auth/AuthProvider";

export type WorkspaceKey = "portfolio" | "invest" | "trade" | "discover" | "journal";

export interface WorkspaceNavItem {
  id: string;
  label: string;
  href: string;
  minPlan?: Plan;
  featureKey?: string;
  aliases?: string[];
}

export interface WorkspaceNavigation {
  label: string;
  items: WorkspaceNavItem[];
}

export const PRIMARY_NAVIGATION = [
  { id: "home", label: "Home", href: "/home" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "invest", label: "Invest", href: "/invest" },
  { id: "trade", label: "Trade", href: "/trade" },
  { id: "discover", label: "Discover", href: "/discover/markets" },
  { id: "journal", label: "Journal", href: "/journal" },
  { id: "ai", label: "AI Desk", href: "/ai" },
] as const;

export const WORKSPACE_NAVIGATION: Record<WorkspaceKey, WorkspaceNavigation> = {
  portfolio: {
    label: "Portfolio",
    items: [
      { id: "overview", label: "Overview", href: "/portfolio" },
      { id: "holdings", label: "Holdings", href: "/portfolio/holdings" },
      { id: "allocation", label: "Allocation", href: "/portfolio/allocation" },
      { id: "performance", label: "Performance", href: "/portfolio/performance" },
      { id: "risk", label: "Risk", href: "/portfolio/risk", minPlan: "pro", featureKey: "risk_dashboard" },
      { id: "accounts", label: "Accounts", href: "/portfolio/accounts" },
      { id: "activity", label: "Activity", href: "/portfolio/activity" },
    ],
  },
  invest: {
    label: "Invest",
    items: [
      { id: "overview", label: "Overview", href: "/invest" },
      { id: "holdings", label: "Holdings", href: "/invest/holdings", aliases: ["/invest/positions"] },
      { id: "performance", label: "Performance", href: "/invest/performance" },
      { id: "research", label: "Research", href: "/invest/research" },
      { id: "theses", label: "Theses", href: "/invest/theses" },
      { id: "strategies", label: "Strategies", href: "/invest/strategies", minPlan: "trader", featureKey: "backtesting" },
      { id: "rebalance", label: "Rebalancing", href: "/invest/rebalance", minPlan: "pro", featureKey: "classical_optimization" },
      { id: "accounts", label: "Accounts", href: "/invest/accounts" },
      { id: "activity", label: "Activity", href: "/invest/activity" },
    ],
  },
  trade: {
    label: "Trade",
    items: [
      { id: "desk", label: "Desk", href: "/trade", aliases: ["/trade/desk", "/trade/plans"] },
      { id: "strategies", label: "Strategies", href: "/trade/strategies", minPlan: "trader", featureKey: "backtesting" },
      { id: "automations", label: "Automations", href: "/trade/automations", minPlan: "trader" },
      { id: "positions", label: "Positions", href: "/trade/positions" },
      { id: "orders", label: "Orders", href: "/trade/orders" },
      { id: "performance", label: "Performance", href: "/trade/performance", minPlan: "trader" },
    ],
  },
  discover: {
    label: "Discover",
    items: [
      { id: "markets", label: "Markets", href: "/discover/markets" },
      { id: "earnings", label: "Earnings", href: "/discover/earnings" },
      { id: "watchlists", label: "Watchlists", href: "/discover/watchlists" },
      { id: "news", label: "News", href: "/discover/news" },
      { id: "picks", label: "Picks", href: "/discover/picks" },
      { id: "reports", label: "Reports", href: "/discover/reports" },
      { id: "screeners", label: "Screeners", href: "/discover/screeners", minPlan: "quant", featureKey: "signal_ranking" },
    ],
  },
  journal: {
    label: "Journal",
    items: [
      { id: "all", label: "All", href: "/journal" },
      { id: "investments", label: "Investments", href: "/journal/investments" },
      { id: "trades", label: "Trades", href: "/journal/trades", minPlan: "trader", featureKey: "trade_journal" },
      { id: "strategies", label: "Strategies", href: "/journal/strategies", minPlan: "trader" },
      { id: "agent-actions", label: "Agent Actions", href: "/journal/agent-actions", minPlan: "pro" },
    ],
  },
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  pro: 1,
  trader: 2,
  quant: 3,
  execution_addon: 4,
};

export function planAllows(current: Plan, required?: Plan) {
  return !required || PLAN_RANK[current] >= PLAN_RANK[required];
}

export function isWorkspaceItemActive(pathname: string, item: WorkspaceNavItem) {
  const candidates = [item.href, ...(item.aliases ?? [])];
  return candidates.some((candidate) => {
    if (candidate === "/portfolio" || candidate === "/invest" || candidate === "/trade" || candidate === "/journal") {
      return pathname === candidate;
    }
    return pathname === candidate || pathname.startsWith(`${candidate}/`);
  });
}
