const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

// ─── API helpers ────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// ─── Exported functions ────────────

export const api = {
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

  /** Health check */
  health: () => get<{ status: string }>("/health"),
};

/** WebSocket URL for streaming agent chat */
export const wsUrl = (sessionId = "default") =>
  `${BASE.replace("http", "ws")}/ws/agent/chat`;
