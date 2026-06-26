"use client";

import { useRef, useEffect, useState } from "react";
import type { ChangeEvent, ComponentType, MouseEvent } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Brain, Check, ChevronDown, ClipboardList, Image, Loader2, Paperclip, PieChart, Send, SlidersHorizontal, TableProperties, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, isRedisUnavailableError, isUpgradeRequiredError } from "@/lib/api";
import type { ChatJobProgress, ChatJobStatusResponse, EquityResearchEvent, EquityResearchRunDetail, ResearchDepth } from "@/lib/api";
import { notifyCompletion, requestCompletionNotification } from "@/lib/completion-notifications";
import { loadLocalChatMessages, saveLocalChatMessages } from "@/lib/local-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import ModelSelector, { useModel, apiModeFromVersion } from "@/components/ModelSelector";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
}

const GREETING: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hello. I can help with market research, portfolio analysis, and financial news.",
};

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
  const match = message.trim().match(/^\/(?:research|analyze)\s+([A-Za-z][A-Za-z0-9.-]{0,14})(?:\s+(deep|medium|shallow))?/i);
  if (!match) return null;
  return {
    ticker: match[1].toUpperCase(),
    depth: (match[2]?.toLowerCase() || "shallow") as "shallow" | "medium" | "deep",
  };
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
  if (!content.includes("ML Direction:") || !content.includes("Final Signal:")) return null;

  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const findValue = (label: string) => {
    const line = lines.find((item) => item.startsWith(label) || item.startsWith(`- ${label}`));
    return line?.replace(/^- /, "").replace(label, "").trim() || "Unavailable";
  };
  const performanceLine = lines.find((line) => line.startsWith("- Weighted Ensemble:")) || lines.find((line) => line.startsWith("- Random Forest:")) || "";
  const confidenceLine = lines.find((line) => line.startsWith("Confidence:"))?.replace(/\.$/, "") || "";
  const disclaimer =
    lines.find((line) => line.includes("not professional financial advice") || line.includes("not financial advice")) ||
    "This is educational analysis, not financial advice.";

  return {
    mlDirection: findValue("ML Direction:"),
    valuationTarget: findValue("Valuation Target:"),
    impliedUpside: findValue("Implied Upside/Downside:"),
    finalSignal: findValue("Final Signal:"),
    modelPerformance: [confidenceLine, performanceLine.replace(/^- /, "")].filter(Boolean).join(" | ") || "Unavailable",
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
  "PE",
  "RISK",
  "SEC",
  "SELL",
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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  const firstName = getFirstName(user?.display_name || user?.email || "");

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
          const localMessages = loadLocalChatMessages(activeSessionId).map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
          }));
          if (!cancelled) setMessages(localMessages.length > 0 ? localMessages : [GREETING]);
          return;
        }

        const res = await api.chatSessionMessages(activeSessionId);
        if (cancelled) return;

        const loadedMessages = res.messages.map((message) => ({
          id: String(message.id),
          role: message.role,
          content: message.content,
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

  const waitForProgressEvents = async () => {
    while (progressDrainPromiseRef.current || progressEventQueueRef.current.length > 0) {
      if (progressDrainPromiseRef.current) {
        await progressDrainPromiseRef.current;
      } else {
        await delay(80);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
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
      const ticker = researchCommand?.ticker ?? extractTickerForResearch(text);
      if (!ticker) {
        setMessages((prev) => [...prev, userMsg, {
          id: getUniqueId(),
          role: "assistant",
          content: "QuanAd 2.1 needs a ticker to start a full Equity Research Desk run. Try `AAPL`, `NVDA`, or `/analyze MSFT deep`.",
        }]);
        isStreamingRef.current = false;
        return;
      }
      setMessages((prev) => [...prev, userMsg, { id: getUniqueId(), role: "assistant", content: "Creating QuanAd 2.1 research run...", status: "fetching" }]);
      setIsLoading(true);
      setUpgradeMessage(null);
      setAgentRunState("running");
      setAgentRunStartedAt(Date.now());
      setUseAgentSyntheticProgress(false);
      setActiveTool("equity_snapshot");
      setCompletedTools([]);
      showLongRunningToast("QuanAd 2.1 research may take a little while.");
      const loadingStartedAt = Date.now();
      try {
        const run = await api.createEquityResearchRun({
          ticker,
          research_depth: researchCommand?.depth ?? bestResearchModeForPlan(user.plan, researchDepth),
          source_surface: "ai_advisor",
        });
        let cursor = 0;
        let latestDetail: EquityResearchRunDetail | null = null;
        const completed = new Set<string>();

        while (true) {
          const [detail, eventList] = await Promise.all([
            api.equityResearchRun(run.run_id),
            api.equityResearchEvents(run.run_id, cursor),
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

          await delay(900);
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
          await delay(2200 - elapsedBeforeAnswer);
        }

        if (!user.is_guest) {
          await api.appendChatSessionMessage(targetSessionId, "user", text);
          await api.appendChatSessionMessage(targetSessionId, "assistant", finalMarkdown);
        }
        setMessages((prev) =>
          prev.filter((m) => m.status !== "fetching").concat({
            id: getUniqueId(),
            role: "assistant",
            content: finalMarkdown,
            researchTicker: latestDetail.run.ticker,
            researchRunId: latestDetail.run.run_id,
          })
        );
        finishLongRunningToast(
          true,
          "Analysis complete",
          `${latestDetail.run.ticker} QuanAd 2.1 research is ready.`
        );
        window.dispatchEvent(new Event("chat-sessions:changed"));
      } catch (err: any) {
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
          err instanceof Error ? err.message : "QuanAd 2.1 research could not be completed."
        );
      } finally {
        setIsLoading(false);
        isStreamingRef.current = false;
        setActiveTool(null);
        setCompletedTools([]);
        setAgentRunState("running");
        setAgentRunStartedAt(null);
        setUseAgentSyntheticProgress(false);
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
      showLongRunningToast("QuanAd 2.0 consensus analysis may take a little while.");
    } else {
      notifyWhenCompleteRef.current = false;
    }

    const assistantMsgId = getUniqueId();

    try {
      const remember = !user.is_guest;
      let res;
      try {
        const queued = await api.chatJob(text, targetSessionId, remember, mode);

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
        });
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
        res = await api.chat(text, targetSessionId, remember, mode);
      }

      const minimumPlanDuration = mode === "consensus" ? 3200 : 1800;
      const elapsedBeforeAnswer = Date.now() - loadingStartedAt;
      if (elapsedBeforeAnswer < minimumPlanDuration) {
        await new Promise((resolve) => window.setTimeout(resolve, minimumPlanDuration - elapsedBeforeAnswer));
      }
      await waitForProgressEvents();

      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: assistantMsgId,
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't process that request.",
        }).concat(investmentTicker ? [{
          id: getUniqueId(),
          role: "assistant",
          content: `Generate a full QuanAd 2.1 Research Report for ${investmentTicker}?`,
          researchTicker: investmentTicker,
        }] : [])
      );
      if (shouldNotifyLongRun) {
        finishLongRunningToast(true, "Analysis complete", "QuanAd 2.0 consensus response is ready.");
      }
      window.dispatchEvent(new Event("chat-sessions:changed"));
    } catch (err: any) {
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
          isUpgradeRequiredError(err) ? err.detail.message : err instanceof Error ? err.message : "QuanAd 2.0 analysis could not be completed."
        );
      }
    } finally {
      setIsLoading(false);
      isStreamingRef.current = false;
      setActiveTool(null);
      setCompletedTools([]);
      setAgentRunState("running");
      setAgentRunStartedAt(null);
      setUseAgentSyntheticProgress(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, type: "document" | "data" | "image") => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === "document" || type === "data") {
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

    event.target.value = "";
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-4 sm:space-y-6 sm:px-8 sm:pb-4 sm:pt-6">
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {isHistoryLoading && (
          <Card className="mx-auto max-w-fit rounded-xl border-indigo-primary/30 bg-indigo-primary/10 px-4 py-2 text-sm text-indigo-primary shadow-none">
            <CardContent className="flex items-center gap-3 p-0">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Loading chat history...</span>
            </CardContent>
          </Card>
        )}
        {messages.length === 1 && messages[0].id === "welcome" && (
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-col items-center justify-start gap-5 py-2 sm:gap-8 sm:py-8 lg:min-h-full lg:justify-center">
            <div className="w-full text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-semibold text-white sm:text-4xl md:text-5xl"
              >
                Hello{firstName ? <> <span className="gradient-highlight">{firstName}</span></> : null}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="mt-1 text-xl font-semibold leading-snug text-white/42 sm:text-3xl sm:leading-tight md:text-5xl"
              >
                Build a <span className="gradient-highlight">research trail</span> before you place the trade.
              </motion.p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowStep key={step.title} step={step} />
              ))}
            </div>
            <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {SUGGESTIONS.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.title}
                  suggestion={suggestion}
                  onClick={() => setInput(suggestion.prompt)}
                />
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
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
                        <Markdown content={msg.content} />
                        <div className="rounded-xl border border-indigo-primary/25 bg-indigo-primary/10 p-3">
                          <p className="text-sm font-semibold text-white">
                            {msg.researchRunId ? "QuanAd 2.1 Agent Reports" : "Generate a full QuanAd 2.1 Research Report?"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/55">
                            {msg.researchRunId
                              ? `Open the full workspace to review each analyst report, tool event, and the shared data snapshot for ${msg.researchTicker}.`
                              : `Run market, news, sentiment, fundamentals, trading, and risk-management agents for ${msg.researchTicker}.`}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              href={msg.researchRunId ? `/research/${msg.researchRunId}?from=ai_advisor` : `/research?ticker=${encodeURIComponent(msg.researchTicker)}&source=ai_advisor`}
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
                      <AssistantMessageContent content={msg.content} />
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-1 sm:px-8 sm:pb-6 sm:pt-0">
        <motion.div
          layout
          ref={wrapperRef}
          onClick={() => setIsActive(true)}
          className="mx-auto w-full max-w-5xl overflow-visible rounded-[24px] border bg-white/[0.045] p-1.5 text-white transition-colors sm:p-2 cursor-text"
          animate={{
            borderColor: isActive || input ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
            backgroundColor: isActive || input ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.035)",
            boxShadow: isActive || input ? "0 8px 32px 0 rgba(0,0,0,0.25)" : "var(--shadow-accent-composer)",
          }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <div className="relative flex items-end">
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
              className="relative z-10 w-full max-h-[240px] min-h-12 border-transparent bg-transparent px-3 py-3 text-sm text-white focus-visible:border-transparent focus-visible:ring-0 sm:min-h-14 sm:px-4 sm:py-3.5 resize-none overflow-y-auto"
            />
            <div className="absolute inset-0 pointer-events-none flex items-start px-3 py-3 sm:px-4 sm:py-3.5">
              <AnimatePresence mode="wait">
                {showPlaceholder && !isActive && !input && (
                  <motion.span
                    key={placeholderIndex}
                    className="text-sm text-white/24 select-none pointer-events-none max-w-full overflow-hidden text-ellipsis whitespace-nowrap mt-0.5"
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
          <AnimatePresence>
            {(isActive || input) && (
              <motion.div
                initial={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                exit={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                transition={{ duration: 0.25 }}
                className="relative z-20"
              >
                <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-1.5 pt-2 sm:gap-3 sm:px-2 sm:pt-3">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <UploadPill
                      icon={Paperclip}
                      label="PDF"
                      accept=".pdf,.txt,.md"
                      onChange={(event) => handleUpload(event, "document")}
                    />
                    <UploadPill
                      icon={TableProperties}
                      label="Data"
                      accept=".csv,.json,.txt"
                      onChange={(event) => handleUpload(event, "data")}
                    />
                    <UploadPill
                      icon={Image}
                      label="Image"
                      accept="image/*"
                      onChange={(event) => handleUpload(event, "image")}
                    />
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <ResearchModeSelector
                      plan={user.plan}
                      value={researchDepth}
                      onChange={setResearchDepth}
                      visible={version === "2.1"}
                    />
                    <ModelSelector placement="top" compact />
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <p className="mt-2 text-center text-[11px] text-white/20 sm:mt-3 sm:text-xs">
          AI-generated analysis only. Not professional financial advice.
        </p>
      </div>
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

function AssistantMessageContent({ content }: { content: string }) {
  const prediction = parsePredictionSummary(content);

  if (!prediction) {
    return <Markdown content={content} />;
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
      <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className={cn(label === "Model Performance" ? "sm:col-span-2" : "", "min-w-0")}>
              <div className="text-[11px] font-medium uppercase tracking-normal text-white/45">{label}</div>
              <div className="mt-1 break-words text-sm font-semibold text-white/90">{value}</div>
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

function SuggestionCard({
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

  const moveSpotlight = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--y", `${event.clientY - rect.top}px`);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onMouseMove={moveSpotlight}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 text-left text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_12px_32px_rgba(0,0,0,0.24)] transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-indigo-primary/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.055] text-indigo-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold text-white/88">{suggestion.title}</div>
        <p className="mt-1 text-sm leading-relaxed text-white/42">{suggestion.description}</p>
      </div>
    </Card>
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

function UploadPill({
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
    <label className="group flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 text-xs font-medium text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.075] hover:text-white">
      <Icon className="h-4 w-4 text-white/38 group-hover:text-indigo-primary" />
      <span className="hidden sm:inline">{label}</span>
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}
