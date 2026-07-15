import type { WorkspaceWidgetType } from "@/lib/trading/workspaceSchema";

export type WidgetRegistration = { title: string; description: string; category: "Market" | "Trading" | "Risk"; supportsSymbolLink: boolean; allowDuplicate: boolean; minSize: { width: number; height: number } };

export const workspaceWidgetRegistry: Record<WorkspaceWidgetType, WidgetRegistration> = {
  watchlist: { title: "Watchlist", description: "Select and monitor symbols in the paper workspace.", category: "Market", supportsSymbolLink: true, allowDuplicate: true, minSize: { width: 2, height: 4 } },
  active_signals: { title: "Active Signals", description: "Inspect evidence-backed setups for the linked symbol.", category: "Market", supportsSymbolLink: true, allowDuplicate: true, minSize: { width: 2, height: 3 } },
  price_chart: { title: "Price Chart", description: "Inspect price action, timeframes, and planned levels.", category: "Market", supportsSymbolLink: true, allowDuplicate: true, minSize: { width: 4, height: 5 } },
  trade_plan: { title: "Trade Plan", description: "Set trade levels and calculate position size.", category: "Trading", supportsSymbolLink: true, allowDuplicate: false, minSize: { width: 3, height: 5 } },
  trading_activity: { title: "Trading Activity", description: "Review paper positions, orders, fills, signals, and risk.", category: "Trading", supportsSymbolLink: true, allowDuplicate: false, minSize: { width: 4, height: 4 } },
  policy_check: { title: "Policy Check", description: "Understand each risk rule before paper submission.", category: "Risk", supportsSymbolLink: true, allowDuplicate: false, minSize: { width: 3, height: 4 } },
};
