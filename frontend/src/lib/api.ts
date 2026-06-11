const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let authToken: string | null = null;

// ─── Types ────────────────────

export interface ChatResponse {
  response: string;
  session_id: string;
  mode?: "single" | "consensus" | "auto";
}

export interface ConsensusOpinion {
  agent: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  data_points: Record<string, unknown>;
  risk_flags: string[];
}

export interface ConsensusMetadata {
  verdict: string;
  confidence: number;
  consensus_score: number;
  agreement_ratio: number;
  risk_vetoed: boolean;
  risk_flags: string[];
  dissenting_agents: string[];
  opinions: ConsensusOpinion[];
}

export interface ConsensusResponse extends ChatResponse {
  consensus: ConsensusMetadata;
}

export interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  message_count: number;
  last_active: string;
}

export interface ChatSessionMessages {
  session_id: string;
  messages: ChatMessage[];
}

export interface SentimentResult {
  individual: Array<{ label: string; score: number; all_scores: Record<string, number> }>;
  market_mood: {
    mood: string;
    bullish_score: number;
    signal: string;
    avg_scores: Record<string, number>;
    breakdown: Record<string, number>;
    num_articles: number;
  };
}

export interface OptimizeResult {
  method: string;
  weights?: Record<string, number>;
  expected_annual_return?: number;
  annual_volatility?: number;
  sharpe_ratio?: number;
  selected_stocks?: string[];
  best_probability?: number;
  top_states?: Array<{ bitstring: string; stocks: string[]; probability: number }>;
}

export interface PredictResult {
  ticker: string;
  model_type: string;
  train_metrics: Record<string, number>;
  test_metrics: Record<string, number>;
}

export interface UpgradeRequiredDetail {
  error: "upgrade_required";
  feature_key: string;
  current_plan: string;
  required_plan: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string | null;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  plan: "free" | "pro" | "trader" | "quant" | "execution_addon";
  is_guest?: boolean;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(errorMessage(detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isUpgradeRequiredError(error: unknown): error is ApiError & { detail: UpgradeRequiredDetail } {
  return error instanceof ApiError
    && typeof error.detail === "object"
    && error.detail !== null
    && (error.detail as { error?: string }).error === "upgrade_required";
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  created_at: string;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  symbol: string;
  asset_type: string;
  quantity: number;
  average_cost: number;
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistAsset {
  id: string;
  watchlist_id: string;
  symbol: string;
  asset_type: string;
  created_at: string;
}

export interface MarketQuotePoint {
  label: string;
  price: number;
  volume: number;
}

export interface MarketQuote {
  ticker: string;
  name: string;
  exchange?: string | null;
  sector?: string | null;
  price: number;
  change: number;
  currency?: string | null;
  open_price?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  market_cap?: number | null;
  volume?: number | null;
  pe_ratio?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  dividend_yield?: number | null;
  dividend_rate?: number | null;
  quarterly_dividend_amount?: number | null;
  history: MarketQuotePoint[];
}

export interface MarketSymbolSearchResult {
  ticker: string;
  name: string;
  exchange?: string | null;
  sector?: string | null;
  quote_type?: string | null;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan: AuthUser["plan"];
  status: string;
  current_period_end?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscription {
  subscription: Subscription;
  publishable_plan: AuthUser["plan"];
  configured: boolean;
}

export interface BacktestMetrics {
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  profit_factor: number | null;
  number_of_trades: number;
  fees_paid: number;
}

export interface BacktestEquityPoint {
  date: string;
  value: number;
}

export interface BacktestTrade {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  pnl?: number | null;
  reason?: string | null;
  executed_at: string;
}

export interface BacktestRun {
  id: string;
  user_id: string;
  strategy_id?: string | null;
  strategy_name: string;
  strategy_type: string;
  symbols: string[];
  parameters: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  metrics: BacktestMetrics;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  created_at: string;
}

export interface BacktestResult {
  run: BacktestRun;
  metrics: BacktestMetrics;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  disclaimer: string;
}

export interface StrategyOption {
  type: "buy_and_hold" | "moving_average_crossover" | "rsi_mean_reversion";
  name: string;
  description: string;
  default_parameters: Record<string, unknown>;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  strategy_type: StrategyOption["type"];
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BacktestRequest {
  strategy_name: string;
  strategy_type: StrategyOption["type"];
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  fees_bps: number;
  slippage_bps: number;
  position_size: number;
  parameters: Record<string, unknown>;
  save_strategy: boolean;
}

export interface NotificationChannel {
  id: string;
  user_id: string;
  channel_type: "in_app" | "email" | "telegram" | "discord_webhook" | string;
  name: string;
  destination_label?: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelRequest {
  channel_type: string;
  name: string;
  destination?: string | null;
  config: Record<string, unknown>;
  is_active?: boolean;
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  alert_type: string;
  symbol?: string | null;
  condition: Record<string, unknown>;
  channels: string[];
  is_active: boolean;
  last_triggered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertRequest {
  name: string;
  alert_type: string;
  symbol?: string | null;
  condition: Record<string, unknown>;
  channels: string[];
  is_active?: boolean;
}

export interface AlertEvent {
  id: string;
  alert_id: string;
  user_id: string;
  alert_type: string;
  symbol?: string | null;
  message: string;
  value?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RiskSnapshot {
  id: string;
  user_id: string;
  portfolio_id: string;
  metrics: {
    portfolio_name?: string;
    base_currency?: string;
    total_value?: number;
    concentration_risk?: number;
    annualized_volatility?: number;
    max_drawdown_estimate?: number;
    risk_score?: number;
    holdings_count?: number;
  };
  allocations: {
    by_asset?: Record<string, { market_value: number; weight: number; asset_type: string }>;
    by_asset_class?: Record<string, number>;
  };
  correlation_matrix: Record<string, Record<string, number | null>>;
  ai_explanation?: string | null;
  created_at: string;
}

export interface RiskSnapshotResult {
  snapshot: RiskSnapshot;
  disclaimer: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  symbol: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price?: number | null;
  quantity: number;
  fees: number;
  strategy_id?: string | null;
  reason_entry?: string | null;
  reason_exit?: string | null;
  emotion_tag?: string | null;
  mistake_tag?: string | null;
  notes?: string | null;
  tags: string[];
  pnl?: number | null;
  return_pct?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type JournalEntryRequest = Omit<JournalEntry, "id" | "user_id" | "pnl" | "return_pct" | "created_at" | "updated_at">;

export interface JournalAnalytics {
  total_entries: number;
  closed_entries: number;
  total_pnl: number;
  win_rate: number;
  by_symbol: Record<string, { count: number; pnl: number }>;
  by_strategy: Record<string, { count: number; pnl: number }>;
  by_tag: Record<string, { count: number; pnl: number }>;
  by_weekday: Record<string, { count: number; pnl: number }>;
}

export type QuantStrategyType = StrategyOption["type"];

export interface QuantStrategyConfig {
  name: string;
  strategy_type: QuantStrategyType;
  parameters: Record<string, unknown>;
}

export interface StrategyComparisonRequest {
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  fees_bps: number;
  slippage_bps: number;
  position_size: number;
  strategies: QuantStrategyConfig[];
}

export interface StrategyComparisonResult {
  results: Array<{ name: string; strategy_type: string; metrics: BacktestMetrics }>;
  best_strategy?: string | null;
  ranking_metric: string;
  disclaimer: string;
}

export interface AdvancedValidationRequest {
  strategy_name: string;
  strategy_type: QuantStrategyType;
  symbols: string[];
  start_date: string;
  end_date: string;
  initial_capital: number;
  fees_bps: number;
  slippage_bps: number;
  position_size: number;
  parameters: Record<string, unknown>;
  walk_forward_windows: number;
  monte_carlo_paths: number;
  bootstrap_samples: number;
}

export interface AdvancedValidationResult {
  base_metrics: BacktestMetrics;
  walk_forward: Array<{ window: number; start: string; end: string; return: number; max_drawdown: number }>;
  monte_carlo: { paths: number; p05: number; p50: number; p95: number; loss_probability: number };
  bootstrap: { samples: number; mean_return: number; ci_5: number; ci_95: number };
  saved_run_id?: string | null;
  disclaimer: string;
}

export interface SignalRankingRequest {
  symbols: string[];
  start_date: string;
  end_date: string;
}

export interface SignalRank {
  symbol: string;
  score: number;
  momentum_20d: number;
  momentum_60d: number;
  volatility_20d: number;
  trend_label: string;
}

export interface SignalRankingResult {
  rankings: SignalRank[];
  disclaimer: string;
}

export interface StrategyExportRequest {
  strategy_name: string;
  strategy_type: QuantStrategyType;
  symbols: string[];
  parameters: Record<string, unknown>;
  language: "json" | "python" | "pine";
}

export interface StrategyExportResult {
  language: StrategyExportRequest["language"];
  content: string;
  saved_export_id?: string | null;
  routed_mode: string;
  disclaimer: string;
}

// ─── API helpers ────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await request(`${BASE}${path}`, { headers: requestHeaders(false) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "PATCH",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "DELETE",
    headers: requestHeaders(false),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the backend API at ${BASE}. Start FastAPI on port 8000 or update NEXT_PUBLIC_API_URL.`
      );
    }
    throw error;
  }
}

function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail !== null) {
    const maybeMessage = (detail as { message?: unknown; detail?: unknown }).message
      ?? (detail as { message?: unknown; detail?: unknown }).detail;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return "API error";
}

function requestHeaders(includeJson = true): HeadersInit {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    // Bypass ngrok free-tier browser interstitial warning page
    "ngrok-skip-browser-warning": "true",
  };
}

// ─── Exported functions ────────────

export const api = {
  setAuthToken: (token: string | null) => {
    authToken = token;
  },
  getToken: () => authToken,

  me: () => get<AuthUser>("/api/v1/me"),

  portfolios: () => get<Portfolio[]>("/api/v1/portfolios"),

  createPortfolio: (name: string, baseCurrency = "USD") =>
    post<Portfolio>("/api/v1/portfolios", { name, base_currency: baseCurrency }),

  portfolioHoldings: (portfolioId: string) =>
    get<Holding[]>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`),

  addHolding: (portfolioId: string, symbol: string, quantity: number, averageCost: number) =>
    post<Holding>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`, {
      symbol,
      asset_type: "equity",
      quantity,
      average_cost: averageCost,
    }),

  removeHolding: (portfolioId: string, holdingId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`),

  watchlists: () => get<Watchlist[]>("/api/v1/watchlists"),

  createWatchlist: (name: string) =>
    post<Watchlist>("/api/v1/watchlists", { name }),

  addWatchlistAsset: (watchlistId: string, symbol: string, assetType = "equity") =>
    post<WatchlistAsset>(`/api/v1/watchlists/${watchlistId}/assets`, { symbol, asset_type: assetType }),

  billingSubscription: () => get<BillingSubscription>("/api/v1/billing/subscription"),

  createCheckoutSession: (plan: AuthUser["plan"]) =>
    post<{ url: string }>("/api/v1/billing/create-checkout-session", { plan }),

  createCustomerPortalSession: (returnUrl?: string) =>
    post<{ url: string }>("/api/v1/billing/create-customer-portal-session", { return_url: returnUrl }),

  backtestStrategyOptions: () => get<StrategyOption[]>("/api/v1/backtests/strategies/options"),

  backtestStrategies: () => get<Strategy[]>("/api/v1/backtests/strategies"),

  backtestRuns: () => get<BacktestRun[]>("/api/v1/backtests/runs"),

  runBacktest: (payload: BacktestRequest) =>
    post<BacktestResult>("/api/v1/backtests/run", payload),

  notificationChannels: () => get<NotificationChannel[]>("/api/v1/notification-channels"),

  createNotificationChannel: (payload: NotificationChannelRequest) =>
    post<NotificationChannel>("/api/v1/notification-channels", payload),

  alerts: () => get<Alert[]>("/api/v1/alerts"),

  createAlert: (payload: AlertRequest) =>
    post<Alert>("/api/v1/alerts", payload),

  alertEvents: () => get<AlertEvent[]>("/api/v1/alerts/events"),

  evaluateAlerts: () => post<{ evaluated: number; triggered: number }>("/api/v1/alerts/evaluate", {}),

  portfolioRisk: (portfolioId: string) =>
    get<RiskSnapshotResult>(`/api/v1/risk/portfolios/${encodeURIComponent(portfolioId)}`),

  riskSnapshots: (portfolioId: string) =>
    get<RiskSnapshot[]>(`/api/v1/risk/portfolios/${encodeURIComponent(portfolioId)}/snapshots`),

  journalEntries: () => get<JournalEntry[]>("/api/v1/journal/entries"),

  createJournalEntry: (payload: JournalEntryRequest) =>
    post<JournalEntry>("/api/v1/journal/entries", payload),

  journalAnalytics: () => get<JournalAnalytics>("/api/v1/journal/analytics"),

  compareStrategies: (payload: StrategyComparisonRequest) =>
    post<StrategyComparisonResult>("/api/v1/quant/strategy-compare", payload),

  validateStrategyAdvanced: (payload: AdvancedValidationRequest) =>
    post<AdvancedValidationResult>("/api/v1/quant/validation", payload),

  rankSignals: (payload: SignalRankingRequest) =>
    post<SignalRankingResult>("/api/v1/quant/signals/rank", payload),

  exportStrategy: (payload: StrategyExportRequest) =>
    post<StrategyExportResult>("/api/v1/quant/export", payload),

  /** Chat with the LangGraph agent — mode controls QuanAd version */
  chat: (message: string, sessionId = "default", remember = true, mode: "single" | "consensus" | "auto" = "single") =>
    post<ChatResponse>("/api/v1/agent/chat", { message, session_id: sessionId, remember, mode }),

  /** Full QuanAd 2.0 multi-agent consensus with metadata */
  consensus: (message: string, sessionId = "default", remember = true) =>
    post<ConsensusResponse>("/api/v1/agent/consensus", { message, session_id: sessionId, remember }),

  /** Conversation sessions */
  chatSessions: () => get<ChatSession[]>("/api/v1/agent/sessions"),

  chatSessionMessages: (sessionId = "default") =>
    get<ChatSessionMessages>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`),

  renameChatSession: (sessionId: string, title: string) =>
    patch<ChatSession>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}`, { title }),

  deleteChatSession: (sessionId: string) =>
    del<{ status: string; session_id: string }>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}`),

  /** Reset conversation history */
  resetChat: (sessionId = "default") =>
    post<{ status: string }>(`/api/v1/agent/reset?session_id=${encodeURIComponent(sessionId)}`, {}),

  /** FinBERT sentiment analysis */
  sentiment: (texts: string[]) =>
    post<SentimentResult>("/api/v1/sentiment", { texts }),

  /** Portfolio optimization */
  optimize: (tickers: string[], method: "classical" | "quantum", riskTolerance = 1.0, targetAssets = 3) =>
    post<OptimizeResult>("/api/v1/optimize", {
      tickers, method, risk_tolerance: riskTolerance, target_assets: targetAssets,
    }),

  /** ML stock prediction */
  predict: (ticker: string, modelType: "random_forest" | "lstm" = "random_forest") =>
    post<PredictResult>("/api/v1/predict", { ticker, model_type: modelType }),

  marketQuote: (ticker: string, period = "1mo", interval = "1d") =>
    get<MarketQuote>(`/api/v1/market/quote/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`),

  marketSearch: (query: string, limit = 12) =>
    get<MarketSymbolSearchResult[]>(`/api/v1/market/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  /** News */
  newsCategories: () => get<CategoryInfo[]>("/api/v1/news/categories"),

  news: (categories: string[], limit = 20) =>
    get<NewsResponse>(`/api/v1/news?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`),

  /** Health check */
  health: () => get<{ status: string }>("/health"),
};

// ─── News Types ────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  published_at: string | null;
  url: string;
  thumbnail: string | null;
  tickers: string[];
  category: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  categories_fetched: string[];
  total: number;
}

export interface CategoryInfo {
  key: string;
  label: string;
}

/** WebSocket URL for streaming agent chat */
export const wsUrl = (sessionId = "default", token: string | null = null) => {
  const url = new URL(`${BASE.replace("http", "ws").replace("https", "wss")}/ws/agent/chat/${sessionId}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};
