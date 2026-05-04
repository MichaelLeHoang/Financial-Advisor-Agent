const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let authToken: string | null = null;

// ─── Types ────────────────────

export interface ChatResponse {
  response: string;
  session_id: string;
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

// ─── API helpers ────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
  const res = await fetch(`${BASE}${path}`, { headers: requestHeaders(false) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
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
  };
}

// ─── Exported functions ────────────

export const api = {
  setAuthToken: (token: string | null) => {
    authToken = token;
  },

  me: () => get<AuthUser>("/api/v1/me"),

  portfolios: () => get<Portfolio[]>("/api/v1/portfolios"),

  createPortfolio: (name: string, baseCurrency = "USD") =>
    post<Portfolio>("/api/v1/portfolios", { name, base_currency: baseCurrency }),

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

  /** Chat with the full LangGraph agent */
  chat: (message: string, sessionId = "default", remember = true) =>
    post<ChatResponse>("/api/v1/agent/chat", { message, session_id: sessionId, remember }),

  /** Reset conversation history */
  resetChat: (sessionId = "default") =>
    post<{ status: string }>(`/api/v1/agent/reset?session_id=${sessionId}`, {}),

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

  /** Health check */
  health: () => get<{ status: string }>("/health"),
};

/** WebSocket URL for streaming agent chat */
export const wsUrl = (sessionId = "default") =>
  `${BASE.replace("http", "ws")}/ws/agent/chat`;
