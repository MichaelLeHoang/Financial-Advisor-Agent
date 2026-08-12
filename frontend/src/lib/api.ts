const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let authToken: string | null = null;
const GUEST_SESSION_STORAGE_KEY = "quanfora.guestResearchSession";
const ACCOUNT_READ_CACHE_MS = 5_000;
const DISCOVERY_READ_CACHE_MS = 30_000;

type ReadCacheEntry = { expiresAt: number; value: unknown };

// Memory-only and auth-scoped: avoids duplicate provider hydration without
// persisting account data or serving it across identity changes.
const readCache = new Map<string, ReadCacheEntry>();
const inflightReads = new Map<string, Promise<unknown>>();
let authScopeVersion = 0;

// ─── Types ────────────────────

export type AiDeskMode = "sabi" | "single" | "consensus" | "research";
export type AgentChatMode = AiDeskMode | "auto";
export type SabiCapability = "quick" | "consensus" | "research" | "portfolio" | "risk" | "backtest" | "trade_proposal";

export interface GroundingSource {
  label: string;
  source: string;
  url?: string | null;
  published_at?: string | null;
}

export interface GroundingMetadata {
  required: boolean;
  status: "grounded" | "unavailable" | "not_required";
  retrieved_at: string;
  as_of?: string | null;
  entity?: string | null;
  ticker?: string | null;
  company_name?: string | null;
  reasons: string[];
  sources: GroundingSource[];
  limitations: string[];
}

export type AgentActivityCategory = "market" | "news" | "technical" | "risk" | "portfolio" | "consensus" | "research" | "synthesis" | "system";
export type AgentActivityStatus = "pending" | "active" | "complete" | "error" | "warning";

export interface AgentActivityError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AgentActivitySource {
  source_id: string;
  step_id?: string | null;
  title: string;
  provider: string;
  url?: string | null;
  published_at?: string | null;
  preview?: string | null;
}

export interface AgentActivityStep {
  step_id: string;
  category: AgentActivityCategory;
  label: string;
  description?: string | null;
  status: AgentActivityStatus;
  duration_ms?: number | null;
}

export interface AgentToolActivity {
  tool_call_id: string;
  step_id?: string | null;
  tool_name: string;
  label: string;
  status: AgentActivityStatus;
  tool_input?: Record<string, unknown> | null;
  output_summary?: string | null;
  error?: AgentActivityError | null;
  duration_ms?: number | null;
}

export interface AgentActivityTrace {
  run_id: string;
  mode: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  steps: AgentActivityStep[];
  tools: AgentToolActivity[];
  sources: AgentActivitySource[];
  started_at?: string | null;
  finished_at?: string | null;
}

export interface AgentPlannedStep {
  step_id: string;
  category: AgentActivityCategory;
  label: string;
  description?: string | null;
  order: number;
}

export interface AgentActivityEvent {
  run_id: string;
  sequence: number;
  occurred_at: string;
  type: "analysis.planned" | "analysis.queued" | "analysis.started" | "analysis.completed" | "analysis.failed" | "step.started" | "step.completed" | "step.failed" | "tool.started" | "tool.completed" | "tool.failed" | "tool.approval_requested" | "tool.approval_resolved" | "source.found";
  mode?: string | null;
  category?: AgentActivityCategory | null;
  step_id?: string | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  label?: string | null;
  description?: string | null;
  status?: AgentActivityStatus | null;
  queue_position?: number | null;
  planned_steps?: AgentPlannedStep[];
  tool_input?: Record<string, unknown> | null;
  output_summary?: string | null;
  duration_ms?: number | null;
  error?: AgentActivityError | null;
  source?: AgentActivitySource | null;
  approval_outcome?: "approved" | "denied" | null;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  mode?: AgentChatMode;
  selected_mode?: AiDeskMode;
  selected_capability?: SabiCapability;
  action_status?: "analysis_only" | "research_requested" | "proposal_only";
  research_request?: {
    ticker?: string | null;
    report_type: ResearchReportType;
    research_depth: ResearchDepth | "auto";
  };
  consensus?: ConsensusMetadata;
  overview?: Overview | null;
  source_message_id?: string | null;
  memory_status?: "ready" | "disabled" | "maintenance_queued" | "maintenance_unavailable";
  memory_used?: MemoryContextUsage[];
  grounding?: GroundingMetadata;
  activity_trace?: AgentActivityTrace;
}

export type MemoryCategory =
  | "investment_horizon"
  | "risk_preference"
  | "asset_restriction"
  | "sector_preference"
  | "research_preference"
  | "communication_preference"
  | "trading_rule";

export type MemoryStatus = "candidate" | "confirmed" | "rejected" | "superseded";

export interface UserMemory {
  id: string;
  category: MemoryCategory;
  label: string;
  value_json: Record<string, unknown>;
  status: MemoryStatus;
  source_session_id?: string | null;
  source_message_id?: string | null;
  confidence: number;
  expires_at?: string | null;
  supersedes_memory_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemorySettings {
  enabled: boolean;
  updated_at?: string | null;
}

export interface MemoryContextUsage {
  id: string;
  category: MemoryCategory;
  label: string;
}

export interface MemoryListResponse {
  memories: UserMemory[];
  settings: MemorySettings;
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
  activity_events?: AgentActivityEvent[];
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
export type ResearchReportType = "investment" | "trading";
export type ResearchRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ResearchAgentStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ResearchRecommendation = "buy" | "hold" | "sell" | "insufficient_data";
export type InvestmentDecision = "strong_buy" | "buy" | "hold" | "watchlist" | "reduce" | "sell" | "avoid";
export type TradingBias = "bullish" | "neutral" | "bearish";
export type ResearchSourceSurface = "introduction" | "research" | "market" | "ai_advisor" | "shared";
export type ResearchEventType = "reasoning" | "tool" | "report" | "status" | "final" | "error" | "source";

export interface EquityResearchRunCreate {
  ticker: string;
  analysis_date?: string;
  report_type?: ResearchReportType;
  selected_analysts?: Array<"market" | "social" | "news" | "fundamentals">;
  research_depth?: ResearchDepth;
  quick_model?: string;
  deep_model?: string;
  source_surface?: ResearchSourceSurface;
  use_memory?: boolean;
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
  investment_decision?: InvestmentDecision | null;
  trading_bias?: TradingBias | null;
  confidence: number;
  report_type: ResearchReportType;
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
  source_url?: string | null;
  source_provider?: string | null;
  source_published_at?: string | null;
  token_input?: number | null;
  token_output?: number | null;
}

export type OverviewTone = "positive" | "neutral" | "negative" | "info";
export type OverviewVerdict = "buy" | "hold" | "sell" | "bullish" | "neutral" | "bearish" | "insufficient_data";

export interface OverviewMetric {
  label: string;
  value: string;
  tone: OverviewTone;
}

export interface OverviewSource {
  label: string;
  source: string;
  url?: string | null;
}

export interface OverviewPoint {
  title: string;
  detail: string;
  sources: OverviewSource[];
  tone: OverviewTone;
}

export interface Overview {
  title: string;
  verdict: OverviewVerdict;
  summary: string;
  metrics: OverviewMetric[];
  catalysts: OverviewPoint[];
  risks: OverviewPoint[];
  sources: OverviewSource[];
  next_questions: string[];
  disclaimer: string;
}

export type DecisionWorkspaceTone = "positive" | "neutral" | "negative" | "info";

export interface DecisionWorkspaceMetric {
  label: string;
  value: string;
  tone: DecisionWorkspaceTone;
}

export interface DecisionWorkspaceSection {
  summary: string;
  metrics: DecisionWorkspaceMetric[];
  bullets: string[];
  limitations: string[];
}

export interface DecisionWorkspaceBacktest {
  summary: string;
  assumptions: string[];
  metrics: DecisionWorkspaceMetric[];
  limitations: string[];
}

export interface DecisionWorkspaceNextStep {
  label: string;
  detail: string;
  trigger?: string | null;
}

export interface DecisionWorkspace {
  overview: DecisionWorkspaceSection;
  evidence: DecisionWorkspaceSection;
  signals: DecisionWorkspaceSection;
  backtest: DecisionWorkspaceBacktest;
  regime: DecisionWorkspaceSection;
  agent_debate: DecisionWorkspaceSection;
  next_steps: DecisionWorkspaceNextStep[];
}

export interface EquityResearchRunDetail {
  run: EquityResearchRun;
  snapshot?: EquityResearchSnapshot | null;
  reports: EquityResearchReport[];
  latest_events: EquityResearchEvent[];
  decision_workspace?: DecisionWorkspace | null;
  overview?: Overview | null;
}

export interface EquityResearchEventsList {
  cursor: number;
  events: EquityResearchEvent[];
}

export interface PublicEquityResearchReport {
  run: EquityResearchRun;
  snapshot?: EquityResearchSnapshot | null;
  reports: EquityResearchReport[];
  decision_workspace?: DecisionWorkspace | null;
  overview?: Overview | null;
}

export interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  metadata?: {
    consensus?: ConsensusMetadata;
    researchReports?: EquityResearchReport[];
    overview?: Overview | null;
    selected_mode?: AiDeskMode;
    selected_capability?: SabiCapability;
    action_status?: "analysis_only" | "research_requested" | "proposal_only";
    grounding?: GroundingMetadata;
    source_message_id?: string | null;
    memory_status?: ChatResponse["memory_status"];
    memory_used?: MemoryContextUsage[];
    activity_trace?: AgentActivityTrace;
  } | null;
  consensusOpinions?: ConsensusOpinion[];
  researchReports?: EquityResearchReport[];
  overview?: Overview | null;
  selectedCapability?: SabiCapability;
  grounding?: GroundingMetadata;
  activity?: AgentActivityTrace;
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
  book_type: PositionBook;
  classification_source: ClassificationSource;
  classified_at?: string | null;
  classified_by?: string | null;
  created_at: string;
}

export type PositionBook = "investment" | "trading" | "unclassified";
export type ClassificationSource = "user" | "import" | "agent_suggestion" | "strategy";

export interface PortfolioBookTotal {
  book_type: PositionBook;
  holding_count: number;
  cost_basis: number;
  portfolio_weight: number;
}

export interface PortfolioBooks {
  portfolio_id: string;
  base_currency: string;
  as_of: string;
  total_cost_basis: number;
  books: PortfolioBookTotal[];
  risk: {
    gross_exposure: number;
    largest_position_weight: number;
    investment_weight: number;
    trading_weight: number;
    unclassified_weight: number;
    unclassified_count: number;
  };
}

export interface PortfolioBookEvent {
  id: string;
  user_id: string;
  portfolio_id: string;
  holding_id?: string | null;
  symbol: string;
  previous_book_type: PositionBook;
  new_book_type: PositionBook;
  classification_source: ClassificationSource;
  actor_id: string;
  created_at: string;
}

export interface InvestmentPolicyPayload {
  name: string;
  status: "draft" | "active" | "archived";
  goals: Record<string, unknown>;
  time_horizon: string;
  target_allocation: Record<string, number>;
  max_position_weight: number;
  max_sector_weight: number;
  max_drawdown: number;
  minimum_cash_weight: number;
  permitted_assets: string[];
  rebalancing_policy: Record<string, unknown>;
  tax_preferences: Record<string, unknown>;
}

export interface InvestmentPolicy extends InvestmentPolicyPayload {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentPolicyAlert {
  code: string;
  severity: "warning" | "breach";
  message: string;
  symbol?: string | null;
  observed?: number | null;
  limit?: number | null;
  portfolio_ids?: string[];
  holding_ids?: string[];
}

export interface InvestmentPolicyValidation {
  policy_id: string;
  portfolio_id: string;
  compliant: boolean;
  alerts: InvestmentPolicyAlert[];
  validated_at: string;
}

export interface InvestmentPolicyScopeValidation {
  policy_id: string;
  portfolio_ids: string[];
  compliant: boolean;
  alerts: InvestmentPolicyAlert[];
  validated_at: string;
}

export type InvestmentThesisStatus = "active" | "needs_review" | "invalidated";

export interface InvestmentThesisPayload {
  statement: string;
  supporting_evidence: string[];
  risk_evidence: string[];
  invalidation_conditions: string[];
  status: InvestmentThesisStatus;
  next_review_at?: string | null;
}

export interface InvestmentThesis extends InvestmentThesisPayload {
  id: string;
  user_id: string;
  portfolio_id: string;
  holding_id: string;
  symbol: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentDecisionRecord {
  id: string;
  user_id: string;
  portfolio_id: string;
  holding_id: string;
  symbol: string;
  action: "hold" | "trim";
  rationale: string;
  policy_exception?: string | null;
  created_at: string;
}

export interface RecurringBuy {
  id: string;
  portfolio_id: string;
  linked_holding_id?: string | null;
  symbol: string;
  account?: string | null;
  status: string;
  purchase_mode: "amount" | "shares";
  entered_amount: number;
  entered_currency: string;
  filled_quantity: number;
  fill_price: number;
  fill_currency: string;
  exchange_rate?: number | null;
  recurrence_frequency: "daily" | "weekly" | "monthly" | "yearly";
  schedule_time: string;
  schedule_day_of_week?: number | null;
  schedule_day_of_month?: number | null;
  schedule_month?: number | null;
  executed_at: string;
  created_at: string;
}

export interface RecurringBuyRequest {
  symbol: string;
  account?: string | null;
  status?: string;
  purchase_mode?: "amount" | "shares";
  entered_amount: number;
  entered_currency: string;
  filled_quantity: number;
  fill_price: number;
  fill_currency: string;
  exchange_rate?: number | null;
  recurrence_frequency?: "daily" | "weekly" | "monthly" | "yearly";
  schedule_time?: string;
  schedule_day_of_week?: number | null;
  schedule_day_of_month?: number | null;
  schedule_month?: number | null;
  executed_at?: string;
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
  session?: "pre" | "post" | "unknown";
  eps_actual: number | null;
  eps_estimate: number | null;
  beat_pct: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  revenue_beat_pct: number | null;
}

export interface EarningsCalendarEvent extends EarningsPoint {
  symbol: string;
  name: string;
  country: "US" | "CA" | "Other";
  market_cap: number | null;
  logo_url?: string | null;
}

export interface EarningsCalendarResponse {
  from_date: string;
  to_date: string;
  events: EarningsCalendarEvent[];
  data_sources: string[];
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
  logo_url?: string | null;
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

export interface CryptoProviderStatus {
  provider: string;
  status: string;
  detail?: string | null;
  timestamp: string;
}

export interface CryptoOverview {
  asset_type: "crypto";
  base_asset: string;
  quote_currency: string;
  provider_symbol: string;
  name: string;
  venue: string;
  price: number;
  change_24h?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  volume_24h?: number | null;
  market_cap?: number | null;
  market_cap_rank?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number | null;
  ath_date?: string | null;
  ath_drawdown_pct?: number | null;
  updated_at: string;
  data_sources: string[];
  provider_status: CryptoProviderStatus[];
}

export interface CryptoSeriesPoint {
  timestamp: string;
  price: number;
  volume?: number | null;
  market_cap?: number | null;
  sma_50?: number | null;
  sma_100?: number | null;
  sma_200?: number | null;
}

export interface CryptoSeries {
  base_asset: string;
  quote_currency: string;
  range: string;
  visible_from: string;
  points: CryptoSeriesPoint[];
  updated_at: string;
  data_sources: string[];
  provider_status: CryptoProviderStatus[];
}

export interface FearGreedPoint {
  timestamp: string;
  value: number;
  classification: string;
}

export interface FearGreed {
  range: string;
  current_value?: number | null;
  current_classification?: string | null;
  daily_change?: number | null;
  points: FearGreedPoint[];
  updated_at: string;
  data_sources: string[];
  provider_status: CryptoProviderStatus[];
}

export interface HalvingCycle {
  previous_halving_date: string;
  previous_halving_height: number;
  latest_block_height: number;
  next_halving_height: number;
  next_halving_number: number;
  progress_pct: number;
  blocks_completed: number;
  blocks_remaining: number;
  estimated_days_remaining: number;
  estimated_next_halving_date: string;
  average_block_minutes: number;
  updated_at: string;
  data_sources: string[];
  provider_status: CryptoProviderStatus[];
}

export interface CryptoContext {
  base_asset: string;
  quote_currency: string;
  fear_greed?: FearGreed | null;
  halving?: HalvingCycle | null;
  network?: {
    hash_rate?: number | null;
    difficulty?: number | null;
    transactions_24h?: number | null;
    fees_btc_24h?: number | null;
    blocks_mined_24h?: number | null;
  } | null;
  mempool?: {
    block_height?: number | null;
    unconfirmed_transactions?: number | null;
    virtual_size_bytes?: number | null;
    total_fees_btc?: number | null;
    fastest_fee_sats_vb?: number | null;
    half_hour_fee_sats_vb?: number | null;
    hour_fee_sats_vb?: number | null;
    economy_fee_sats_vb?: number | null;
    minimum_fee_sats_vb?: number | null;
  } | null;
  defi?: {
    total_value_locked_usd?: number | null;
    dex_volume_24h_usd?: number | null;
    top_chains: Array<{ name: string; tvl_usd: number }>;
  } | null;
  market?: {
    bitcoin_dominance_pct?: number | null;
    total_market_cap_usd?: number | null;
    total_volume_24h_usd?: number | null;
  } | null;
  updated_at: string;
  data_sources: string[];
  provider_status: CryptoProviderStatus[];
}

export interface PaperAccount {
  id: string;
  user_id?: string | null;
  guest_owner_id?: string | null;
  name: string;
  base_currency: string;
  initial_cash: number;
  cash: number;
  cash_reserved: number;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface PaperOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  order_type: "market" | "limit" | "stop";
  time_in_force: "day" | "gtc";
  limit_price?: number | null;
  stop_price?: number | null;
  protective_stop?: number | null;
  target_price?: number | null;
  risk_budget?: number | null;
  thesis?: string | null;
  status: "open" | "filled" | "canceled" | "rejected";
  reserved_cash: number;
  average_fill_price?: number | null;
  fees: number;
  submitted_at: string;
  filled_at?: string | null;
  canceled_at?: string | null;
}

export type PaperOrderRequest = Omit<PaperOrder, "id" | "account_id" | "status" | "reserved_cash" | "average_fill_price" | "fees" | "submitted_at" | "filled_at" | "canceled_at">;

export interface PaperFill {
  id: string;
  account_id: string;
  order_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  executed_at: string;
}

export interface PaperPosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  average_entry: number;
  last_price: number;
  realized_pnl: number;
  market_value: number;
  unrealized_pnl: number;
  updated_at: string;
}

export interface PaperCashLedgerEntry {
  id: string;
  account_id: string;
  order_id?: string | null;
  fill_id?: string | null;
  entry_type: "deposit" | "buy" | "sell";
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface PaperAccountSummary {
  account: PaperAccount;
  cash_available: number;
  cash_reserved: number;
  buying_power: number;
  market_value: number;
  equity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  day_pnl: number;
  open_risk: number;
  open_orders: number;
  data_status: "fresh" | "delayed" | "illustrative" | "unavailable";
  as_of: string;
}

export interface PaperAccountSnapshot {
  summary: PaperAccountSummary;
  orders: PaperOrder[];
  fills: PaperFill[];
  positions: PaperPosition[];
  ledger: PaperCashLedgerEntry[];
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

export type AlertUpdateRequest = Partial<AlertRequest>;

export interface NewsDigestPreference {
  user_id: string;
  email?: string | null;
  is_enabled: boolean;
  timezone: string;
  local_time: string;
  max_symbols: number;
  next_run_at?: string | null;
  last_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsDigestPreferenceRequest {
  is_enabled: boolean;
  timezone: string;
  local_time: string;
  max_symbols: number;
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

function invalidateReadCache() {
  authScopeVersion += 1;
  readCache.clear();
  inflightReads.clear();
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal, invalidatesReads = false): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  if (invalidatesReads) invalidateReadCache();
  return res.json();
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await request(`${BASE}${path}`, { headers: requestHeaders(false), cache: "no-store", signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  return res.json();
}

async function get<T>(path: string, signal?: AbortSignal, cacheMs = 0): Promise<T> {
  if (signal) return fetchJson<T>(path, signal);

  const key = `${authScopeVersion}:${path}`;
  const cached = readCache.get(key);
  if (cacheMs > 0 && cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) readCache.delete(key);

  const inflight = inflightReads.get(key);
  if (inflight) return inflight as Promise<T>;

  const pending = fetchJson<T>(path)
    .then((value) => {
      if (cacheMs > 0) readCache.set(key, { expiresAt: Date.now() + cacheMs, value });
      return value;
    })
    .finally(() => {
      inflightReads.delete(key);
    });
  inflightReads.set(key, pending);
  return pending;
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
  invalidateReadCache();
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "PUT",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? err);
  }
  invalidateReadCache();
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
  invalidateReadCache();
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

async function streamSse<T>(
  path: string,
  onEvent: (event: T, sequence: number, eventName: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const response = await request(`${BASE}${path}`, {
    headers: requestHeaders(false),
    cache: "no-store",
    signal,
  });
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, error.detail ?? error);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastSequence = 0;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame || frame.startsWith(":")) continue;
      let eventName = "message";
      let sequence = lastSequence;
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("id:")) sequence = Number(line.slice(3).trim()) || sequence;
        else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      const parsed = JSON.parse(data.join("\n")) as T;
      lastSequence = Math.max(lastSequence, sequence);
      onEvent(parsed, sequence, eventName);
    }
    if (done) break;
  }
  return lastSequence;
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

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Request aborted", "AbortError"));
    }, { once: true });
  });
}

// ─── Exported functions ────────────

export const api = {
  setAuthToken: (token: string | null) => {
    if (authToken !== token) {
      invalidateReadCache();
    }
    authToken = token;
  },
  getToken: () => authToken,
  invalidateReadCache,

  me: () => get<AuthUser>("/api/v1/me", undefined, ACCOUNT_READ_CACHE_MS),

  portfolios: () => get<Portfolio[]>("/api/v1/portfolios", undefined, ACCOUNT_READ_CACHE_MS),

  createPortfolio: (name: string, baseCurrency = "USD") =>
    post<Portfolio>("/api/v1/portfolios", { name, base_currency: baseCurrency }, undefined, true),

  deletePortfolio: (portfolioId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}`),

  portfolioHoldings: (portfolioId: string) =>
    get<Holding[]>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`, undefined, ACCOUNT_READ_CACHE_MS),

  portfolioBooks: (portfolioId: string) =>
    get<PortfolioBooks>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/books`, undefined, ACCOUNT_READ_CACHE_MS),

  portfolioBookEvents: (portfolioId: string) =>
    get<PortfolioBookEvent[]>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/book-events`, undefined, ACCOUNT_READ_CACHE_MS),

  investmentPolicy: () => get<InvestmentPolicy | null>("/api/v1/investment-policy", undefined, ACCOUNT_READ_CACHE_MS),

  saveInvestmentPolicy: (payload: InvestmentPolicyPayload) =>
    put<InvestmentPolicy>("/api/v1/investment-policy", payload),

  validateInvestmentPolicy: (portfolioId: string) =>
    post<InvestmentPolicyValidation>("/api/v1/investment-policy/validate", { portfolio_id: portfolioId }),

  validateInvestmentPolicyScope: (portfolioIds: string[]) =>
    post<InvestmentPolicyScopeValidation>("/api/v1/investment-policy/validate-scope", { portfolio_ids: portfolioIds }),

  investmentTheses: (portfolioId?: string) =>
    get<InvestmentThesis[]>(`/api/v1/investment-theses${portfolioId ? `?portfolio_id=${encodeURIComponent(portfolioId)}` : ""}`, undefined, ACCOUNT_READ_CACHE_MS),

  saveInvestmentThesis: (holdingId: string, payload: InvestmentThesisPayload) =>
    put<InvestmentThesis>(`/api/v1/investment-theses/${encodeURIComponent(holdingId)}`, payload),

  investmentDecisions: (portfolioId?: string, limit = 50) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (portfolioId) query.set("portfolio_id", portfolioId);
    return get<InvestmentDecisionRecord[]>(`/api/v1/investment-decisions?${query.toString()}`, undefined, ACCOUNT_READ_CACHE_MS);
  },

  createInvestmentDecision: (payload: { holding_id: string; action: "hold" | "trim"; rationale: string; policy_exception?: string | null }) =>
    post<InvestmentDecisionRecord>("/api/v1/investment-decisions", payload, undefined, true),

  addHolding: (portfolioId: string, symbol: string, quantity: number, averageCost: number, costCurrency?: string) =>
    post<Holding>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings`, {
      symbol,
      asset_type: "equity",
      quantity,
      average_cost: averageCost,
      cost_currency: costCurrency,
    }, undefined, true),

  updateHolding: (portfolioId: string, holdingId: string, updates: { quantity?: number; average_cost?: number; cost_currency?: string }) =>
    patch<Holding>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`, updates),

  classifyHolding: (portfolioId: string, holdingId: string, bookType: PositionBook) =>
    patch<Holding>(
      `/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}/classification`,
      { book_type: bookType },
    ),

  removeHolding: (portfolioId: string, holdingId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/holdings/${encodeURIComponent(holdingId)}`),

  recurringBuys: (portfolioId: string) =>
    get<RecurringBuy[]>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/recurring-buys`, undefined, ACCOUNT_READ_CACHE_MS),

  addRecurringBuy: (portfolioId: string, payload: RecurringBuyRequest) =>
    post<RecurringBuy>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/recurring-buys`, payload, undefined, true),

  updateRecurringBuy: (portfolioId: string, recurringBuyId: string, payload: Partial<RecurringBuyRequest>) =>
    patch<RecurringBuy>(
      `/api/v1/portfolios/${encodeURIComponent(portfolioId)}/recurring-buys/${encodeURIComponent(recurringBuyId)}`,
      payload
    ),

  removeRecurringBuy: (portfolioId: string, recurringBuyId: string) =>
    del<void>(`/api/v1/portfolios/${encodeURIComponent(portfolioId)}/recurring-buys/${encodeURIComponent(recurringBuyId)}`),

  watchlists: () => get<Watchlist[]>("/api/v1/watchlists", undefined, ACCOUNT_READ_CACHE_MS),

  createWatchlist: (name: string) =>
    post<Watchlist>("/api/v1/watchlists", { name }, undefined, true),

  deleteWatchlist: (watchlistId: string) =>
    del<void>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}`),

  watchlistAssets: (watchlistId: string) =>
    get<WatchlistAsset[]>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets`, undefined, ACCOUNT_READ_CACHE_MS),

  addWatchlistAsset: (watchlistId: string, symbol: string, assetType = "equity") =>
    post<WatchlistAsset>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets`, { symbol, asset_type: assetType }, undefined, true),

  removeWatchlistAsset: (watchlistId: string, assetId: string) =>
    del<void>(`/api/v1/watchlists/${encodeURIComponent(watchlistId)}/assets/${encodeURIComponent(assetId)}`),

  paperAccounts: () => get<PaperAccount[]>("/api/v1/paper/accounts"),

  createPaperAccount: (payload: { name: string; base_currency?: string; initial_cash?: number }) =>
    post<PaperAccount>("/api/v1/paper/accounts", payload),

  paperAccountSnapshot: (accountId: string) =>
    get<PaperAccountSnapshot>(`/api/v1/paper/accounts/${encodeURIComponent(accountId)}/snapshot`),

  submitPaperOrder: (accountId: string, payload: PaperOrderRequest) =>
    post<PaperOrder>(`/api/v1/paper/accounts/${encodeURIComponent(accountId)}/orders`, payload),

  cancelPaperOrder: (orderId: string) =>
    post<PaperOrder>(`/api/v1/paper/orders/${encodeURIComponent(orderId)}/cancel`, {}),

  refreshPaperAccount: (accountId: string) =>
    post<PaperAccountSnapshot>(`/api/v1/paper/accounts/${encodeURIComponent(accountId)}/refresh`, {}),

  billingSubscription: () => get<BillingSubscription>("/api/v1/billing/subscription"),

  createCheckoutSession: (plan: AuthUser["plan"]) =>
    post<{ url: string }>("/api/v1/billing/create-checkout-session", { plan }),

  createCustomerPortalSession: (returnUrl?: string) =>
    post<{ url: string }>("/api/v1/billing/create-customer-portal-session", { return_url: returnUrl }),

  backtestStrategyOptions: () => get<StrategyOption[]>("/api/v1/backtests/strategies/options", undefined, DISCOVERY_READ_CACHE_MS),

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

  updateAlert: (alertId: string, payload: AlertUpdateRequest) =>
    patch<Alert>(`/api/v1/alerts/${encodeURIComponent(alertId)}`, payload),

  deleteAlert: (alertId: string) =>
    del<void>(`/api/v1/alerts/${encodeURIComponent(alertId)}`),

  alertEvents: () => get<AlertEvent[]>("/api/v1/alerts/events"),

  evaluateAlerts: () => post<{ evaluated: number; triggered: number }>("/api/v1/alerts/evaluate", {}),

  newsDigestPreferences: () => get<NewsDigestPreference>("/api/v1/news-digest/preferences"),

  updateNewsDigestPreferences: (payload: NewsDigestPreferenceRequest) =>
    put<NewsDigestPreference>("/api/v1/news-digest/preferences", payload),

  portfolioRisk: (portfolioId: string, book?: Exclude<PositionBook, "unclassified">) =>
    get<RiskSnapshotResult>(`/api/v1/risk/portfolios/${encodeURIComponent(portfolioId)}${book ? `?book=${encodeURIComponent(book)}` : ""}`),

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
  chat: (message: string, sessionId = "default", remember = true, mode: AgentChatMode = "sabi", signal?: AbortSignal, useMemory = true) =>
    post<ChatResponse>("/api/v1/agent/chat", { message, session_id: sessionId, remember, mode, use_memory: useMemory }, signal),

  /** Queue AI chat work and poll the job status/result */
  chatJob: (message: string, sessionId = "default", remember = true, mode: AgentChatMode = "sabi", signal?: AbortSignal, useMemory = true) =>
    post<ChatJobCreateResponse>("/api/v1/agent/chat/jobs", { message, session_id: sessionId, remember, mode, use_memory: useMemory }, signal),

  chatJobStatus: (jobId: string, signal?: AbortSignal, after = 0) =>
    get<ChatJobStatusResponse>(`/api/v1/agent/chat/jobs/${encodeURIComponent(jobId)}?after=${after}`, signal),

  streamChatJobEvents: (jobId: string, after: number, onEvent: (event: AgentActivityEvent, sequence: number) => void, signal?: AbortSignal) =>
    streamSse<AgentActivityEvent>(`/api/v1/agent/chat/jobs/${encodeURIComponent(jobId)}/events?after=${after}`, (event, sequence) => onEvent(event, sequence), signal),

  waitForChatJob: async (jobId: string, onUpdate?: (job: ChatJobStatusResponse) => void, intervalMs = 1500, signal?: AbortSignal, timeoutMs = 10 * 60 * 1000) => {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      signal?.throwIfAborted();
      if (Date.now() >= deadline) throw new Error("Chat job timed out");
      const job = await api.chatJobStatus(jobId, signal);
      onUpdate?.(job);

      if (job.status === "succeeded") {
        return job.result ?? { response: "", session_id: "default" };
      }

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.error?.message ?? `Chat job ${job.status}`);
      }

      await abortableDelay(intervalMs, signal);
    }
  },

  /** Full Quanfora 2.0 multi-agent consensus with metadata */
  consensus: (message: string, sessionId = "default", remember = true) =>
    post<ConsensusResponse>("/api/v1/agent/consensus", { message, session_id: sessionId, remember }),

  /** Quanfora 2.1 Equity Research Desk */
  createEquityResearchRun: (payload: EquityResearchRunCreate, signal?: AbortSignal) =>
    post<EquityResearchRun>("/api/v1/equity-research/runs", payload, signal),

  equityResearchRun: (runId: string, signal?: AbortSignal) =>
    get<EquityResearchRunDetail>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}`, signal),

  equityResearchReports: (runId: string) =>
    get<EquityResearchReport[]>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/reports`),

  equityResearchEvents: (runId: string, after = 0, signal?: AbortSignal) =>
    get<EquityResearchEventsList>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/events/list?after=${after}`, signal),

  streamEquityResearchEvents: (runId: string, after: number, onEvent: (event: EquityResearchEvent, sequence: number) => void, signal?: AbortSignal) =>
    streamSse<EquityResearchEvent>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/events?after=${after}`, (event, sequence) => onEvent(event, sequence), signal),

  shareEquityResearchRun: (runId: string, shared = true) =>
    patch<EquityResearchRun>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}/share`, { shared }),

  deleteEquityResearchRun: (runId: string) =>
    del<void>(`/api/v1/equity-research/runs/${encodeURIComponent(runId)}`),

  publicEquityResearchReport: (shareSlug: string) =>
    get<PublicEquityResearchReport>(`/api/v1/equity-research/shared/${encodeURIComponent(shareSlug)}`),

  /** Conversation sessions */
  chatSessions: () => get<ChatSession[]>("/api/v1/agent/sessions", undefined, ACCOUNT_READ_CACHE_MS),

  createChatSession: (sessionId: string, title = "New chat") =>
    post<ChatSession>("/api/v1/agent/sessions", { session_id: sessionId, title }, undefined, true),

  chatSessionMessages: (sessionId = "default") =>
    get<ChatSessionMessages>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`),

  appendChatSessionMessage: (sessionId: string, role: "user" | "assistant", content: string, metadata?: ChatMessage["metadata"], extractMemory = false) =>
    post<{ status: string; session_id: string; source_message_id: string; memory_status?: ChatResponse["memory_status"] | null }>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`, { role, content, metadata, extract_memory: extractMemory }),

  truncateChatSessionMessages: (sessionId: string, keepCount: number) =>
    patch<{ status: string; session_id: string; removed_count: number }>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}/messages`, { keep_count: keepCount }),

  renameChatSession: (sessionId: string, title: string) =>
    patch<ChatSession>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}`, { title }),

  deleteChatSession: (sessionId: string) =>
    del<{ status: string; session_id: string }>(`/api/v1/agent/sessions/${encodeURIComponent(sessionId)}`),

  /** User-controlled conversational memory */
  memories: (status: MemoryStatus | "all" = "confirmed", sessionId?: string) =>
    get<MemoryListResponse>(`/api/v1/agent/memories?status=${encodeURIComponent(status)}${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ""}`),

  createMemory: (payload: { category: MemoryCategory; label: string; value_json: Record<string, unknown> }) =>
    post<UserMemory>("/api/v1/agent/memories", payload, undefined, true),

  updateMemory: (memoryId: string, payload: { label?: string; value_json?: Record<string, unknown> }) =>
    patch<UserMemory>(`/api/v1/agent/memories/${encodeURIComponent(memoryId)}`, payload),

  confirmMemory: (memoryId: string) =>
    post<UserMemory>(`/api/v1/agent/memories/${encodeURIComponent(memoryId)}/confirm`, {}, undefined, true),

  rejectMemory: (memoryId: string) =>
    post<UserMemory>(`/api/v1/agent/memories/${encodeURIComponent(memoryId)}/reject`, {}, undefined, true),

  deleteMemory: (memoryId: string) =>
    del<{ status: string; memory_id: string }>(`/api/v1/agent/memories/${encodeURIComponent(memoryId)}`),

  clearMemories: () =>
    del<{ status: string; deleted_count: number }>("/api/v1/agent/memories"),

  updateMemorySettings: (enabled: boolean) =>
    patch<MemorySettings>("/api/v1/agent/memories/settings", { enabled }),

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

  earningsCalendar: (from: string, to: string, symbols: string[] = [], limit = 100) => {
    const query = new URLSearchParams({ from, to, limit: String(limit) });
    if (symbols.length) query.set("symbols", symbols.join(","));
    return get<EarningsCalendarResponse>(`/api/v1/market/earnings?${query.toString()}`);
  },

  cryptoOverview: (base: string, quote = "CAD") =>
    get<CryptoOverview>(`/api/v1/crypto/assets/${encodeURIComponent(base)}/overview?quote=${encodeURIComponent(quote)}`),

  cryptoSeries: (base: string, quote = "CAD", range = "1Y") =>
    get<CryptoSeries>(`/api/v1/crypto/assets/${encodeURIComponent(base)}/series?quote=${encodeURIComponent(quote)}&range=${encodeURIComponent(range)}`),

  cryptoContext: (base: string, quote = "CAD", sentimentRange = "30D") =>
    get<CryptoContext>(`/api/v1/crypto/assets/${encodeURIComponent(base)}/context?quote=${encodeURIComponent(quote)}&sentiment_range=${encodeURIComponent(sentimentRange)}`),

  marketSearch: (query: string, limit = 12) =>
    get<MarketSymbolSearchResult[]>(`/api/v1/market/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  /** News */
  newsCategories: () => get<CategoryInfo[]>("/api/v1/news/categories", undefined, DISCOVERY_READ_CACHE_MS),

  news: (categories: string[], limit = 20) =>
    get<NewsResponse>(`/api/v1/news?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`, undefined, DISCOVERY_READ_CACHE_MS),

  marketIntelligence: (categories: string[], limit = 30) =>
    get<MarketIntelligenceResponse>(`/api/v1/market-intelligence?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`, undefined, DISCOVERY_READ_CACHE_MS),

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
  score_breakdown?: ImpactScoreBreakdown | null;
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
