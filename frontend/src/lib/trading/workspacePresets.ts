import { WORKSPACE_LAYOUT_VERSION, uid, type TradingWorkspace, type WorkspaceWidgetType } from "./workspaceSchema.ts";

const widget = (type: WorkspaceWidgetType, x: number, y: number, width: number, height: number, linkedToWorkspaceSymbol = true, settings: Record<string, unknown> = {}) => ({ instanceId: uid(type), type, position: { x, y, width, height }, settings: type === "price_chart" ? { chartEngine: "tradingview", ...settings } : settings, linkedToWorkspaceSymbol, isVisible: true });
const customWorkspace = (name: string, widgets: TradingWorkspace["widgets"], now: string): TradingWorkspace => ({ id: uid("workspace"), name, presetType: "custom", basePresetType: "paper_trading", isDefault: false, layoutVersion: WORKSPACE_LAYOUT_VERSION, selectedSymbol: "AMD", widgets, createdAt: now, updatedAt: now });

export function createPaperTradingPreset(now = new Date().toISOString()): TradingWorkspace { return { id: "paper-trading", name: "Paper Trading Desk", presetType: "paper_trading", isDefault: true, layoutVersion: WORKSPACE_LAYOUT_VERSION, selectedSymbol: "AMD", widgets: [widget("watchlist", 0, 0, 2, 6), widget("active_signals", 0, 6, 2, 3), widget("price_chart", 2, 0, 7, 9), widget("trade_plan", 9, 0, 3, 9), widget("policy_check", 9, 9, 3, 7), widget("trading_activity", 2, 9, 7, 5)], createdAt: now, updatedAt: now }; }

export type TradingWorkspaceTemplate =
  | "paper_trading"
  | "stock_trading"
  | "options_trading"
  | "advanced_options"
  | "chart_spotlight"
  | "positions_analysis"
  | "positions_monitor"
  | "watchlist_monitor"
  | "market_monitor";

export function createWorkspaceFromTemplate(template: TradingWorkspaceTemplate, now = new Date().toISOString()): TradingWorkspace {
  if (template === "paper_trading") return createPaperTradingPreset(now);
  if (template === "stock_trading") return customWorkspace("Stock Trading", [
    widget("account", 0, 0, 3, 6, false), widget("price_chart", 3, 0, 7, 8), widget("positions", 10, 0, 2, 8),
    widget("watchlist", 0, 6, 3, 8), widget("trading_activity", 3, 8, 7, 6), widget("recent_orders", 10, 8, 2, 6),
  ], now);
  if (template === "options_trading") return customWorkspace("Options Trading", [
    widget("account", 0, 0, 3, 6, false), widget("price_chart", 3, 0, 7, 7), widget("positions", 10, 0, 2, 7),
    widget("watchlist", 0, 6, 3, 8), widget("options_chain", 3, 7, 7, 7), widget("recent_orders", 10, 7, 2, 7),
  ], now);
  if (template === "advanced_options") return customWorkspace("Advanced Options Trading", [
    widget("price_chart", 0, 0, 4, 7), widget("options_chain", 4, 0, 8, 7),
    widget("recent_orders", 0, 7, 3, 6), widget("positions", 3, 7, 5, 6), widget("account", 8, 7, 4, 6, false),
  ], now);
  if (template === "chart_spotlight") return customWorkspace("Chart Spotlight", [
    widget("price_chart", 0, 0, 9, 10), widget("watchlist", 9, 0, 3, 5), widget("active_signals", 9, 5, 3, 5),
    widget("trade_plan", 9, 10, 3, 9), widget("trading_activity", 0, 10, 9, 5), widget("policy_check", 0, 15, 9, 4),
  ], now);
  if (template === "positions_analysis") return customWorkspace("Positions Analysis", [
    widget("positions", 0, 0, 4, 12), widget("price_chart", 4, 0, 8, 9), widget("trade_plan", 4, 9, 4, 8), widget("policy_check", 8, 9, 4, 8),
  ], now);
  if (template === "positions_monitor") return customWorkspace("Positions Monitoring", [
    widget("positions", 0, 0, 3, 14),
    widget("price_chart", 3, 0, 4, 7, false, { symbol: "AMD", timeframe: "1D" }), widget("price_chart", 7, 0, 5, 7, false, { symbol: "NVDA", timeframe: "1h" }),
    widget("price_chart", 3, 7, 4, 7, false, { symbol: "AAPL", timeframe: "15m" }), widget("price_chart", 7, 7, 5, 7, false, { symbol: "AMD", timeframe: "5m" }),
  ], now);
  if (template === "watchlist_monitor") return customWorkspace("Watchlist Monitoring", [
    widget("watchlist", 0, 0, 3, 14), widget("price_chart", 3, 0, 4, 7, true, { timeframe: "1D" }), widget("price_chart", 7, 0, 5, 7, true, { timeframe: "1h" }),
    widget("price_chart", 3, 7, 4, 7, true, { timeframe: "15m" }), widget("price_chart", 7, 7, 5, 7, true, { timeframe: "5m" }),
  ], now);
  return customWorkspace("Market Monitoring", [
    widget("watchlist", 0, 0, 3, 14),
    widget("price_chart", 3, 0, 4, 7, false, { symbol: "AMD", timeframe: "1D" }), widget("price_chart", 7, 0, 5, 7, false, { symbol: "NVDA", timeframe: "1h" }),
    widget("price_chart", 3, 7, 4, 7, false, { symbol: "AAPL", timeframe: "15m" }), widget("price_chart", 7, 7, 5, 7, false, { symbol: "AMD", timeframe: "5m" }),
  ], now);
}
