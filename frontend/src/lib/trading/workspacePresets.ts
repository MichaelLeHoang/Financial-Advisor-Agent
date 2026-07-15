import { uid, type TradingWorkspace, type WorkspaceWidgetType } from "./workspaceSchema.ts";
const widget = (type: WorkspaceWidgetType, x: number, y: number, width: number, height: number, linkedToWorkspaceSymbol = true, settings: Record<string, unknown> = {}) => ({ instanceId: uid(type), type, position: { x, y, width, height }, settings, linkedToWorkspaceSymbol, isVisible: true });
export function createPaperTradingPreset(now = new Date().toISOString()): TradingWorkspace { return { id: "paper-trading", name: "Paper Trading Desk", presetType: "paper_trading", isDefault: true, layoutVersion: 1, selectedSymbol: "AMD", widgets: [widget("watchlist", 0, 0, 2, 6), widget("active_signals", 0, 6, 2, 3), widget("price_chart", 2, 0, 7, 9), widget("trade_plan", 9, 0, 3, 9), widget("policy_check", 9, 9, 3, 7), widget("trading_activity", 2, 9, 7, 5)], createdAt: now, updatedAt: now }; }

export type TradingWorkspaceTemplate = "paper_trading" | "chart_spotlight" | "market_monitor";

export function createWorkspaceFromTemplate(template: TradingWorkspaceTemplate, now = new Date().toISOString()): TradingWorkspace {
  if (template === "paper_trading") return createPaperTradingPreset(now);

  if (template === "chart_spotlight") {
    return {
      id: uid("workspace"), name: "Chart Spotlight", presetType: "custom", basePresetType: "paper_trading", isDefault: false,
      layoutVersion: 1, selectedSymbol: "AMD",
      widgets: [widget("price_chart", 0, 0, 9, 10), widget("watchlist", 9, 0, 3, 5), widget("active_signals", 9, 5, 3, 5), widget("trade_plan", 9, 10, 3, 9), widget("trading_activity", 0, 10, 9, 5), widget("policy_check", 0, 15, 9, 4)],
      createdAt: now, updatedAt: now,
    };
  }

  return {
    id: uid("workspace"), name: "Market Monitor", presetType: "custom", basePresetType: "paper_trading", isDefault: false,
    layoutVersion: 1, selectedSymbol: "AMD",
    widgets: [widget("watchlist", 0, 0, 3, 10), widget("price_chart", 3, 0, 4, 7, true, { timeframe: "1D" }), widget("price_chart", 7, 0, 5, 7, true, { timeframe: "1h" }), widget("price_chart", 3, 7, 4, 7, true, { timeframe: "15m" }), widget("price_chart", 7, 7, 5, 7, true, { timeframe: "5m" }), { ...widget("active_signals", 0, 10, 3, 4), isVisible: false }, { ...widget("trade_plan", 0, 14, 3, 9), isVisible: false }, { ...widget("policy_check", 3, 14, 4, 5), isVisible: false }, { ...widget("trading_activity", 7, 14, 5, 5), isVisible: false }],
    createdAt: now, updatedAt: now,
  };
}
