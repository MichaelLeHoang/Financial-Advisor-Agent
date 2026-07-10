"use client";

import { useRef, useEffect, useState } from "react";
import type { ChangeEvent, ComponentType } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Brain, Check, ChevronDown, ClipboardList, FileText, Image, Loader2, Paperclip, PieChart, Send, SlidersHorizontal, TableProperties, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, isRedisUnavailableError, isUpgradeRequiredError } from "@/lib/api";
import type { ChatJobProgress, ChatJobStatusResponse, ConsensusOpinion, EquityResearchEvent, EquityResearchReport, EquityResearchRunDetail, Overview, ResearchDepth, ResearchReportType } from "@/lib/api";
import { notifyCompletion, requestCompletionNotification } from "@/lib/completion-notifications";
import { loadLocalChatMessages, saveLocalChatMessages } from "@/lib/local-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import ModelSelector, { useModel, apiModeFromVersion } from "@/components/ModelSelector";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { OverviewCard } from "@/components/ui/overview-card";
import Plan from "@/components/ui/agent-plan";
import Markdown from "@/components/ui/markdown";
import { showToast } from "@/components/ui/toast";

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
  metadata?: { consensus?: { opinions?: ConsensusOpinion[] }; researchReports?: EquityResearchReport[]; overview?: Overview | null } | null;
  consensusOpinions?: ConsensusOpinion[];
  researchReports?: EquityResearchReport[];
  overview?: Overview | null;
}): Message {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    consensusOpinions: message.consensusOpinions ?? message.metadata?.consensus?.opinions,
    researchReports: message.researchReports ?? message.metadata?.researchReports,
    overview: message.overview ?? message.metadata?.overview,
  };
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

function firstChatProgressTool(mode: "single" | "consensus") {
  return mode === "consensus" ? "quant_researcher" : "single_scope";
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

const placeholderContainerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.015 } },
  exit: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const letterVariants = {
  initial: { opacity: 0, filter: "blur(12px)", y: 10 },
  animate: {
    opacity: 1, filter: "blur(0px)", y: 0,
    transition: { opacity: { duration: 0.25 }, filter: { duration: 0.4 }, y: { type: "spring" as const, stiffness: 80, damping: 20 } },
  },
  exit: {
    opacity: 0, filter: "blur(12px)", y: -10,
    transition: { opacity: { duration: 0.2 }, filter: { duration: 0.3 }, y: { type: "spring" as const, stiffness: 80, damping: 20 } },
  },
};

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const { version } = useModel();
  const router = useRouter();
  const params = useParams<{ sessionId?: string | string[] }>();
  const searchParams = useSearchParams();
  const routeSessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const activeSessionId = routeSessionId ? decodeURIComponent(routeSessionId) : searchParams.get("session") || "default";
  const promptParam = searchParams.get("prompt");
  const [messages, setMessages] = useState<Message[]>(() =>
    activeSessionId === "default" ? [GREETING] : []
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedPromptRef = useRef<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [completedTools, setCompletedTools] = useState<string[]>([]);
  const [agentRunState, setAgentRunState] = useState<"queued" | "running">("running");
  const [agentRunStartedAt, setAgentRunStartedAt] = useState<number | null>(null);
  const [useAgentSyntheticProgress, setUseAgentSyntheticProgress] = useState(false);
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("shallow");
  const lastJobProgressSequenceRef = useRef(0);
  const progressEventQueueRef = useRef<ChatJobProgress[]>([]);
  const progressDrainActiveRef = useRef(false);
  const progressDrainPromiseRef = useRef<Promise<void> | null>(null);
  const notifyWhenCompleteRef = useRef(false);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
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
      setActiveTool(null);
      setCompletedTools([]);
      setAgentRunState("running");
      setAgentRunStartedAt(null);
      setUseAgentSyntheticProgress(false);
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
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive, input]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!input) setIsActive(false);
        setUploadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [input]);

  useEffect(() => {
    if (authLoading || isStreamingRef.current) return;
    let cancelled = false;

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

        const res = await api.chatSessionMessages(activeSessionId);
        if (cancelled) return;

        const loadedMessages = res.messages.map(messageFromChatHistory);
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

  const applyProgressEvent = (progress: ChatJobProgress, job: ChatJobStatusResponse, fallbackLabel: string) => {
    setAgentRunState(job.status === "queued" ? "queued" : "running");
    setAgentRunStartedAt((current) => current ?? (job.started_at ? job.started_at * 1000 : Date.now()));
    setActiveTool(progress.active_tool ?? null);
    setCompletedTools(progress.completed_tools ?? []);

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
          await delay(420);
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

  const waitForProgressEvents = async (signal?: AbortSignal) => {
    while (progressDrainPromiseRef.current || progressEventQueueRef.current.length > 0) {
      signal?.throwIfAborted();
      if (progressDrainPromiseRef.current) {
        await progressDrainPromiseRef.current;
      } else {
        await delay(80, signal);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const requestController = new AbortController();
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = requestController;
    const { signal } = requestController;
    const text = input.trim();
    setInput("");

    // Guard the session-load effect before router.replace fires
    isStreamingRef.current = true;

    let targetSessionId = activeSessionId;
    if (activeSessionId === "default") {
      targetSessionId = typeof crypto !== "undefined" && "randomUUID" in crypto 
        ? crypto.randomUUID() 
        : `session-${Date.now()}`;
      router.replace(`/session/${encodeURIComponent(targetSessionId)}`);
    }

    const getUniqueId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`;

    const userMsg: Message = { id: getUniqueId(), role: "user", content: text };
    const researchCommand = extractResearchCommand(text);
    const investmentTicker = researchCommand?.ticker ?? extractInvestmentTicker(text);

    if (researchCommand || version === "2.1") {
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
      setAgentRunStartedAt(Date.now());
      setUseAgentSyntheticProgress(false);
      setActiveTool("equity_snapshot");
      setCompletedTools([]);
      showLongRunningToast("Quanfora 2.1 research may take a little while.");
      const loadingStartedAt = Date.now();
      try {
        const reportType = researchCommand?.reportType ?? detectResearchReportType(text);
        const run = await api.createEquityResearchRun({
          ticker,
          report_type: reportType,
          research_depth: researchCommand?.depth ?? bestResearchModeForPlan(user.plan, researchDepth),
          source_surface: "ai_advisor",
        }, signal);
        let cursor = 0;
        let latestDetail: EquityResearchRunDetail | null = null;
        const completed = new Set<string>();

        while (true) {
          const [detail, eventList] = await Promise.all([
            api.equityResearchRun(run.run_id, signal),
            api.equityResearchEvents(run.run_id, cursor, signal),
          ]);
          latestDetail = detail;
          cursor = eventList.cursor;

          const newestReasoning = [...eventList.events].reverse().find((event) => event.event_type === "reasoning" && event.agent_name);
          for (const event of eventList.events) {
            const toolKey = toolKeyFromResearchEvent(event);
            if (!toolKey) continue;

            if (isResearchStepStarting(event)) {
              setActiveTool(toolKey);
            }
            if (isResearchStepComplete(event)) {
              completed.add(toolKey);
              setCompletedTools(Array.from(completed));
              setActiveTool(null);
            }
          }

          if (newestReasoning?.agent_name) {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "fetching"
                  ? { ...m, content: `${newestReasoning.agent_name} is working...` }
                  : m
              )
            );
          }

          if (["completed", "failed", "cancelled"].includes(detail.run.status)) {
            break;
          }

          await delay(900, signal);
        }

        if (!latestDetail || latestDetail.run.status !== "completed") {
          throw new Error(latestDetail?.run.error_message || `Research run ${latestDetail?.run.status ?? "failed"}`);
        }

        const finalMarkdown = finalResearchMarkdown(latestDetail);
        if (!finalMarkdown) {
          throw new Error("The research run completed but the final decision report was unavailable.");
        }

        const elapsedBeforeAnswer = Date.now() - loadingStartedAt;
        if (elapsedBeforeAnswer < 2200) {
          await delay(2200 - elapsedBeforeAnswer, signal);
        }

        if (!user.is_guest) {
          await api.appendChatSessionMessage(targetSessionId, "user", text);
          await api.appendChatSessionMessage(targetSessionId, "assistant", finalMarkdown, { researchReports: latestDetail.reports, overview: latestDetail.overview });
        }
        setMessages((prev) =>
          prev.filter((m) => m.status !== "fetching").concat({
            id: getUniqueId(),
            role: "assistant",
            content: finalMarkdown,
            researchTicker: latestDetail.run.ticker,
            researchRunId: latestDetail.run.run_id,
            researchReports: latestDetail.reports,
            overview: latestDetail.overview,
          })
        );
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
          setActiveTool(null);
          setCompletedTools([]);
          setAgentRunState("running");
          setAgentRunStartedAt(null);
          setUseAgentSyntheticProgress(false);
        }
      }
      return;
    }

    const fetchingLabel = version === "2.0"
      ? "Running multi-agent consensus analysis..."
      : "Analyzing market context...";
    const mode = apiModeFromVersion(version);
    const shouldNotifyLongRun = mode === "consensus";
    const fetchingMsg: Message = { id: getUniqueId(), role: "assistant", content: fetchingLabel, status: "fetching" };

    setMessages((prev) => [...prev, userMsg, fetchingMsg]);
    setIsLoading(true);
    const loadingStartedAt = Date.now();
    setUpgradeMessage(null);
    setActiveTool(firstChatProgressTool(mode));
    setCompletedTools([]);
    setAgentRunState("queued");
    setAgentRunStartedAt(null);
    setUseAgentSyntheticProgress(false);
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
      let res;
      try {
        const queued = await api.chatJob(text, targetSessionId, remember, mode, signal);

        res = await api.waitForChatJob(queued.job_id, (job) => {
          const appliedProgress = enqueueJobProgress(job, fetchingLabel);
          if (job.status === "queued") {
            setAgentRunState((current) => current === "running" ? "running" : "queued");
            const positionText = job.queue_position ? ` Position ${job.queue_position}.` : "";
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "fetching"
                  ? { ...m, content: `Queued for analysis.${positionText}` }
                  : m
              )
            );
          } else if (job.status === "running" && !appliedProgress) {
            setAgentRunState("running");
            setAgentRunStartedAt((current) => current ?? Date.now());
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "fetching"
                  ? { ...m, content: fetchingLabel }
                  : m
              )
            );
          }
        }, 1500, signal);
      } catch (queueError) {
        if (!isRedisUnavailableError(queueError)) throw queueError;
        setAgentRunState("running");
        setAgentRunStartedAt(Date.now());
        setUseAgentSyntheticProgress(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.status === "fetching"
              ? { ...m, content: fetchingLabel }
              : m
          )
        );
        res = await api.chat(text, targetSessionId, remember, mode, signal);
      }
      const consensusOpinions = res.consensus?.opinions;
      const overview = res.overview;

      const minimumPlanDuration = mode === "consensus" ? 3200 : 1800;
      const elapsedBeforeAnswer = Date.now() - loadingStartedAt;
      if (elapsedBeforeAnswer < minimumPlanDuration) {
        await delay(minimumPlanDuration - elapsedBeforeAnswer, signal);
      }
      await waitForProgressEvents(signal);

      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: assistantMsgId,
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't process that request.",
          consensusOpinions,
          overview,
        }).concat(investmentTicker ? [{
          id: getUniqueId(),
          role: "assistant",
          content: `Generate a full Quanfora 2.1 Research Report for ${investmentTicker}?`,
          researchTicker: investmentTicker,
        }] : [])
      );
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
        setActiveTool(null);
        setCompletedTools([]);
        setAgentRunState("running");
        setAgentRunStartedAt(null);
        setUseAgentSyntheticProgress(false);
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

  const hasConversation = messages.some((message) => message.id !== "welcome");
  const isStarterState = !hasConversation && !isHistoryLoading;

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
            className="relative mx-auto w-full overflow-visible border border-white/[0.06] bg-white/[0.045] text-white transition-colors cursor-text"
            animate={{
              borderRadius: composerExpanded ? 28 : 999,
              borderColor: isActive || input ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              backgroundColor: isActive || input ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
              boxShadow: isActive || input ? "0 14px 42px rgba(0,0,0,0.24)" : "var(--shadow-accent-composer)",
              minHeight: composerExpanded ? 64 : 52,
              padding: composerExpanded ? 8 : 6,
            }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <div className="relative flex items-center gap-2">
              <button
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
                  <AnimatePresence mode="wait">
                    {showPlaceholder && !isActive && !input && (
                      <motion.span
                        key={placeholderIndex}
                        className="max-w-full select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-white/24"
                        variants={placeholderContainerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        {PLACEHOLDERS[placeholderIndex].split("").map((char, i) => (
                          <motion.span key={i} variants={letterVariants} style={{ display: "inline-block" }}>
                            {char === " " ? "\u00A0" : char}
                          </motion.span>
                        ))}
                      </motion.span>
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
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="on-accent accent-gradient-surface h-10 w-10 shrink-0 rounded-full shadow-[var(--shadow-primary-action)] hover:shadow-[var(--shadow-primary-action-hover)] disabled:opacity-45"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <AnimatePresence>
              {uploadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(8px)" }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "absolute left-0 right-0 z-40 rounded-[1.45rem] border border-white/[0.08] bg-[#202124]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl",
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
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-4 sm:px-8 sm:pb-4 sm:pt-6">
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {isHistoryLoading && (
          <Card className="mx-auto max-w-fit rounded-xl border-indigo-primary/30 bg-indigo-primary/10 px-4 py-2 text-sm text-indigo-primary shadow-none">
            <CardContent className="flex items-center gap-3 p-0">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Loading chat history...</span>
            </CardContent>
          </Card>
        )}

        <AnimatePresence mode="wait">
          {isStarterState ? (
            <motion.div
              key="starter"
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
              transition={{ duration: 0.22 }}
              className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col items-center justify-center gap-7 py-8 sm:gap-8 lg:min-h-[calc(100vh-12rem)]"
            >
              <motion.div
                animate={{ y: isActive && !input && !uploadMenuOpen ? -46 : 0 }}
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
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              transition={{ duration: 0.2 }}
              className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col gap-4"
            >
              <AnimatePresence>
                {messages.filter((msg) => msg.id !== "welcome").map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex w-full min-w-0", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.status === "fetching" ? (
                      <div className="w-full max-w-[92%] sm:max-w-[75%]">
                        <Plan
                          mode={version === "2.1" ? "research" : version === "2.0" ? "consensus" : "single"}
                          isActive={true}
                          activeTool={activeTool}
                          completedTools={completedTools}
                          runState={version === "2.1" ? "running" : agentRunState}
                          runStartedAt={version === "2.1" ? null : agentRunStartedAt}
                          useSyntheticFallback={useAgentSyntheticProgress}
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "min-w-0 max-w-[92%] break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[75%] sm:px-5 sm:py-4",
                          msg.role === "user"
                            ? "on-accent accent-gradient-surface glow-indigo whitespace-pre-wrap"
                            : "glass text-white/90"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          msg.researchTicker ? (
                            <div className="space-y-3">
                              <ResearchMessageTabs content={msg.content} reports={msg.researchReports} overview={msg.overview} />
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
                            <AssistantMessageContent content={msg.content} consensusOpinions={msg.consensusOpinions} overview={msg.overview} />
                          )
                        ) : (
                          msg.content
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!isStarterState && (
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/[0.04] bg-[#050608]/95 pt-2 shadow-[0_-24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {renderComposer("dock")}
        </div>
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
        <ChevronDown className="size-4 text-[var(--text-subtle)]" />
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
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all",
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

function ResearchMessageTabs({ content, reports, overview }: { content: string; reports?: EquityResearchReport[]; overview?: Overview | null }) {
  const [active, setActive] = useState("final");
  const reportTabs = (reports ?? []).filter((report) => report.markdown && report.markdown.trim());
  if (reportTabs.length === 0) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} />}
        <Markdown content={content} />
      </div>
    );
  }
  const currentReport = reportTabs.find((report) => report.report_id === active);

  return (
    <div className="space-y-3">
      {overview && <OverviewCard overview={overview} />}
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
          <div className="grid gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] p-3 text-sm sm:grid-cols-2">
            <div><span className="text-white/45">Verdict</span><div className="font-semibold capitalize text-white/90">{currentOpinion.verdict}</div></div>
            <div><span className="text-white/45">Confidence</span><div className="font-semibold text-white/90">{Math.round(currentOpinion.confidence * 100)}%</div></div>
          </div>
          <Markdown content={currentOpinion.reasoning} />
          {(currentOpinion.risk_flags ?? []).length > 0 && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
              <span className="font-semibold">Risk flags:</span> {(currentOpinion.risk_flags ?? []).join(", ")}
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

function AssistantMessageContent({ content, consensusOpinions, overview }: { content: string; consensusOpinions?: ConsensusOpinion[]; overview?: Overview | null }) {
  const prediction = parsePredictionSummary(content);

  if (consensusOpinions?.length) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} />}
        <ConsensusMessageTabs content={content} opinions={consensusOpinions} />
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="space-y-3">
        {overview && <OverviewCard overview={overview} />}
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
      {overview && <OverviewCard overview={overview} />}
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
      className="group inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-white/[0.08] bg-[#17181d]/95 px-3 py-2 text-left text-xs text-white/72 shadow-[0_14px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-indigo-primary/35 hover:bg-[#1e2028] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
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
