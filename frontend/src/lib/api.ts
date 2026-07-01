const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let authToken: string | null = null;
const GUEST_SESSION_STORAGE_KEY = "quanfora.guestResearchSession";

// ─── Types ────────────────────

export interface ChatResponse {
  response: string;
  session_id: string;
  mode?: "single" | "consensus" | "auto";
  consensus?: ConsensusMetadata;
}

export type ChatJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ChatJobCreateResponse {
  job_id: string;
  status: ChatJobStatus;
  queue_position?: number | null;
}

export interface ChatJobProgress {
  mode: "single" | "consensus";
  active_tool?: string | null;
  completed_tools: string[];
  active_label?: string | null;
  message?: string | null;
  sequence: number;
  updated_at?: number | null;
}

export interface ChatJobStatusResponse extends ChatJobCreateResponse {
  progress?: ChatJobProgress | null;
  progress_events?: ChatJobProgress[];
  result?: ChatResponse | null;
  error?: { type?: string; message?: string } | null;
  created_at?: number | null;
  started_at?: number | null;
  finished_at?: number | null;
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

export type ResearchDepth = "shallow" | "medium" | "deep";
export type ResearchRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ResearchAgentStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ResearchRecommendation = "buy" | "hold" | "sell" | "insufficient_data";
export type ResearchSourceSurface = "introduction" | "research" | "market" | "ai_advisor" | "shared";
export type ResearchEventType = "reasoning" | "tool" | "report" | "status" | "final" | "error";

export interface EquityResearchRunCreate {
  ticker: string;
  analysis_date?: string;
  selected_analysts?: Array<"market" | "social" | "news" | "fundamentals">;
  research_depth?: ResearchDepth;
  quick_model?: string;
  deep_model?: string;
  source_surface?: ResearchSourceSurface;
}

export interface EquityResearchRun {
  run_id: string;
  user_id?: string | null;
  ticker: string;
  company_name?: string | null;
  exchange?: string | null;
  analysis_date: string;
  status: ResearchRunStatus;
  recommendation: ResearchRecommendation;
  confidence: number;
  research_depth: ResearchDepth;
  selected_analysts: string[];
  quick_model: string;
  deep_model: string;
  source_surface: ResearchSourceSurface;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  share_slug?: string | null;
  error_message?: string | null;
  disclaimer: string;
  data_snapshot_id?: string | null;
  final_summary?: string | null;
  main_upside?: string | null;
  main_risk?: string | null;
}

export interface EquityResearchSnapshot {
  snapshot_id: string;
  run_id: string;
  ticker: string;
  company_name?: string | null;
  exchange?: string | null;
  analysis_date: string;
  latest_price?: number | null;
  previous_close?: number | null;
  daily_change?: number | null;
  volume?: number | null;
  market_cap?: number | null;
  fundamentals: Record<string, unknown>;
  technical_indicators: Record<string, unknown>;
  news_items: Array<Record<string, unknown>>;
  rag_context: Array<Record<string, unknown>>;
  sentiment_summary: Record<string, unknown>;
  risk_metrics: Record<string, unknown>;
  data_sources: string[];
  source_quality?: Record<string, unknown>;
  provider_status?: Array<Record<string, unknown>>;
  evidence_items?: Array<Record<string, unknown>>;
  analyst_context?: Record<string, unknown>;
  filing_context?: Record<string, unknown>;
  created_at: string;
}

export interface EquityResearchReport {
  report_id: string;
  run_id: string;
  agent_key: string;
  agent_name: string;
  team: string;
  status: ResearchAgentStatus;
  title: string;
  markdown: string;
  summary_points: string[];
  evidence: Array<{ label: string; source: string; detail?: string | null; url?: string | null }>;
  confidence: number;
  risk_flags: string[];
  started_at?: string | null;
  completed_at?: string | null;
  token_input?: number | null;
  token_output?: number | null;
}

export interface EquityResearchEvent {
  event_id: string;
  run_id: string;
  timestamp: string;
  agent_key?: string | null;
  agent_name?: string | null;
  event_type: ResearchEventType;
  label: string;
  content: string;
  tool_name?: string | null;
  tool_args?: Record<string, unknown> | null;
  token_input?: number | null;
  token_output?: number | null;
}

export interface EquityResearchRunDetail {
  run: EquityResearchRun;
  snapshot?: EquityResearchSnapshot | null;
  reports: EquityResearchReport[];
  latest_events: EquityResearchEvent[];
}

export interface EquityResearchEventsList {
  cursor: number;
  events: EquityResearchEvent[];
}

export interface PublicEquityResearchReport {
  run: EquityResearchRun;
  snapshot?: EquityResearchSnapshot | null;
  reports: EquityResearchReport[];
}

export interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  metadata?: {
    consensus?: ConsensusMetadata;
    researchReports?: EquityResearchReport[];
  } | null;
  consensusOpinions?: ConsensusOpinion[];
  researchReports?: EquityResearchReport[];
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
  model_type?: string;
  train_metrics?: Record<string, number>;
  test_metrics?: Record<string, number>;
  summary?: string;
  current_price?: number;
  currentPrice?: number;
  ml_prediction?: "UP" | "DOWN" | "NEUTRAL" | string;
  valuation_status?: "available" | "unavailable" | string;
  valuation_target?: number | null;
  target_price?: number | null;
  implied_upside?: number | null;
  valuation_signal?: "Undervalued" | "Fairly Valued" | "Overvalued" | string | null;
  final_signal?: "Strong Bullish" | "Bullish" | "Bearish" | "Mixed / Hold" | "Neutral" | string;
  mae?: number | null;
  rmse?: number | null;
  finalPrediction?: {
    direction: "UP" | "DOWN" | "NEUTRAL";
    predictedPrice?: number;
    predictedReturn?: number;
    confidence?: "low" | "medium" | "high" | string;
  };
  modelBreakdown?: Record<string, {
    direction: "UP" | "DOWN" | "NEUTRAL";
    predictedPrice: number;
    predictedReturn: number;
  }>;
  predictions?: Record<string, {
    predicted_return: number;
    predicted_price: number;
    direction?: "UP" | "DOWN" | "NEUTRAL";
  }>;
  weights?: Record<string, number | string>;
  validation?: Record<string, Record<string, number>>;
  agreement?: { status: string; spread: number; message: string };
  agreementDisplay?: { status: "strong" | "moderate" | "weak" | "disagreement" | string; spread: number; explanation: string };
  confidence?: string;
  warnings?: string[];
  risk_notes?: string[];
  caveat?: string;
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

export interface ServiceStatus {
  status: "ok" | "degraded" | "error";
  core_status?: "ok" | "error";
  optional_status?: "ok" | "degraded";
  core_error_services?: string[];
  degraded_optional_services?: string[];
  environment: string;
  version: string;
  services: Record<string, {
    status: string;
    configured: boolean;
    detail?: string;
    [key: string]: unknown;
  }>;
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

export function isRedisUnavailableError(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  const message = typeof error.detail === "string" ? error.detail : error.message;
  return error.status === 503 && message.toLowerCase().includes("redis is unavailable");
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
  cost_currency: string;
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
  open?: number | null;
  high?: number | null;
  low?: number | null;
}

export interface EarningsPoint {
  date: string;
  eps_actual: number | null;
  eps_estimate: number | null;
  beat_pct: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  revenue_beat_pct: number | null;
}

export interface QuarterlyFinancial {
  period: string;
  revenue: number | null;
  net_income: number | null;
  diluted_eps: number | null;
  net_profit_margin: number | null;
  revenue_yoy: number | null;
  net_income_yoy: number | null;
  eps_yoy: number | null;
  margin_yoy: number | null;
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
  earnings?: EarningsPoint[];
  quarterly_financials?: QuarterlyFinancial[];
  data_sources?: string[];
  source_quality?: Record<string, unknown> | null;
  provider_status?: Array<Record<string, unknown>>;
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

export interface BacktestPricePoint {
  date: string;
  close: number;
}

export interface BacktestResult {
  run: BacktestRun;
  metrics: BacktestMetrics;
  equity_curve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  price_series: Record<string, BacktestPricePoint[]>;
  disclaimer: string;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface CandleResponse {
  candles: Record<string, Candle[]>;
  source: string;
}

export interface ReplayTrade {
  date: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  pnl?: number | null;
}

export interface ReplaySession {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  start_date: string;
  end_date: string;
  initial_balance: number;
  status: "active" | "completed";
  current_index: number;
  total_bars: number;
  cash: number;
  position_qty: number;
  position_avg_price: number;
  trades: ReplayTrade[];
  equity_curve: BacktestEquityPoint[];
  metrics: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface ReplaySessionCreateRequest {
  name: string;
  symbol: string;
  start_date: string;
  end_date: string;
  initial_balance: number;
}

export type ReplaySessionUpdateRequest = Partial<
  Pick<
    ReplaySession,
    "name" | "status" | "current_index" | "cash" | "position_qty" | "position_avg_price" | "trades" | "equity_curve" | "metrics"
  >
>;

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
  const res = await request(`${BASE}${path}`, { headers: requestHeaders(false), cache: "no-store" });
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
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the backend API at ${BASE}. This means the request did not receive an API response, usually because the backend URL is wrong, FastAPI is not reachable from this browser, or the browser blocked the request. If /health loads but /api/v1/status is degraded, optional service failures such as Qdrant or Redis are separate from this reachability error.`
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

function getGuestSessionId(): string | null {
  if (authToken || typeof window === "undefined") return null;
  const storage = window.sessionStorage;
  const existing = storage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const next = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(GUEST_SESSION_STORAGE_KEY, next);
  return next;
}

function requestHeaders(includeJson = true): HeadersInit {
  const guestSessionId = getGuestSessionId();
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(guestSessionId ? { "X-Guest-Session-Id": guestSessionId } : {}),
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

  deletePortfolio: (portfolioId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}`),

  portfolioHoldings: (portfolioId: string) =>
    get<Holding[]>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`),

  addHolding: (portfolioId: string, symbol: string, quantity: number, averageCost: number, costCurrency?: string) =>
    post<Holding>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`, {
      symbol,
      asset_type: "equity",
      quantity,
      average_cost: averageCost,
      cost_currency: costCurrency,
    }),

  updateHolding: (portfolioId: string, holdingId: string, updates: { quantity?: number; average_cost?: number; cost_currency?: string }) =>
    patch<Holding>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`, updates),

  removeHolding: (portfolioId: string, holdingId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`),

  watchlists: () => get<Watchlist[]>("/api/v1/watchlists"),

  createWatchlist: (name: string) =>
    post<Watchlist>("/api/v1/watchlists", { name }),

  deleteWatchlist: (watchlistId: string) =>
    del<void>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}`),

  watchlistAssets: (watchlistId: string) =>
    get<WatchlistAsset[]>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets`),

  addWatchlistAsset: (watchlistId: string, symbol: string, assetType = "equity") =>
    post<WatchlistAsset>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets`, { symbol, asset_type: assetType }),

  removeWatchlistAsset: (watchlistId: string, assetId: string) =>
    del<void>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets/${encodeURIComponent(assetId)}`),

  billingSubscription: () => get<BillingSubscription>("/api/v1/billing/subscription"),

  createCheckoutSession: (plan: AuthUser["plan"]) =>
    post<{ url: string }>("/api/v1/billing/create-checkout-session", { plan }),

  createCustomerPortalSession: (returnUrl?: string) =>
    post<{ url: string }>("/api/v1/billing/create-customer-portal-session", { return_url: returnUrl }),

  backtestStrategyOptions: () => get<StrategyOption[]>("/api/v1/backtests/strategies/options"),

  backtestStrategies: () => get<Strategy[]>("/api/v1/backtests/strategies"),

  backtestRuns: () => get<BacktestRun[]>("/api/v1/backtests/runs"),

  backtestRun: (runId: string) => get<BacktestRun>(`/api/v1/backtests/runs/${encodeURIComponent(runId)}`),

  deleteBacktestRun: (runId: string) =>
    del<void>(`/api/v1/backtests/runs/${encodeURIComponent(runId)}`),

  backtestCandles: (symbols: string[], start: string, end: string) =>
    get<CandleResponse>(
      `/api/v1/backtests/market-data/candles?symbols=${encodeURIComponent(symbols.join(","))}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),

  replaySessions: () => get<ReplaySession[]>("/api/v1/backtests/replay-sessions"),

  createReplaySession: (payload: ReplaySessionCreateRequest) =>
    post<ReplaySession>("/api/v1/backtests/replay-sessions", payload),

  replaySession: (sessionId: string) =>
    get<ReplaySession>(`/api/v1/backtests/replay-sessions/${encodeURIComponent(sessionId)}`),

  updateReplaySession: (sessionId: string, payload: ReplaySessionUpdateRequest) =>
    patch<ReplaySession>(`/api/v1/backtests/replay-sessions/${encodeURIComponent(sessionId)}`, payload),

  deleteReplaySession: (sessionId: string) =>
    del<void>(`/api/v1/backtests/replay-sessions/${encodeURIComponent(sessionId)}`),

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

  /** Chat with the LangGraph agent — mode controls Quanfora version */
  chat: (message: string, sessionId = "default", remember = true, mode: "single" | "consensus" | "auto" = "single") =>
    post<ChatResponse>("/api/v1/agent/chat", { message, session_id: sessionId, remember, mode }),

  /** Queue AI chat work and poll the job status/result */
  chatJob: (message: string, sessionId = "default", remember = true, mode: "single" | "consensus" | "auto" = "single") =>
    post<ChatJobCreateResponse>("/api/v1/agent/chat/jobs", { message, session_id: sessionId, remember, mode }),

  chatJobStatus: (jobId: string) =>
    get<ChatJobStatusResponse>(`/api/v1/agent/chat/jobs/${encodeURIComponent(jobId)}`),

  waitForChatJob: async (jobId: string, onUpdate?: (job: ChatJobStatusResponse) => void, intervalMs = 1500) => {
    while (true) {
      const job = await api.chatJobStatus(jobId);
      onUpdate?.(job);

      if (job.status === "succeeded") {
        return job.result ?? { response: "", session_id: "default" };
      }

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.error?.message ?? `Chat job ${job.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  },

  /** Full Quanfora 2.0 multi-agent consensus with metadata */
  consensus: (message: string, sessionId = "default", remember = true) =>
    post<ConsensusResponse>("/api/v1/agent/consensus", { message, session_id: sessionId, remember }),

  /** Quanfora 2.1 Equity Research Desk */
  createEquityResearchRun: (payload: EquityResearchRunCreate) =>
    post<EquityResearchRun>("/api/v1/equity-research/runs", payload),

  equityResearchRun: (runId: string) =>
    get<EquityResearchRunDetail>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}`),

  equityResearchReports: (runId: string) =>
    get<EquityResearchReport[]>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/reports`),

  equityResearchEvents: (runId: string, after = 0) =>
    get<EquityResearchEventsList>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/events/list?after=${after}`),

  shareEquityResearchRun: (runId: string, shared = true) =>
    patch<EquityResearchRun>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/share`, { shared }),

  deleteEquityResearchRun: (runId: string) =>
    del<void>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}`),

  publicEquityResearchReport: (shareSlug: string) =>
    get<PublicEquityResearchReport>(`/api/v1/equity-research/shared/${encodeURIComponent(shareSlug)}`),

  /** Conversation sessions */
  chatSessions: () => get<ChatSession[]>("/api/v1/agent/sessions"),

  createChatSession: (sessionId: string, title = "New chat") =>
    post<ChatSession>("/api/v1/agent/sessions", { session_id: sessionId, title }),

  chatSessionMessages: (sessionId = "default") =>
    get<ChatSessionMessages>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`),

  appendChatSessionMessage: (sessionId: string, role: "user" | "assistant", content: string, metadata?: ChatMessage["metadata"]) =>
    post<{ status: string; session_id: string }>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`, { role, content, metadata }),

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
  predict: (ticker: string, modelType: "random_forest" | "lstm" | "ensemble" = "ensemble") =>
    post<PredictResult>("/api/v1/predict", { ticker, model: modelType }),

  marketQuote: (ticker: string, period = "1mo", interval = "1d") =>
    get<MarketQuote>(`/api/v1/market/quote/${encodeURIComponent(ticker)}?period=${period}&interval=${interval}`),

  marketSearch: (query: string, limit = 12) =>
    get<MarketSymbolSearchResult[]>(`/api/v1/market/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  /** News */
  newsCategories: () => get<CategoryInfo[]>("/api/v1/news/categories"),

  news: (categories: string[], limit = 20) =>
    get<NewsResponse>(`/api/v1/news?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`),

  marketIntelligence: (categories: string[], limit = 30) =>
    get<MarketIntelligenceResponse>(`/api/v1/market-intelligence?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`),

  /** Health check */
  health: () => get<{ status: string }>("/health"),
  status: () => get<ServiceStatus>("/api/v1/status"),
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
  sources_attempted?: number;
  sources_succeeded?: number;
  sources_failed?: number;
}

export interface CategoryInfo {
  key: string;
  label: string;
}

export interface InsightSource {
  title: string;
  url: string | null;
  publisher: string | null;
  published_at: string | null;
}

export interface ImpactScoreBreakdown {
  freshness: number;
  relevance: number;
  sentiment: number;
  price_volume: number;
  source_quality: number;
  risk_penalty: number;
  final_score: number;
}

export interface NewsBriefCard {
  id: string;
  headline: string;
  summary: string;
  tickers: string[];
  categories: string[];
  sentiment: "bullish" | "neutral" | "bearish";
  impact_score: number;
  confidence: number;
  why_it_matters: string;
  risk_flags: string[];
  sources: InsightSource[];
  published_at: string | null;
  score_breakdown?: ImpactScoreBreakdown | null;
}

export interface TodayPickCard {
  id: string;
  ticker: string;
  company_name: string | null;
  current_price?: number | null;
  daily_change_pct?: number | null;
  thesis: string;
  label: string;
  opportunity_score: number;
  confidence: number;
  risk_level: "low" | "medium" | "high" | "critical";
  key_evidence: string[];
  risk_flags: string[];
  related_news_count: number;
  sources: InsightSource[];
}

export interface ResearchReport {
  id: string;
  title: string;
  executive_summary: string;
  affected_tickers: string[];
  sections: Record<string, string>;
  bull_case: string[];
  bear_case: string[];
  risk_flags: string[];
  signal_summary: Record<string, unknown>;
  sources: InsightSource[];
  what_to_watch_next: string[];
  disclaimer: string;
  created_at: string;
}

export interface MarketIntelligenceResponse {
  briefing: NewsBriefCard[];
  picks: TodayPickCard[];
  reports: ResearchReport[];
  categories_fetched: string[];
  total_sources: number;
  sources_attempted: number;
  sources_succeeded: number;
  sources_failed: number;
  generated_at: string;
}

/** WebSocket URL for streaming agent chat */
export const wsUrl = (sessionId = "default", token: string | null = null) => {
  const url = new URL(`${BASE.replace("http", "ws").replace("https", "wss")}/ws/agent/chat/${sessionId}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};
