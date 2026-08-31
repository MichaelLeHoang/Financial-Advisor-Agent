"use client";

import { useRef, useEffect, useId, useMemo, useState } from "react";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Brain, Check, ChevronDown, Clipboard, ClipboardList, FileText, Image, Loader2, Paperclip, Pencil, PieChart, RotateCcw, Send, SlidersHorizontal, ThumbsDown, ThumbsUp, TableProperties, TrendingUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "motion/react";
import { api, isRedisUnavailableError, isUpgradeRequiredError } from "@/lib/api";
import type { AgentActivitySource, AgentActivityTrace, AiDeskMode, ChatJobProgress, ChatJobStatusResponse, ChatResponse, ConsensusOpinion, EquityResearchEvent, EquityResearchReport, EquityResearchRunDetail, GroundingMetadata, MemoryContextUsage, Overview, ResearchDepth, ResearchReportType, SabiCapability, UserMemory } from "@/lib/api";
import { notifyCompletion, requestCompletionNotification } from "@/lib/completion-notifications";
import { loadLocalChatMessages, saveLocalChatMessages } from "@/lib/local-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import ModelSelector, { useModel, apiModeFromVersion } from "@/components/ModelSelector";
import AgentMemoryDialog, { MemoryCandidateCard } from "@/components/AgentMemoryDialog";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { LoadingRegion, SkeletonBlock, SkeletonText } from "@/components/ui/DataLoading";
import { Textarea } from "@/components/ui/textarea";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { OverviewCard } from "@/components/ui/overview-card";
import Markdown from "@/components/ui/markdown";
import { showToast } from "@/components/ui/toast";
import { PromptNavigator, promptAnchorId } from "@/components/chat/PromptNavigator";
import { AgentActivityDrawer, AgentActivitySummary, AgentSources } from "@/components/chat/AgentActivityTrace";
import { activityFromTrace, emptyActivity, mergeSources, reduceActivity, researchActivityEvents, type LiveAgentActivity } from "@/lib/agent-activity";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "fetching" | "done";
  researchTicker?: string;
  researchRunId?: string;
  researchReports?: EquityResearchReport[];
  consensusOpinions?: ConsensusOpinion[];
  overview?: Overview | null;
  selectedCapability?: SabiCapability;
  grounding?: GroundingMetadata;
  sourceMessageId?: string | null;
  memoryUsed?: MemoryContextUsage[];
  memoryCandidates?: UserMemory[];
  activity?: LiveAgentActivity;
}

type MessageFeedback = "up" | "down" | null;

function MessageActionButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const tooltipId = useId();

  return (
    <span className="group/message-action relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        aria-describedby={tooltipId}
        className={cn(
          "grid size-8 place-items-center rounded-lg transition-colors duration-150 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none",
          active && "bg-white/[0.12] text-white"
        )}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#242529] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.36)] transition-[opacity,transform] duration-150 group-hover/message-action:translate-y-0 group-hover/message-action:opacity-100 group-focus-within/message-action:translate-y-0 group-focus-within/message-action:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  );
}

const GREETING: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hello. I can help with market research, portfolio analysis, and financial news.",
};

function messageFromChatHistory(message: {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  metadata?: { consensus?: { opinions?: ConsensusOpinion[] }; researchReports?: EquityResearchReport[]; overview?: Overview | null; selected_capability?: SabiCapability; grounding?: GroundingMetadata; source_message_id?: string | null; memory_used?: MemoryContextUsage[]; activity_trace?: AgentActivityTrace } | null;
  consensusOpinions?: ConsensusOpinion[];
  researchReports?: EquityResearchReport[];
  overview?: Overview | null;
  selectedCapability?: SabiCapability;
  grounding?: GroundingMetadata;
  sourceMessageId?: string | null;
  memoryUsed?: MemoryContextUsage[];
  activity?: AgentActivityTrace;
}): Message {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    consensusOpinions: message.consensusOpinions ?? message.metadata?.consensus?.opinions,
    researchReports: message.researchReports ?? message.metadata?.researchReports,
    overview: message.overview ?? message.metadata?.overview,
    selectedCapability: message.selectedCapability ?? message.metadata?.selected_capability,
    grounding: message.grounding ?? message.metadata?.grounding,
    sourceMessageId: message.sourceMessageId ?? message.metadata?.source_message_id,
    memoryUsed: message.memoryUsed ?? message.metadata?.memory_used,
    activity: activityFromTrace(message.activity ?? message.metadata?.activity_trace),
  };
}

function messageActivitySources(message: Message): AgentActivitySource[] {
  const grounding = message.grounding?.sources.map((source, index) => ({
    source_id: source.url || `grounding-${index}-${source.source}`,
    title: source.label,
    provider: source.source,
    url: source.url,
    published_at: source.published_at,
  })) ?? [];
  const overview = message.overview?.sources.map((source, index) => ({
    source_id: source.url || `overview-${index}-${source.source}`,
    title: source.label,
    provider: source.source,
    url: source.url,
  })) ?? [];
  const research = message.researchReports?.flatMap((report) => report.evidence).map((source, index) => ({
    source_id: source.url || `research-${index}-${source.source}`,
    title: source.label,
    provider: source.source,
    url: source.url,
    preview: source.detail,
  })) ?? [];
  return mergeSources(message.activity?.sources, grounding, overview, research);
}

const SUGGESTIONS = [
  {
    title: "Market pulse",
    description: "Scan major indices and momentum before the next session.",
    prompt: "Give me a concise market pulse for today with major risks and opportunities.",
    icon: TrendingUp,
  },
  {
    title: "Sentiment brief",
    description: "Summarize the narrative behind a ticker using recent headlines.",
    prompt: "Analyze AAPL sentiment and explain what could move the stock next.",
    icon: Brain,
  },
  {
    title: "Portfolio check",
    description: "Review allocation, risk, and rebalance ideas for core holdings.",
    prompt: "Optimize my portfolio with AAPL, MSFT, GOOGL and explain the tradeoffs.",
    icon: PieChart,
  },
];

function extractResearchCommand(message: string) {
  const match = message.trim().match(/^\/(?:research|analyze)\s+([A-Za-z][A-Za-z0-9.-]{0,14})(.*)$/i);
  if (!match) return null;
  const rest = match[2] ?? "";
  const depth = rest.match(/\b(deep|medium|shallow)\b/i)?.[1]?.toLowerCase() ?? "shallow";
  return {
    ticker: match[1].toUpperCase(),
    depth: depth as "shallow" | "medium" | "deep",
    reportType: detectResearchReportType(message),
  };
}

function isSabiResearchRequest(message: string) {
  return [
    /^\/(?:research|analyze)\b/i,
    /\b(?:create|generate|prepare|write|build|run)\s+(?:a\s+)?(?:(?:full|complete|deep|comprehensive)\s+)?(?:(?:investment|trading|equity|stock)\s+)?(?:research\s+)?report\b/i,
    /\b(?:full|complete|deep|comprehensive)\s+(?:investment\s+|trading\s+|equity\s+)?research\b/i,
  ].some((pattern) => pattern.test(message));
}

function detectResearchReportType(message: string): ResearchReportType {
  const lower = message.toLowerCase();
  return /\b(trade|trading|swing|scalp|entry|stop|stop-loss|setup|invalidation|breakout|breakdown|target)\b/.test(lower)
    ? "trading"
    : "investment";
}

type PredictionSummary = {
  mlDirection: string;
  valuationTarget: string;
  impliedUpside: string;
  finalSignal: string;
  modelPerformance: string;
  disclaimer: string;
};

function parsePredictionSummary(content: string): PredictionSummary | null {
  const normalizeLine = (line: string) =>
    line
      .trim()
      .replace(/^[-*]\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lines = content.split("\n").map(normalizeLine).filter(Boolean);
  const findValue = (labels: string[]) => {
    for (const line of lines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.+)$`, "i"));
        if (match?.[1]?.trim()) return match[1].trim();
      }
    }
    return "Unavailable";
  };

  const mlDirection = findValue(["ML Direction"]);
  const valuationTarget = findValue(["Valuation Target"]);
  const impliedUpside = findValue(["Implied Upside/Downside", "Expected move", "Expected Move"]);
  const finalSignal = findValue(["Final Signal"]);
  const performanceLine =
    lines.find((line) => /^Weighted Ensemble:/i.test(line))
    || lines.find((line) => /^Random Forest:/i.test(line))
    || lines.find((line) => /^LSTM:/i.test(line))
    || lines.find((line) => /^Model Performance:/i.test(line) && !line.endsWith(":"))
    || lines.find((line) => /^Model Breakdown:/i.test(line) && !line.endsWith(":"))
    || "";
  const confidenceLine = lines.find((line) => /^Confidence:/i.test(line))?.replace(/\.$/, "") || "";
  const disclaimer =
    lines.find((line) => line.includes("not professional financial advice") || line.includes("not financial advice")) ||
    "This is educational analysis, not financial advice.";
  const modelPerformance = [confidenceLine, performanceLine].filter(Boolean).join(" | ") || "Unavailable";
  const hasPredictionData = [mlDirection, valuationTarget, impliedUpside, finalSignal, modelPerformance].some((value) => value !== "Unavailable");

  if (!hasPredictionData) return null;

  return {
    mlDirection,
    valuationTarget,
    impliedUpside,
    finalSignal,
    modelPerformance,
    disclaimer,
  };
}

const TICKER_STOP_WORDS = new Set([
  "A",
  "AI",
  "API",
  "BUY",
  "CEO",
  "CFO",
  "EPS",
  "ETF",
  "GDP",
  "HOLD",
  "I",
  "IPO",
  "LLM",
  "MORE",
  "NOW",
  "PE",
  "RIGHT",
  "RISK",
  "SEC",
  "SELL",
  "SHARES",
  "STOCK",
  "THE",
  "US",
  "USA",
]);

function normalizeTickerCandidate(candidate: string | undefined) {
  const normalized = candidate?.replace(/^\$/, "").toUpperCase() ?? "";
  if (!normalized || TICKER_STOP_WORDS.has(normalized)) return null;
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized)) return null;
  return normalized;
}

function extractInvestmentTicker(message: string) {
  const lower = message.toLowerCase();
  const hasIntent = lower.includes("should i buy")
    || lower.includes("should i invest")
    || lower.includes("analyze ")
    || lower.includes("research ")
    || lower.includes("investment thesis")
    || lower.includes("invest in");
  if (!hasIntent) return null;
  const explicitTicker = message.match(/\$([A-Za-z][A-Za-z0-9.-]{0,14})\b/);
  const explicitMatch = normalizeTickerCandidate(explicitTicker?.[1]);
  if (explicitMatch) return explicitMatch;

  const phraseTicker = message.match(/\b(?:analyze|research|buy|invest in|should i buy|should i invest in)\s+([A-Z][A-Z0-9.-]{1,14})\b/i);
  const phraseMatch = normalizeTickerCandidate(phraseTicker?.[1]);
  if (phraseMatch) return phraseMatch;

  const candidates = message.match(/\b[A-Z][A-Z0-9.-]{1,14}\b/g) ?? [];
  return candidates.map(normalizeTickerCandidate).find(Boolean) ?? null;
}

function extractTickerForResearch(message: string) {
  const command = extractResearchCommand(message);
  if (command) return command.ticker;
  const intentTicker = extractInvestmentTicker(message);
  if (intentTicker) return intentTicker.toUpperCase();
  const explicitTicker = message.match(/\$([A-Za-z][A-Za-z0-9.-]{0,14})\b/);
  if (explicitTicker) return normalizeTickerCandidate(explicitTicker[1]);
  return null;
}

const RESEARCH_PUBLIC_QUOTE_TYPES = new Set(["equity", "stock", "etf", "fund"]);

function extractResearchSearchQuery(message: string) {
  const cleaned = message.replace(/[?!.]+$/g, "").trim();
  const patterns = [
    /\b(?:of|for|on|about)\s+([A-Za-z][A-Za-z0-9 .&-]{1,80}?)\s+(?:stock|shares?|ticker)\b/i,
    /\b(?:analyze|research|forecast|predict)\s+([A-Za-z][A-Za-z0-9 .&-]{1,80}?)\s+(?:stock|shares?|ticker)?\b/i,
    /\b([A-Za-z][A-Za-z0-9 .&-]{1,80}?)\s+(?:stock|shares?|ticker)\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const entity = match?.[1]?.replace(/\b(?:the|a|an|company|stock|shares?|price|percentage|increase|decrease|next|months?|year)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (entity && entity.length <= 80) return entity;
  }

  return cleaned.split(/\s+/).length <= 4 ? cleaned : null;
}

async function resolveResearchTicker(input: string) {
  const directTicker = normalizeTickerCandidate(input);
  const query = directTicker ?? extractResearchSearchQuery(input);
  if (!query) return directTicker;

  try {
    const matches = await api.marketSearch(query, 6);
    const candidate = matches.find((item) => RESEARCH_PUBLIC_QUOTE_TYPES.has((item.quote_type ?? "").toLowerCase())) ?? matches[0];
    return normalizeTickerCandidate(candidate?.ticker) ?? directTicker;
  } catch {
    return directTicker;
  }
}

const RESEARCH_EVENT_TOOL_BY_AGENT: Record<string, string> = {
  market: "market",
  social: "social",
  news: "news",
  fundamentals: "fundamentals",
  bull: "bull",
  bear: "bear",
  evaluator: "evaluator",
  trader: "trader",
  risky: "risky",
  neutral: "neutral",
  safe: "safe",
  pm: "pm",
};

function toolKeyFromResearchEvent(event: EquityResearchEvent) {
  if (event.agent_key && RESEARCH_EVENT_TOOL_BY_AGENT[event.agent_key]) {
    return RESEARCH_EVENT_TOOL_BY_AGENT[event.agent_key];
  }
  if (event.tool_name === "build_data_snapshot") return "equity_snapshot";
  if (event.label === "Snapshot ready" || event.label === "Snapshot") return "equity_snapshot";
  return null;
}

function isResearchStepStarting(event: EquityResearchEvent) {
  return event.event_type === "tool" || event.event_type === "reasoning";
}

function isResearchStepComplete(event: EquityResearchEvent) {
  return event.event_type === "report"
    || event.event_type === "final"
    || (event.event_type === "status" && (event.label === "Snapshot ready" || event.label === "Skipped"));
}

function finalResearchMarkdown(detail: EquityResearchRunDetail) {
  return detail.reports.find((report) => report.agent_key === "pm")?.markdown
    ?? detail.reports.find((report) => report.title.toLowerCase().includes("final"))?.markdown
    ?? "";
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Request aborted", "AbortError"));
    }, { once: true });
  });
}

const WORKFLOW_STEPS = [
  {
    title: "Research",
    detail: "Start with live quotes, market context, and a focused AI brief.",
    href: "/market",
    action: "Open market",
    icon: TrendingUp,
  },
  {
    title: "Risk",
    detail: "Move from ticker ideas into allocation, volatility, and Sharpe checks.",
    href: "/portfolio",
    action: "Check portfolio",
    icon: PieChart,
  },
  {
    title: "Narrative",
    detail: "Validate whether headlines support or contradict the trade thesis.",
    href: "/sentiment",
    action: "Run sentiment",
    icon: Brain,
  },
  {
    title: "Discipline",
    detail: "Track watchlists now, then turn the best setups into alerts and journal entries.",
    href: "/watchlist",
    action: "Review watchlist",
    icon: ClipboardList,
  },
];

const PLACEHOLDERS = [
  "Ask anything about markets, stocks, or your portfolio...",
  "Analyze AAPL sentiment from recent news...",
  "Run a multi-agent consensus on NVDA...",
  "Optimize my portfolio for lower correlation...",
  "What are the risks of holding SMCI right now?",
];

const PLACEHOLDER_CONTAINER_VARIANTS: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.006 } },
  exit: {
    transition: { staggerChildren: 0.003, staggerDirection: -1 },
  },
};

const PLACEHOLDER_LETTER_VARIANTS: Variants = {
  initial: { opacity: 0, filter: "blur(8px)", y: 6 },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    filter: "blur(8px)",
    y: -6,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
};

function sabiCapabilityLabel(capability: SabiCapability) {
  return capability === "trade_proposal"
    ? "Trade Proposal"
    : capability.charAt(0).toUpperCase() + capability.slice(1);
}

const RESEARCH_MODES: {
  depth: ResearchDepth;
  label: string;
  tagline: string;
  minPlan: "free" | "pro" | "trader";
}[] = [
  {
    depth: "shallow",
    label: "Shallow",
    tagline: "Fast ticker snapshot and compact verdict.",
    minPlan: "free",
  },
  {
    depth: "medium",
    label: "Medium",
    tagline: "Broader analyst coverage for signed-in research.",
    minPlan: "pro",
  },
  {
    depth: "deep",
    label: "Deep",
    tagline: "Full research pass for active trading decisions.",
    minPlan: "trader",
  },
];

const PLAN_RANK = {
  free: 0,
  pro: 1,
  trader: 2,
  quant: 3,
  execution_addon: 4,
} as const;

function canUseResearchMode(plan: keyof typeof PLAN_RANK, depth: ResearchDepth) {
  const mode = RESEARCH_MODES.find((item) => item.depth === depth);
  return mode ? PLAN_RANK[plan] >= PLAN_RANK[mode.minPlan] : false;
}

function bestResearchModeForPlan(plan: keyof typeof PLAN_RANK, requested: ResearchDepth) {
  if (canUseResearchMode(plan, requested)) return requested;
  return [...RESEARCH_MODES].reverse().find((mode) => canUseResearchMode(plan, mode.depth))?.depth ?? "shallow";
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const { version } = useModel();
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ sessionId?: string | string[] }>();
  const searchParams = useSearchParams();
  const routeSessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const activeSessionId = routeSessionId ? decodeURIComponent(routeSessionId) : searchParams.get("session") || "default";
  const promptParam = searchParams.get("prompt");
  const [messages, setMessages] = useState<Message[]>(() =>
    activeSessionId === "default" ? [GREETING] : []
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, MessageFeedback>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [activityDrawerRunId, setActivityDrawerRunId] = useState<string | null>(null);
  const [memoryAnnouncement, setMemoryAnnouncement] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedPromptRef = useRef<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [agentRunState, setAgentRunState] = useState<"queued" | "running">("running");
  const [activePlanMode, setActivePlanMode] = useState<"single" | "consensus" | "research">("single");
  const [liveActivity, setLiveActivity] = useState<LiveAgentActivity | null>(null);
  const liveActivityRef = useRef<LiveAgentActivity | null>(null);
  const lastActivitySequenceRef = useRef(0);
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("shallow");
  const lastJobProgressSequenceRef = useRef(0);
  const progressEventQueueRef = useRef<ChatJobProgress[]>([]);
  const progressDrainActiveRef = useRef(false);
  const progressDrainPromiseRef = useRef<Promise<void> | null>(null);
  const notifyWhenCompleteRef = useRef(false);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const pendingSessionIdRef = useRef<string | null>(null);
  const firstName = getFirstName(user?.display_name || user?.email || "");
  const [welcomeGreeting] = useState(() => (Math.random() > 0.5 ? "Hello" : "Hi"));

  const showLongRunningToast = (message: string) => {
    notifyWhenCompleteRef.current = false;
    showToast({
      title: "Analysis running",
      message,
      duration: 9000,
      actions: {
        label: "Notify me",
        variant: "outline",
        onClick: () => {
          void requestCompletionNotification().then((enabled) => {
            notifyWhenCompleteRef.current = enabled;
            showToast({
              title: enabled ? "Notifications on" : "Notifications unavailable",
              message: enabled
                ? "I will notify you when this analysis is done."
                : "Browser notifications are not available or permission was denied.",
              variant: enabled ? "success" : "warning",
            });
          });
        },
      },
    });
  };

  const finishLongRunningToast = (success: boolean, title: string, message: string) => {
    showToast({
      title,
      message,
      variant: success ? "success" : "error",
      duration: 6000,
    });
    if (notifyWhenCompleteRef.current) {
      notifyCompletion(title, message);
      notifyWhenCompleteRef.current = false;
    }
  };

  useEffect(() => {
    setResearchDepth((current) => bestResearchModeForPlan(user.plan, current));
  }, [user.plan]);

  useEffect(() => {
    const handlePrivacyReset = () => {
      activeRequestControllerRef.current?.abort();
      activeRequestControllerRef.current = null;
      isStreamingRef.current = false;
      setMessages([GREETING]);
      setInput("");
      setIsLoading(false);
      setIsHistoryLoading(false);
      setUpgradeMessage(null);
      setAgentRunState("running");
      setActivePlanMode("single");
      setMemoryDialogOpen(false);
      setActivityDrawerRunId(null);
      setMemoryAnnouncement("");
      lastJobProgressSequenceRef.current = 0;
      progressEventQueueRef.current = [];
      progressDrainActiveRef.current = false;
      progressDrainPromiseRef.current = null;
      appliedPromptRef.current = null;
      router.replace("/session");
    };

    window.addEventListener("chat-privacy:reset", handlePrivacyReset);
    return () => window.removeEventListener("chat-privacy:reset", handlePrivacyReset);
  }, [router]);

  useEffect(() => () => activeRequestControllerRef.current?.abort(), []);

  useEffect(() => {
    const handleFocusInput = () => {
      setIsActive(true);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    };

    window.addEventListener("chat-input:focus", handleFocusInput);
    return () => window.removeEventListener("chat-input:focus", handleFocusInput);
  }, []);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input]);

  useEffect(() => {
    if (isActive || input) return;
    let revealTimer: number | undefined;
    const interval = window.setInterval(() => {
      setShowPlaceholder(false);
      revealTimer = window.setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, prefersReducedMotion ? 0 : 400);
    }, 4000);
    return () => {
      window.clearInterval(interval);
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
    };
  }, [isActive, input, prefersReducedMotion]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!input) {
          setIsActive(false);
          setShowPlaceholder(true);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [input]);

  useEffect(() => {
    if (!uploadMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!uploadMenuRef.current?.contains(target) && !uploadTriggerRef.current?.contains(target)) {
        setUploadMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUploadMenuOpen(false);
        uploadTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [uploadMenuOpen]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // The first prompt creates the real session id before the request completes.
    // Keep the optimistic messages instead of replacing them with a history load.
    if (pendingSessionIdRef.current === activeSessionId) {
      pendingSessionIdRef.current = null;
      setIsHistoryLoading(false);
      return;
    }

    async function loadSession() {
      setIsHistoryLoading(true);
      setUpgradeMessage(null);

      try {
        if (activeSessionId === "default") {
          if (!cancelled) setMessages([GREETING]);
          return;
        }

        if (user.is_guest) {
          const localMessages = loadLocalChatMessages(activeSessionId).map(messageFromChatHistory);
          if (!cancelled) setMessages(localMessages.length > 0 ? localMessages : [GREETING]);
          return;
        }

        const [res, pendingMemories] = await Promise.all([
          api.chatSessionMessages(activeSessionId),
          api.memories("candidate", activeSessionId).catch(() => null),
        ]);
        if (cancelled) return;

        const candidatesBySource = new Map<string, UserMemory[]>();
        for (const candidate of pendingMemories?.memories ?? []) {
          if (!candidate.source_message_id) continue;
          candidatesBySource.set(candidate.source_message_id, [
            ...(candidatesBySource.get(candidate.source_message_id) ?? []),
            candidate,
          ]);
        }
        const loadedMessages = res.messages.map(messageFromChatHistory).map((message) => ({
          ...message,
          memoryCandidates: message.sourceMessageId
            ? candidatesBySource.get(message.sourceMessageId)
            : undefined,
        }));
        setMessages(loadedMessages.length > 0 ? loadedMessages : [GREETING]);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.status === 404 || err?.status === 401) {
          setMessages([GREETING]);
          router.replace("/session");
          return;
        }
        setMessages([{
          id: "history-error",
          role: "assistant",
          content: `Unable to load this chat history: ${err.message}`,
        }]);
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    }

    loadSession();
    setInput("");

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, authLoading, router, user.id, user.is_guest]);

  useEffect(() => {
    if (authLoading || !user.is_guest || isHistoryLoading) return;
    if (activeSessionId === "default") return;
    if (!messages.some((message) => message.role === "user")) return;

    saveLocalChatMessages(activeSessionId, messages);
    window.dispatchEvent(new Event("chat-sessions:changed"));
  }, [activeSessionId, authLoading, isHistoryLoading, messages, user.id, user.is_guest]);

  useEffect(() => {
    const prompt = promptParam?.trim();
    if (!prompt) return;

    const key = `${activeSessionId}:${prompt}`;
    if (appliedPromptRef.current === key) return;
    appliedPromptRef.current = key;

    setInput(prompt);
    setIsActive(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [activeSessionId, promptParam]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isStreamingRef = useRef(false);

  const resetLiveActivity = (runId: string, mode: string, status: "queued" | "running" = "queued") => {
    const next = {
      ...emptyActivity(runId, mode),
      status,
      started_at: status === "running" ? new Date().toISOString() : undefined,
    } as LiveAgentActivity;
    lastActivitySequenceRef.current = 0;
    liveActivityRef.current = next;
    setLiveActivity(next);
  };

  const applyActivityEvent = (
    event: import("@/lib/api").AgentActivityEvent,
    deduplicateBySequence = true,
  ) => {
    if (deduplicateBySequence && event.sequence && event.sequence <= lastActivitySequenceRef.current) return;
    if (deduplicateBySequence) {
      lastActivitySequenceRef.current = Math.max(lastActivitySequenceRef.current, event.sequence || 0);
    }
    const next = reduceActivity(liveActivityRef.current, event);
    liveActivityRef.current = next;
    setLiveActivity(next);
  };

  const applyProgressEvent = (progress: ChatJobProgress, job: ChatJobStatusResponse, fallbackLabel: string) => {
    setActivePlanMode(progress.mode);
    setAgentRunState(job.status === "queued" ? "queued" : "running");
    const content = progress.message || progress.active_label || fallbackLabel;
    setMessages((prev) =>
      prev.map((m) =>
        m.status === "fetching"
          ? { ...m, content }
          : m
      )
    );
  };

  const drainProgressEvents = (job: ChatJobStatusResponse, fallbackLabel: string) => {
    if (progressDrainActiveRef.current) return;
    progressDrainActiveRef.current = true;

    progressDrainPromiseRef.current = (async () => {
      while (progressEventQueueRef.current.length > 0) {
        const event = progressEventQueueRef.current.shift();
        if (event) {
          applyProgressEvent(event, job, fallbackLabel);
          await delay(160);
        }
      }
      progressDrainActiveRef.current = false;
      progressDrainPromiseRef.current = null;
    })();
  };

  const enqueueJobProgress = (job: ChatJobStatusResponse, fallbackLabel: string) => {
    const rawEvents = job.progress_events?.length ? job.progress_events : job.progress ? [job.progress] : [];
    const newEvents = rawEvents
      .filter((event) => event.sequence > lastJobProgressSequenceRef.current)
      .sort((a, b) => a.sequence - b.sequence);
    if (newEvents.length === 0) return Boolean(job.progress);

    lastJobProgressSequenceRef.current = newEvents[newEvents.length - 1].sequence;
    progressEventQueueRef.current = [...progressEventQueueRef.current, ...newEvents];
    drainProgressEvents(job, fallbackLabel);
    return true;
  };

  const pollMemoryCandidates = async (
    sessionId: string,
    sourceMessageId: string,
    assistantMessageId: string,
  ) => {
    for (const waitMs of [900, 1800, 3200]) {
      await delay(waitMs).catch(() => undefined);
      try {
        const response = await api.memories("candidate", sessionId);
        const candidates = response.memories.filter(
          (memory) => memory.source_message_id === sourceMessageId,
        );
        if (candidates.length === 0) continue;
        setMessages((current) => current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, memoryCandidates: candidates }
            : message
        ));
        setMemoryAnnouncement(
          `${candidates.length} memory suggestion${candidates.length === 1 ? " is" : "s are"} ready for review.`,
        );
        return;
      } catch {
        // Memory extraction is optional and must never interrupt the answer.
      }
    }
  };

  const handleSend = async (prompt?: string, options: { useMemory?: boolean } = {}) => {
    const text = (prompt ?? input).trim();
    if (!text || isLoading) return;
    const useMemory = options.useMemory ?? true;
    const requestController = new AbortController();
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = requestController;
    const { signal } = requestController;
    if (!prompt) setInput("");

    // Guard the session-load effect before router.replace fires
    isStreamingRef.current = true;

    let targetSessionId = activeSessionId;
    if (activeSessionId === "default") {
      targetSessionId = typeof crypto !== "undefined" && "randomUUID" in crypto 
        ? crypto.randomUUID() 
        : `session-${Date.now()}`;
      pendingSessionIdRef.current = targetSessionId;
      const chatBasePath = pathname.startsWith("/ai") ? "/ai" : "/session";
      window.history.replaceState(null, "", `${chatBasePath}/${encodeURIComponent(targetSessionId)}`);
    }

    const getUniqueId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`;

    const userMsg: Message = { id: getUniqueId(), role: "user", content: text };
    const researchCommand = extractResearchCommand(text);
    const investmentTicker = researchCommand?.ticker ?? extractInvestmentTicker(text);

    if (researchCommand || version === "2.1" || (version === "sabi" && isSabiResearchRequest(text))) {
      const seedTicker = researchCommand?.ticker ?? extractTickerForResearch(text);
      let ticker = await resolveResearchTicker(seedTicker ?? text);
      if (signal.aborted) return;
      if (!ticker && seedTicker) {
        ticker = await resolveResearchTicker(text);
        if (signal.aborted) return;
      }
      if (!ticker) {
        setMessages((prev) => [...prev, userMsg, {
          id: getUniqueId(),
          role: "assistant",
          content: "Quanfora 2.1 needs a public ticker to start a full Equity Research Desk run. I could not resolve one from that prompt. Try `SPCX`, `AAPL`, `NVDA`, or `/analyze MSFT deep`.",
        }]);
        isStreamingRef.current = false;
        activeRequestControllerRef.current = null;
        return;
      }
      setMessages((prev) => [...prev, userMsg, { id: getUniqueId(), role: "assistant", content: "Creating Quanfora 2.1 research run...", status: "fetching" }]);
      setIsLoading(true);
      setUpgradeMessage(null);
      setAgentRunState("running");
      setActivePlanMode("research");
      showLongRunningToast("Quanfora 2.1 research may take a little while.");
      try {
        const reportType = researchCommand?.reportType ?? detectResearchReportType(text);
        const run = await api.createEquityResearchRun({
          ticker,
          report_type: reportType,
          research_depth: researchCommand?.depth ?? bestResearchModeForPlan(user.plan, researchDepth),
          source_surface: "ai_advisor",
          use_memory: useMemory,
        }, signal);
        resetLiveActivity(run.run_id, "research", "running");
        let cursor = 0;
        let latestDetail: EquityResearchRunDetail | null = null;
        let streamAttempts = 0;
        while (streamAttempts < 3) {
          try {
            const streamedCursor = await api.streamEquityResearchEvents(
              run.run_id,
              cursor,
              (event, sequence) => {
                cursor = Math.max(cursor, sequence);
                for (const activityEvent of researchActivityEvents(event, sequence)) {
                  applyActivityEvent(activityEvent, false);
                }
                if (event.agent_name && event.event_type === "reasoning") {
                  setMessages((prev) => prev.map((message) => message.status === "fetching" ? { ...message, content: `${event.agent_name} is working...` } : message));
                }
              },
              signal,
            );
            cursor = Math.max(cursor, streamedCursor);
          } catch (error) {
            if (signal.aborted) throw error;
          }
          latestDetail = await api.equityResearchRun(run.run_id, signal);
          if (["completed", "failed", "cancelled"].includes(latestDetail.run.status)) break;
          streamAttempts += 1;
          await delay(400 * 2 ** streamAttempts, signal);
        }

        while (latestDetail && !["completed", "failed", "cancelled"].includes(latestDetail.run.status)) {
          const [detail, eventList] = await Promise.all([
            api.equityResearchRun(run.run_id, signal),
            api.equityResearchEvents(run.run_id, cursor, signal),
          ]);
          latestDetail = detail;
          for (const event of eventList.events) {
            cursor += 1;
            for (const activityEvent of researchActivityEvents(event, cursor)) {
              applyActivityEvent(activityEvent, false);
            }
          }
          cursor = Math.max(cursor, eventList.cursor);
          if (!["completed", "failed", "cancelled"].includes(detail.run.status)) await delay(750, signal);
        }

        if (!latestDetail || latestDetail.run.status !== "completed") {
          throw new Error(latestDetail?.run.error_message || `Research run ${latestDetail?.run.status ?? "failed"}`);
        }

        const finalMarkdown = finalResearchMarkdown(latestDetail);
        if (!finalMarkdown) {
          throw new Error("The research run completed but the final decision report was unavailable.");
        }

        const finalAssistantId = getUniqueId();
        let researchSourceMessageId: string | null = null;
        let researchMemoryStatus: ChatResponse["memory_status"] | null = null;
        if (!user.is_guest) {
          const savedUserMessage = await api.appendChatSessionMessage(
            targetSessionId,
            "user",
            text,
            undefined,
            useMemory,
          );
          researchSourceMessageId = savedUserMessage.source_message_id;
          researchMemoryStatus = savedUserMessage.memory_status ?? null;
          await api.appendChatSessionMessage(targetSessionId, "assistant", finalMarkdown, {
            researchReports: latestDetail.reports,
            overview: latestDetail.overview,
            source_message_id: researchSourceMessageId,
            activity_trace: liveActivityRef.current ?? undefined,
            ...(version === "sabi" ? {
              selected_mode: "sabi" as const,
              selected_capability: "research" as const,
              action_status: "analysis_only" as const,
            } : {}),
          });
        }
        setMessages((prev) =>
          prev.filter((m) => m.status !== "fetching").concat({
            id: finalAssistantId,
            role: "assistant",
            content: finalMarkdown,
            researchTicker: latestDetail.run.ticker,
            researchRunId: latestDetail.run.run_id,
            researchReports: latestDetail.reports,
            overview: latestDetail.overview,
            selectedCapability: version === "sabi" ? "research" : undefined,
            sourceMessageId: researchSourceMessageId,
            activity: liveActivityRef.current ?? undefined,
          })
        );
        if (researchSourceMessageId && researchMemoryStatus === "maintenance_queued") {
          void pollMemoryCandidates(targetSessionId, researchSourceMessageId, finalAssistantId);
        }
        finishLongRunningToast(
          true,
          "Analysis complete",
          `${latestDetail.run.ticker} Quanfora 2.1 research is ready.`
        );
        window.dispatchEvent(new Event("chat-sessions:changed"));
      } catch (err: any) {
        if (signal.aborted) return;
        setMessages((prev) =>
          prev.filter((m) => m.status !== "fetching").concat({
            id: getUniqueId(),
            role: "assistant",
            content: `Error: ${err.message}`,
          })
        );
        finishLongRunningToast(
          false,
          "Analysis failed",
          err instanceof Error ? err.message : "Quanfora 2.1 research could not be completed."
        );
      } finally {
        if (activeRequestControllerRef.current === requestController) {
          activeRequestControllerRef.current = null;
          setIsLoading(false);
          isStreamingRef.current = false;
          setAgentRunState("running");
        }
      }
      return;
    }

    const fetchingLabel = version === "sabi"
      ? "Sabi is choosing the right analysis..."
      : version === "2.0"
        ? "Running multi-agent consensus analysis..."
        : "Analyzing market context...";
    const mode = apiModeFromVersion(version);
    const shouldNotifyLongRun = mode === "consensus";
    const fetchingMsg: Message = { id: getUniqueId(), role: "assistant", content: fetchingLabel, status: "fetching" };

    setMessages((prev) => [...prev, userMsg, fetchingMsg]);
    setIsLoading(true);
    setUpgradeMessage(null);
    setAgentRunState("queued");
    setActivePlanMode(mode === "consensus" ? "consensus" : "single");
    lastJobProgressSequenceRef.current = 0;
    progressEventQueueRef.current = [];
    progressDrainActiveRef.current = false;
    progressDrainPromiseRef.current = null;
    if (shouldNotifyLongRun) {
      showLongRunningToast("Quanfora 2.0 consensus analysis may take a little while.");
    } else {
      notifyWhenCompleteRef.current = false;
    }

    const assistantMsgId = getUniqueId();

    try {
      const remember = !user.is_guest;
      let res: ChatResponse;
      try {
        const queued = await api.chatJob(text, targetSessionId, remember, mode, signal, useMemory);
        resetLiveActivity(queued.job_id, mode, "queued");
        let cursor = 0;
        let job: ChatJobStatusResponse | null = null;
        let streamAttempts = 0;

        const applyJobStatus = (status: ChatJobStatusResponse) => {
          for (const event of status.activity_events ?? []) applyActivityEvent(event);
          const appliedProgress = enqueueJobProgress(status, fetchingLabel);
          if (status.status === "queued") {
            setAgentRunState((current) => current === "running" ? "running" : "queued");
            const positionText = status.queue_position ? ` Position ${status.queue_position}.` : "";
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "fetching"
                  ? { ...m, content: `Queued for analysis.${positionText}` }
                  : m
                )
            );
          } else if (status.status === "running" && !appliedProgress) {
            setAgentRunState("running");
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "fetching"
                  ? { ...m, content: fetchingLabel }
                  : m
                )
            );
          }
        };

        while (streamAttempts < 3) {
          try {
            const streamedCursor = await api.streamChatJobEvents(
              queued.job_id,
              cursor,
              (event, sequence) => {
                cursor = Math.max(cursor, sequence);
                applyActivityEvent(event);
              },
              signal,
            );
            cursor = Math.max(cursor, streamedCursor);
          } catch (error) {
            if (signal.aborted) throw error;
          }
          job = await api.chatJobStatus(queued.job_id, signal, cursor);
          applyJobStatus(job);
          if (["succeeded", "failed", "cancelled"].includes(job.status)) break;
          streamAttempts += 1;
          await delay(400 * 2 ** streamAttempts, signal);
        }

        if (!job || !["succeeded", "failed", "cancelled"].includes(job.status)) {
          res = await api.waitForChatJob(queued.job_id, applyJobStatus, 750, signal);
        } else if (job.status === "succeeded") {
          res = job.result ?? { response: "", session_id: targetSessionId };
        } else {
          throw new Error(job.error?.message ?? `Chat job ${job.status}`);
        }
      } catch (queueError) {
        if (!isRedisUnavailableError(queueError)) throw queueError;
        setAgentRunState("running");
        resetLiveActivity(`direct-${assistantMsgId}`, mode, "running");
        setMessages((prev) =>
          prev.map((m) =>
            m.status === "fetching"
              ? { ...m, content: fetchingLabel }
              : m
          )
        );
        res = await api.chat(text, targetSessionId, remember, mode, signal, useMemory);
        const directActivity = activityFromTrace(res.activity_trace);
        if (directActivity) {
          liveActivityRef.current = directActivity;
          setLiveActivity(directActivity);
        }
      }
      const consensusOpinions = res.consensus?.opinions;
      const overview = res.overview;
      const selectedCapability = version === "sabi" ? res.selected_capability : undefined;
      const completedActivity = activityFromTrace(res.activity_trace)
        ?? activityFromTrace(liveActivityRef.current ? { ...liveActivityRef.current, status: "completed" as const } : undefined);

      // Never hold a completed answer open solely to finish decorative progress steps.
      progressEventQueueRef.current = [];

      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: assistantMsgId,
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't process that request.",
          consensusOpinions,
          overview,
          selectedCapability,
          grounding: res.grounding,
          sourceMessageId: res.source_message_id,
          memoryUsed: res.memory_used,
          activity: completedActivity,
        }).concat(investmentTicker ? [{
          id: getUniqueId(),
          role: "assistant",
          content: `Generate a full Quanfora 2.1 Research Report for ${investmentTicker}?`,
          researchTicker: investmentTicker,
        }] : [])
      );
      if (res.source_message_id && res.memory_status === "maintenance_queued") {
        void pollMemoryCandidates(targetSessionId, res.source_message_id, assistantMsgId);
      }
      if (shouldNotifyLongRun) {
        finishLongRunningToast(true, "Analysis complete", "Quanfora 2.0 consensus response is ready.");
      }
      window.dispatchEvent(new Event("chat-sessions:changed"));
    } catch (err: any) {
      if (signal.aborted) return;
      if (isUpgradeRequiredError(err)) {
        setUpgradeMessage(err.detail.message);
      }
      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: assistantMsgId,
          role: "assistant",
          content: isUpgradeRequiredError(err) ? err.detail.message : `Error: ${err.message}`,
        })
      );
      if (shouldNotifyLongRun) {
        finishLongRunningToast(
          false,
          "Analysis failed",
          isUpgradeRequiredError(err) ? err.detail.message : err instanceof Error ? err.message : "Quanfora 2.0 analysis could not be completed."
        );
      }
    } finally {
      if (activeRequestControllerRef.current === requestController) {
        activeRequestControllerRef.current = null;
        setIsLoading(false);
        isStreamingRef.current = false;
        setAgentRunState("running");
      }
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, type: "auto" | "document" | "data" | "image") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const effectiveType = type === "auto"
      ? file.type.startsWith("image/") ? "image" : "document"
      : type;

    if (effectiveType === "document" || effectiveType === "data") {
      const text = await file.text().catch(() => "");
      const preview = text.trim().slice(0, 1200);
      setInput((current) =>
        `${current}${current ? "\n\n" : ""}Attached ${file.name}${preview ? `:\n${preview}` : ". Please analyze this file."}`
      );
    } else {
      setInput((current) =>
        `${current}${current ? "\n\n" : ""}Attached image: ${file.name}. Please consider it in the financial analysis.`
      );
    }

    setIsActive(true);
    setUploadMenuOpen(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
    event.target.value = "";
  };

  const fillComposer = (prompt: string) => {
    setInput(prompt);
    setIsActive(true);
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
      textarea.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  };

  const hasConversation = messages.some((message) => message.id !== "welcome");
  const isStarterState = !hasConversation && !isHistoryLoading;
  const selectedDrawerActivity = useMemo(() => {
    if (!activityDrawerRunId) return null;
    if (liveActivity && (liveActivity.run_id === activityDrawerRunId || activityDrawerRunId === "preparing")) return liveActivity;
    return messages.find((message) => message.activity?.run_id === activityDrawerRunId)?.activity ?? null;
  }, [activityDrawerRunId, liveActivity, messages]);
  const promptNavigationItems = useMemo(
    () => messages
      .filter((message) => message.role === "user")
      .map((message) => ({ id: message.id, content: message.content })),
    [messages]
  );

  const copyResponse = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1500);
    } catch {
      showToast({ title: "Copy failed", message: "Your browser could not access the clipboard.", variant: "error" });
    }
  };

  const editMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingDraft(message.content);
  };

  const regenerateTurn = async (
    userMessage: Message,
    prompt: string,
    responseMessageId?: string,
    useMemory = true,
  ) => {
    const nextPrompt = prompt.trim();
    const messageIndex = messages.findIndex((item) => item.id === userMessage.id);
    if (!nextPrompt || messageIndex < 0 || isLoading || regeneratingMessageId) return;

    const keepMessages = messages.slice(0, messageIndex);
    const keepCount = keepMessages.filter((item) => item.id !== "welcome").length;
    setRegeneratingMessageId(responseMessageId ?? userMessage.id);

    try {
      if (!user.is_guest && activeSessionId !== "default") {
        await api.truncateChatSessionMessages(activeSessionId, keepCount);
      }
      setMessages(keepMessages);
      setEditingMessageId(null);
      setEditingDraft("");
      await handleSend(nextPrompt, { useMemory });
    } catch (error) {
      showToast({
        title: "Unable to regenerate",
        message: error instanceof Error ? error.message : "The conversation could not be updated.",
        variant: "error",
      });
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  const retryMessage = (message: Message) => {
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const prompt = messageIndex > 0 ? messages[messageIndex - 1] : null;
    if (prompt?.role === "user") void regenerateTurn(prompt, prompt.content, message.id);
  };

  const retryMessageWithoutMemory = (message: Message) => {
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const prompt = messageIndex > 0 ? messages[messageIndex - 1] : null;
    if (prompt?.role === "user") {
      void regenerateTurn(prompt, prompt.content, message.id, false);
    }
  };

  const renderComposer = (placement: "center" | "dock") => {
    const composerExpanded = Boolean(input);
    const showStarterSuggestions = placement === "center" && isStarterState && isActive && !input && !uploadMenuOpen;

    return (
      <div className={cn("shrink-0", placement === "dock" ? "px-3 pb-3 pt-1 sm:px-8 sm:pb-6 sm:pt-0" : "w-full")}>
        <div className="relative mx-auto w-full max-w-4xl">
          <AnimatePresence>
            {showStarterSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                transition={{ duration: 0.22 }}
                className="absolute bottom-full left-0 right-0 z-30 mb-3 flex flex-wrap justify-center gap-2 px-2"
              >
                {SUGGESTIONS.map((suggestion) => (
                  <SuggestionBubble
                    key={suggestion.title}
                    suggestion={suggestion}
                    onClick={() => {
                      setInput(suggestion.prompt);
                      window.requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            layout
            ref={wrapperRef}
            onClick={() => {
              setIsActive(true);
              textareaRef.current?.focus();
            }}
            className="relative mx-auto w-full overflow-visible border border-transparent bg-white/[0.045] text-white cursor-text"
            animate={{
              borderRadius: composerExpanded ? 28 : 999,
              backgroundColor: isActive || input ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
              boxShadow: isActive || input ? "0 14px 42px rgba(0,0,0,0.24)" : "var(--shadow-accent-composer)",
              minHeight: composerExpanded ? 64 : 52,
              padding: composerExpanded ? 8 : 6,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <div className="relative flex items-center gap-2">
              <button
                ref={uploadTriggerRef}
                type="button"
                aria-label="Add files"
                aria-expanded={uploadMenuOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setUploadMenuOpen((open) => !open);
                  setIsActive(true);
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/62 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
              >
                <Paperclip className="size-5" />
              </button>
              <div className="relative min-w-0 flex-1">
                <Textarea
                  ref={textareaRef}
                  aria-label="Ask AI Desk"
                  value={input}
                  onChange={handleInput}
                  onFocus={() => setIsActive(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  className={cn(
                    "relative z-10 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 text-sm leading-5 text-white shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0",
                    composerExpanded ? "max-h-[180px] min-h-12 py-3.5" : "max-h-10 min-h-10 py-2.5"
                  )}
                />
                <div className="absolute inset-0 pointer-events-none flex items-center px-3">
                  <AnimatePresence mode="wait" initial={false}>
                    {showPlaceholder && !isActive && !input && (
                      prefersReducedMotion ? (
                        <span
                          key={placeholderIndex}
                          className="block max-w-full select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-white/24"
                        >
                          {PLACEHOLDERS[placeholderIndex]}
                        </span>
                      ) : (
                        <motion.span
                          key={placeholderIndex}
                          className="block max-w-full select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-white/24"
                          variants={PLACEHOLDER_CONTAINER_VARIANTS}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                        >
                          {Array.from(PLACEHOLDERS[placeholderIndex]).map((character, index) => (
                            <motion.span
                              key={`${character}-${index}`}
                              className="inline-block"
                              variants={PLACEHOLDER_LETTER_VARIANTS}
                            >
                              {character === " " ? "\u00a0" : character}
                            </motion.span>
                          ))}
                        </motion.span>
                      )
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ResearchModeSelector
                  plan={user.plan}
                  value={researchDepth}
                  onChange={setResearchDepth}
                  visible={version === "2.1"}
                />
                <ModelSelector placement={placement === "dock" ? "top" : "bottom"} compact />
                {!user.is_guest && (
                  <MessageActionButton
                    label="Manage AI memory"
                    onClick={() => setMemoryDialogOpen(true)}
                    active={memoryDialogOpen}
                  >
                    <Brain className="size-4" />
                  </MessageActionButton>
                )}
                <Button
                  onClick={() => void handleSend()}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="on-accent theme-accent-surface h-10 w-10 shrink-0 rounded-full disabled:opacity-45"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <AnimatePresence>
              {uploadMenuOpen && (
                <motion.div
                  ref={uploadMenuRef}
                  role="group"
                  aria-label="Attach files"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: placement === "dock" ? 8 : -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: placement === "dock" ? 8 : -8, scale: 0.98 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "absolute left-0 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover-strong)] p-2 shadow-[var(--shadow-popover)]",
                    placement === "dock" ? "bottom-[calc(100%+0.75rem)]" : "top-[calc(100%+0.75rem)]"
                  )}
                  onClick={(event) => event.stopPropagation()}
                >
                  <UploadMenuItem
                    icon={Paperclip}
                    label="Add photos & files"
                    accept=".pdf,.txt,.md,.csv,.json,image/*"
                    onChange={(event) => handleUpload(event, "auto")}
                  />
                  <UploadMenuItem
                    icon={FileText}
                    label="Add PDF or notes"
                    accept=".pdf,.txt,.md"
                    onChange={(event) => handleUpload(event, "document")}
                  />
                  <UploadMenuItem
                    icon={TableProperties}
                    label="Add data file"
                    accept=".csv,.json,.txt"
                    onChange={(event) => handleUpload(event, "data")}
                  />
                  <UploadMenuItem
                    icon={Image}
                    label="Add image"
                    accept="image/*"
                    onChange={(event) => handleUpload(event, "image")}
                  />
                  <div className="px-3 pb-1 pt-2 text-sm text-white/34">
                    Attach files for the advisor to reference in your next message.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/20 sm:mt-3 sm:text-xs">
          AI-generated analysis only. Not professional financial advice.
        </p>
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <p className="sr-only" aria-live="polite">{memoryAnnouncement}</p>
      {/* Messages */}
      <div ref={scrollRef} data-testid="chat-scroll-container" className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-16 sm:px-8 sm:pb-4 sm:pt-6">
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        <LoadingRegion
          loading={isHistoryLoading}
          label="Loading chat history"
          skeleton={(
            <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col gap-5 py-4">
              <div className="ml-auto w-[min(72%,28rem)] rounded-2xl bg-indigo-primary/10 px-4 py-4">
                <SkeletonText lines={2} widths={["92%", "56%"]} />
              </div>
              <div className="w-[min(86%,42rem)] rounded-2xl bg-[var(--surface-card)] px-5 py-5">
                <SkeletonBlock className="mb-4 h-2.5 w-24 rounded-sm" />
                <SkeletonText lines={5} widths={["96%", "88%", "100%", "74%", "52%"]} />
                <div className="mt-5 flex gap-2">
                  {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="size-8 rounded-lg" />)}
                </div>
              </div>
              <div className="ml-auto w-[min(58%,22rem)] rounded-2xl bg-indigo-primary/10 px-4 py-4">
                <SkeletonText lines={1} widths={["78%"]} />
              </div>
            </div>
          )}
        >
        <AnimatePresence mode="wait">
          {isStarterState ? (
            <motion.div
              key="starter"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="ai-starter-layout mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-start gap-7 pb-8 pt-3 sm:justify-center sm:gap-8 sm:py-8"
            >
              <motion.div
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
                className="w-full max-w-3xl text-center"
              >
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-semibold text-white sm:text-4xl md:text-5xl"
                >
                  {welcomeGreeting}{firstName ? <> <span className="gradient-highlight">{firstName}</span></> : null}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  className="mt-3 text-2xl font-medium leading-snug text-white/70 sm:text-3xl sm:leading-tight md:text-4xl"
                >
                  What do you want to know today?
                </motion.p>
              </motion.div>
              <div className="w-full">
                {renderComposer("center")}
              </div>
              <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                {WORKFLOW_STEPS.map((step) => (
                  <WorkflowStep key={step.title} step={step} />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col gap-4"
            >
              <AnimatePresence>
                {messages.filter((msg) => msg.id !== "welcome").map((msg) => (
                  <motion.div
                    key={msg.id}
                    id={msg.role === "user" ? promptAnchorId(msg.id) : undefined}
                    data-chat-prompt={msg.role === "user" ? msg.id : undefined}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex w-full min-w-0", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.status === "fetching" ? (
                      <div className="w-full max-w-[92%] sm:max-w-[75%]">
                        {liveActivity ? <AgentActivitySummary activity={liveActivity} onOpen={() => setActivityDrawerRunId(liveActivity.run_id)} /> : (
                          <AgentActivitySummary
                            activity={{ ...emptyActivity("preparing", activePlanMode), status: agentRunState }}
                            onOpen={() => setActivityDrawerRunId("preparing")}
                          />
                        )}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "min-w-0 max-w-[92%] break-words text-[15px] leading-relaxed sm:max-w-[75%]",
                          msg.role === "user" ? "whitespace-pre-wrap" : "text-white/90",
                          editingMessageId === msg.id && "w-full"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="space-y-2">
                            {msg.activity && <AgentActivitySummary activity={msg.activity} onOpen={() => setActivityDrawerRunId(msg.activity?.run_id ?? null)} />}
                            <div className="space-y-2 py-1 text-[var(--text-primary)]" data-testid="assistant-response">
                                {msg.selectedCapability && (
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                                    Sabi used {sabiCapabilityLabel(msg.selectedCapability)}
                                  </p>
                                )}
                                {Boolean(msg.memoryUsed?.length) && (
                                  <button
                                    type="button"
                                    onClick={() => setMemoryDialogOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-md text-[11px] text-indigo-300 transition-colors duration-150 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none"
                                  >
                                    <Brain className="size-3.5" aria-hidden="true" />
                                    Used {msg.memoryUsed?.length} saved preference{msg.memoryUsed?.length === 1 ? "" : "s"}
                                  </button>
                                )}
                                <AgentSources sources={messageActivitySources(msg)} />
                                {msg.researchTicker ? (
                                  <div className="space-y-3">
                                    <ResearchMessageTabs content={msg.content} reports={msg.researchReports} overview={msg.overview} onQuestionSelect={fillComposer} />
                                    <div className="rounded-xl border border-indigo-primary/25 bg-indigo-primary/10 p-3">
                                      <p className="text-sm font-semibold text-white">
                                        {msg.researchRunId ? "Quanfora 2.1 Agent Reports" : "Generate a full Quanfora 2.1 Research Report?"}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-white/55">
                                        {msg.researchRunId
                                          ? `Open the full workspace to review each analyst report, tool event, and the shared data snapshot for ${msg.researchTicker}.`
                                          : `Run market, news, sentiment, fundamentals, trading, and risk-management agents for ${msg.researchTicker}.`}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Link
                                          href={msg.researchRunId ? `/research/${msg.researchRunId}?from=ai_advisor` : `/research?ticker=${encodeURIComponent(msg.researchTicker)}&source=ai_advisor&report_type=investment`}
                                          className="inline-flex h-9 items-center rounded-lg bg-indigo-primary px-3 text-xs font-semibold text-white hover:bg-indigo-primary/90"
                                        >
                                          {msg.researchRunId ? "View full agent reports" : "Generate Full Report"}
                                        </Link>
                                        {!msg.researchRunId && (
                                          <button
                                            type="button"
                                            onClick={() => setInput(`Give me a quick answer on ${msg.researchTicker}.`)}
                                            className="inline-flex h-9 items-center rounded-lg border border-white/[0.10] px-3 text-xs font-semibold text-white/60 hover:text-white"
                                          >
                                            Quick Answer
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <AssistantMessageContent content={msg.content} consensusOpinions={msg.consensusOpinions} overview={msg.overview} onQuestionSelect={fillComposer} />
                                )}
                            </div>
                            {msg.memoryCandidates?.map((memory) => (
                              <MemoryCandidateCard
                                key={memory.id}
                                memory={memory}
                                onResolved={(memoryId) => {
                                  setMessages((current) => current.map((message) =>
                                    message.id === msg.id
                                      ? {
                                          ...message,
                                          memoryCandidates: message.memoryCandidates?.filter((item) => item.id !== memoryId),
                                        }
                                      : message
                                  ));
                                }}
                              />
                            ))}
                            {msg.content && !isLoading && (
                              <div className="flex items-center gap-1 px-1 text-white/45" aria-label="Response actions">
                                <MessageActionButton label={copiedMessageId === msg.id ? "Copied" : "Copy response"} onClick={() => copyResponse(msg)}>
                                  <AnimatePresence mode="wait" initial={false}>
                                    <motion.span key={copiedMessageId === msg.id ? "copied" : "copy"} initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.72, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.72, rotate: 12 }} transition={{ duration: prefersReducedMotion ? 0 : 0.14 }}>
                                      {copiedMessageId === msg.id ? <Check className="size-4 text-emerald-300" /> : <Clipboard className="size-4" />}
                                    </motion.span>
                                  </AnimatePresence>
                                </MessageActionButton>
                                <MessageActionButton label="Good response" active={feedback[msg.id] === "up"} onClick={() => setFeedback((current) => ({ ...current, [msg.id]: current[msg.id] === "up" ? null : "up" }))}>
                                  <ThumbsUp className="size-4" />
                                </MessageActionButton>
                                <MessageActionButton label="Bad response" active={feedback[msg.id] === "down"} onClick={() => setFeedback((current) => ({ ...current, [msg.id]: current[msg.id] === "down" ? null : "down" }))}>
                                  <ThumbsDown className="size-4" />
                                </MessageActionButton>
                                <MessageActionButton label="Try again" disabled={Boolean(regeneratingMessageId)} onClick={() => retryMessage(msg)}>
                                  <RotateCcw className={cn("size-4", regeneratingMessageId === msg.id && "animate-spin motion-reduce:animate-none")} />
                                </MessageActionButton>
                                {Boolean(msg.memoryUsed?.length) && (
                                  <MessageActionButton label="Try again without saved memory" disabled={Boolean(regeneratingMessageId)} onClick={() => retryMessageWithoutMemory(msg)}>
                                    <Brain className="size-4" />
                                  </MessageActionButton>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="on-accent theme-accent-surface rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
                              {editingMessageId === msg.id ? (
                                <div className="space-y-4">
                                  <textarea
                                    autoFocus
                                    value={editingDraft}
                                    onChange={(event) => setEditingDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") {
                                        setEditingMessageId(null);
                                        setEditingDraft("");
                                      }
                                      if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void regenerateTurn(msg, editingDraft);
                                      }
                                    }}
                                    aria-label="Edit message text"
                                    rows={Math.min(8, Math.max(2, editingDraft.split("\n").length))}
                                    className="block min-h-12 max-h-64 w-full resize-y overflow-y-auto border-0 bg-transparent p-0 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/45 focus:ring-0"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingMessageId(null); setEditingDraft(""); }} className="rounded-full text-white/75 hover:bg-white/10 hover:text-white">Cancel</Button>
                                    <Button type="button" size="sm" disabled={!editingDraft.trim() || Boolean(regeneratingMessageId)} onClick={() => void regenerateTurn(msg, editingDraft)} className="rounded-full bg-white text-black hover:bg-white/90">Send</Button>
                                  </div>
                                </div>
                              ) : msg.content}
                            </div>
                            {editingMessageId !== msg.id && !isLoading && (
                              <div className="flex justify-end gap-1 text-white/45" aria-label="Message actions">
                                <MessageActionButton label={copiedMessageId === msg.id ? "Copied" : "Copy message"} onClick={() => copyResponse(msg)}>
                                  <AnimatePresence mode="wait" initial={false}>
                                    <motion.span key={copiedMessageId === msg.id ? "copied" : "copy"} initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.72, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.72, rotate: 12 }} transition={{ duration: prefersReducedMotion ? 0 : 0.14 }}>
                                      {copiedMessageId === msg.id ? <Check className="size-4 text-emerald-300" /> : <Clipboard className="size-4" />}
                                    </motion.span>
                                  </AnimatePresence>
                                </MessageActionButton>
                                <MessageActionButton label="Edit message" onClick={() => editMessage(msg)}>
                                  <Pencil className="size-4" />
                                </MessageActionButton>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        </LoadingRegion>
      </div>
      <PromptNavigator prompts={promptNavigationItems} scrollContainerRef={scrollRef} />
      {!isStarterState && (
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-transparent bg-[#050608]/95 pt-2 shadow-[0_-24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {renderComposer("dock")}
        </div>
      )}
      <AgentActivityDrawer
        activity={selectedDrawerActivity}
        open={Boolean(activityDrawerRunId && selectedDrawerActivity)}
        onOpenChange={(open) => {
          if (!open) setActivityDrawerRunId(null);
        }}
      />
      {!user.is_guest && (
        <AgentMemoryDialog
          open={memoryDialogOpen}
          onOpenChange={setMemoryDialogOpen}
        />
      )}
    </div>
  );
}

function ResearchModeSelector({
  plan,
  value,
  onChange,
  visible,
}: {
  plan: keyof typeof PLAN_RANK;
  value: ResearchDepth;
  onChange: (value: ResearchDepth) => void;
  visible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeDepth = bestResearchModeForPlan(plan, value);
  const active = RESEARCH_MODES.find((mode) => mode.depth === activeDepth) ?? RESEARCH_MODES[0];
  const isUpperTier = PLAN_RANK[plan] >= PLAN_RANK.pro;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!visible || !isUpperTier) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Research mode: ${active.label}`}
        title={`Research mode: ${active.label}`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--surface-control)] px-3 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--surface-control-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
      >
        <SlidersHorizontal className="size-4 text-cyan-300" />
        <span className="hidden md:inline">Research</span>
        <span className="hidden sm:inline text-[var(--text-subtle)]">{active.label}</span>
        <ChevronDown className={cn("size-4 text-[var(--text-subtle)] transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-12 right-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]"
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">
              Research Mode
            </div>
            {RESEARCH_MODES.map((mode) => {
              const isActive = mode.depth === activeDepth;
              const isAllowed = canUseResearchMode(plan, mode.depth);
              return (
                <button
                  key={mode.depth}
                  type="button"
                  role="menuitem"
                  disabled={!isAllowed}
                  onClick={() => {
                    if (!isAllowed) return;
                    onChange(mode.depth);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
                    isActive
                      ? "bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-[var(--shadow-control)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-selected)]/50",
                    !isAllowed && "cursor-not-allowed opacity-45 hover:bg-transparent"
                  )}
                >
                  <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-200 ring-1 ring-cyan-300/20">
                    <SlidersHorizontal className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      {mode.label}
                      {!isAllowed && (
                        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)] ring-1 ring-white/[0.06]">
                          {mode.minPlan}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{mode.tagline}</div>
                  </div>
                  {isActive && <Check className="size-4 shrink-0 text-green-positive" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResearchMessageTabs({ content, reports, overview, onQuestionSelect }: { content: string; reports?: EquityResearchReport[]; overview?: Overview | null; onQuestionSelect: (question: string) => void }) {
  const [active, setActive] = useState("final");
  const reportTabs = (reports ?? []).filter((report) => report.markdown && report.markdown.trim());
  if (reportTabs.length === 0) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} onQuestionSelect={onQuestionSelect} />}
        <Markdown content={content} />
      </div>
    );
  }
  const currentReport = reportTabs.find((report) => report.report_id === active);

  return (
    <div className="space-y-3">
      {overview && <OverviewCard overview={overview} onQuestionSelect={onQuestionSelect} />}
      <ResponseTabs
        tabs={[{ id: "final", label: "Report" }, ...reportTabs.map((report) => ({ id: report.report_id, label: report.agent_name }))]}
        active={active}
        onChange={setActive}
      />
      {currentReport ? <Markdown content={currentReport.markdown} /> : <Markdown content={content} />}
    </div>
  );
}

function ConsensusMessageTabs({ content, opinions }: { content: string; opinions: ConsensusOpinion[] }) {
  const [active, setActive] = useState("combined");
  const currentOpinion = opinions.find((opinion) => opinion.agent === active);

  return (
    <div className="space-y-3">
      <ResponseTabs
        tabs={[{ id: "combined", label: "Overall" }, ...opinions.map((opinion) => ({ id: opinion.agent, label: opinion.agent.replaceAll("_", " ") }))]}
        active={active}
        onChange={setActive}
      />
      {currentOpinion ? (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] p-3 text-sm sm:grid-cols-3">
            <div><span className="text-[var(--text-muted)]">Verdict</span><div className="font-semibold capitalize text-[var(--text-primary)]">{currentOpinion.verdict.replaceAll("_", " ")}</div></div>
            <div><span className="text-[var(--text-muted)]">Confidence</span><div className="font-semibold text-[var(--text-primary)]">{Math.round(currentOpinion.confidence * 100)}%</div></div>
            <div><span className="text-[var(--text-muted)]">Status</span><div className="font-semibold capitalize text-[var(--text-primary)]">{currentOpinion.status ?? "completed"}</div></div>
          </div>
          <Markdown content={currentOpinion.reasoning} />
          {currentOpinion.asset_opinions && Object.keys(currentOpinion.asset_opinions).length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(currentOpinion.asset_opinions).map(([symbol, asset]) => (
                <div key={symbol} className="rounded-xl border border-[var(--theme-border)] bg-[var(--surface-panel)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[var(--text-primary)]">{symbol}</span>
                    <span className="capitalize text-[var(--text-secondary)]">{asset.verdict.replaceAll("_", " ")} · {Math.round(asset.confidence * 100)}%</span>
                  </div>
                  <p className="mt-2 leading-6 text-[var(--text-muted)]">{asset.reasoning}</p>
                </div>
              ))}
            </div>
          )}
          {(currentOpinion.risk_flags ?? []).length > 0 && (
            <div className="rounded-xl border border-amber-warning/25 bg-amber-warning/10 p-3 text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-amber-warning">Risk flags:</span> {(currentOpinion.risk_flags ?? []).join(", ")}
            </div>
          )}
          {(currentOpinion.limitations ?? []).length > 0 && (
            <div className="rounded-xl border border-indigo-primary/20 bg-indigo-primary/10 p-3 text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-indigo-primary">Evidence limitations:</span> {(currentOpinion.limitations ?? []).join(" ")}
            </div>
          )}
        </div>
      ) : <Markdown content={content} />}
    </div>
  );
}

function ResponseTabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <HorizontalScroll className="flex gap-2 rounded-xl border border-white/[0.08] bg-black/15 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
            active === tab.id ? "bg-white/12 text-white" : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
          )}
        >
          {tab.label}
        </button>
      ))}
    </HorizontalScroll>
  );
}

function AssistantMessageContent({ content, consensusOpinions, overview, onQuestionSelect }: { content: string; consensusOpinions?: ConsensusOpinion[]; overview?: Overview | null; onQuestionSelect: (question: string) => void }) {
  const prediction = parsePredictionSummary(content);

  if (consensusOpinions?.length) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} onQuestionSelect={onQuestionSelect} />}
        <ConsensusMessageTabs content={content} opinions={consensusOpinions} />
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} onQuestionSelect={onQuestionSelect} />}
        <Markdown content={content} />
      </div>
    );
  }

  const rows = [
    ["ML Direction", prediction.mlDirection],
    ["Valuation Target", prediction.valuationTarget],
    ["Implied Upside/Downside", prediction.impliedUpside],
    ["Final Signal", prediction.finalSignal],
    ["Model Performance", prediction.modelPerformance],
  ];

  return (
    <div className="space-y-3">
      {overview && <OverviewCard overview={overview} onQuestionSelect={onQuestionSelect} />}
      <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className={cn(label === "Model Performance" ? "sm:col-span-2" : "", "min-w-0")}>
              <div className="text-[11px] font-semibold uppercase tracking-normal text-white/38">{label}</div>
              <div className="mt-1 break-words text-sm font-semibold text-white/88">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-white/[0.08] pt-3 text-xs leading-5 text-white/55">
          {prediction.disclaimer}
        </div>
      </div>
      <Markdown content={content} />
    </div>
  );
}

function SuggestionBubble({
  suggestion,
  onClick,
}: {
  suggestion: {
    title: string;
    description: string;
    prompt: string;
    icon: ComponentType<{ className?: string }>;
  };
  onClick: () => void;
}) {
  const Icon = suggestion.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-white/[0.08] bg-[#17181d]/95 px-3 py-2 text-left text-xs text-white/72 shadow-[0_14px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-colors duration-150 hover:border-indigo-primary/35 hover:bg-[#1e2028] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-primary/14 text-indigo-primary ring-1 ring-indigo-primary/20">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 truncate font-medium">{suggestion.title}</span>
    </button>
  );
}

function UploadMenuItem({
  icon: Icon,
  label,
  accept,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="group flex h-12 cursor-pointer items-center gap-3 rounded-[1.1rem] px-3 text-sm font-medium text-white/82 transition-colors hover:bg-white/[0.08] hover:text-white">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/70 transition-colors group-hover:text-indigo-primary">
        <Icon className="size-4" />
      </span>
      <span>{label}</span>
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}

function WorkflowStep({
  step,
}: {
  step: {
    title: string;
    detail: string;
    href: string;
    action: string;
    icon: ComponentType<{ className?: string }>;
  };
}) {
  const Icon = step.icon;

  return (
    <Link
      href={step.href}
      className="group flex min-h-[8.5rem] flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3 text-left text-white shadow-[var(--shadow-card)] transition-colors hover:border-indigo-primary/35 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 sm:min-h-40 sm:p-4"
    >
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 sm:gap-2 sm:text-xs">
          <Icon className="h-3.5 w-3.5 text-indigo-primary sm:h-4 sm:w-4" />
          {step.title}
        </div>
        <p className="mt-2 text-xs leading-5 text-white/58 sm:mt-3 sm:text-sm sm:leading-6">{step.detail}</p>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-primary sm:mt-4 sm:gap-2 sm:text-sm">
        {step.action}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
      </div>
    </Link>
  );
}

function getFirstName(value: string) {
  const name = value.includes("@") ? value.split("@")[0] : value;
  return name.trim().split(/\s+/)[0] || "";
}
