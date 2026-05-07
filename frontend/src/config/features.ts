import type { PlanId } from "@/config/plans";

export interface FeatureConfig {
  key: string;
  name: string;
  description: string;
  minPlan: PlanId;
  upgradeMessage: string;
}

export const FEATURES: Record<string, FeatureConfig> = {
  ai_research:            { key: "ai_research",            name: "AI Research",              description: "Natural-language financial research powered by LangGraph agents.",    minPlan: "free",      upgradeMessage: "Upgrade for extended AI research capabilities." },
  market_lookup:          { key: "market_lookup",          name: "Market Lookup",            description: "Real-time stock quotes, charts, and company info.",                   minPlan: "free",      upgradeMessage: "" },
  sentiment_analysis:     { key: "sentiment_analysis",     name: "Sentiment Analysis",       description: "FinBERT-powered market sentiment from news and social sources.",      minPlan: "free",      upgradeMessage: "Upgrade for full sentiment analysis." },
  news_qna:               { key: "news_qna",               name: "News Q&A",                 description: "RAG-augmented question answering over financial news.",               minPlan: "free",      upgradeMessage: "Upgrade for unlimited news Q&A." },
  watchlists:             { key: "watchlists",             name: "Watchlists",               description: "Track your favorite assets in personalized watchlists.",              minPlan: "free",      upgradeMessage: "Upgrade for more watchlists." },
  portfolios:             { key: "portfolios",             name: "Portfolios",               description: "Create and manage investment portfolios.",                            minPlan: "free",      upgradeMessage: "Upgrade for more portfolios." },
  saved_reports:          { key: "saved_reports",          name: "Saved Reports",            description: "Save and revisit AI-generated research reports.",                     minPlan: "pro",       upgradeMessage: "Saved reports are available on the Pro plan." },
  classical_optimization: { key: "classical_optimization", name: "Classical Optimization",   description: "Markowitz mean-variance portfolio optimization.",                     minPlan: "pro",       upgradeMessage: "Classical optimization is available on the Pro plan." },
  risk_dashboard:         { key: "risk_dashboard",         name: "Risk Dashboard",           description: "Portfolio risk metrics, drawdown, and exposure analysis.",             minPlan: "pro",       upgradeMessage: "Risk dashboard is available on the Pro plan." },
  backtesting:            { key: "backtesting",            name: "Backtesting",              description: "Test strategies against historical data.",                             minPlan: "trader",    upgradeMessage: "Backtesting is available on the Trader plan." },
  saved_strategies:       { key: "saved_strategies",       name: "Saved Strategies",         description: "Save, version, and manage trading strategies.",                       minPlan: "trader",    upgradeMessage: "Saved strategies are available on the Trader plan." },
  strategy_alerts:        { key: "strategy_alerts",        name: "Strategy Alerts",          description: "Get notified when strategy conditions are met.",                      minPlan: "trader",    upgradeMessage: "Strategy alerts are available on the Trader plan." },
  telegram_discord_alerts:{ key: "telegram_discord_alerts",name: "Telegram & Discord Alerts",description: "Push strategy alerts to Telegram or Discord.",                        minPlan: "trader",    upgradeMessage: "Telegram & Discord alerts are available on the Trader plan." },
  trade_journal:          { key: "trade_journal",          name: "Trade Journal",            description: "Log and review trades with notes and performance tracking.",           minPlan: "trader",    upgradeMessage: "Trade journaling is available on the Trader plan." },
  ml_signal_ranking:      { key: "ml_signal_ranking",      name: "ML Signal Ranking",        description: "Rank signals using machine learning models.",                         minPlan: "trader",    upgradeMessage: "ML signal ranking is available on the Trader plan." },
  quantum_optimization:   { key: "quantum_optimization",   name: "Quantum Optimization",     description: "QAOA-powered portfolio selection on simulated quantum hardware.",     minPlan: "quant",     upgradeMessage: "Quantum optimization is available on the Quant plan." },
  strategy_compare:       { key: "strategy_compare",       name: "Strategy Compare",         description: "Side-by-side multi-strategy comparison.",                             minPlan: "quant",     upgradeMessage: "Strategy comparison is available on the Quant plan." },
  monte_carlo_validation: { key: "monte_carlo_validation", name: "Monte Carlo Validation",   description: "Run Monte Carlo simulations for strategy robustness.",                minPlan: "quant",     upgradeMessage: "Monte Carlo validation is available on the Quant plan." },
  walk_forward_validation:{ key: "walk_forward_validation",name: "Walk-Forward Validation",  description: "Walk-forward optimization and out-of-sample testing.",                minPlan: "quant",     upgradeMessage: "Walk-forward validation is available on the Quant plan." },
  export_center:          { key: "export_center",          name: "Export Center",            description: "Export reports, trades, and data in multiple formats.",                minPlan: "quant",     upgradeMessage: "Export center is available on the Quant plan." },
  premium_llm_routing:    { key: "premium_llm_routing",    name: "Premium LLM Routing",      description: "Route queries to premium LLMs for better analysis.",                  minPlan: "quant",     upgradeMessage: "Premium LLM routing is available on the Quant plan." },
  byo_api_keys:           { key: "byo_api_keys",           name: "BYO API Keys",             description: "Bring your own API keys for LLM providers.",                          minPlan: "quant",     upgradeMessage: "BYO API keys are available on the Quant plan." },
  paper_trading:          { key: "paper_trading",          name: "Paper Trading",            description: "Simulated trading without real money.",                                minPlan: "execution", upgradeMessage: "Paper trading is invite-only via the Execution add-on." },
  broker_connection:      { key: "broker_connection",      name: "Broker Connection",        description: "Connect to supported brokers.",                                       minPlan: "execution", upgradeMessage: "Broker connection is invite-only via the Execution add-on." },
  live_execution:         { key: "live_execution",         name: "Live Execution",           description: "Execute trades with strict risk controls.",                            minPlan: "execution", upgradeMessage: "Live execution is invite-only and requires strict risk controls." },
};

export function getFeature(key: string): FeatureConfig | undefined {
  return FEATURES[key];
}
