"use client";

import { useRef, useEffect, useState } from "react";
import type { ChangeEvent, ComponentType, MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Brain, ClipboardList, Image, Loader2, Paperclip, PieChart, Send, TableProperties, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, isUpgradeRequiredError } from "@/lib/api";
import { getDemoChatConversation } from "@/lib/demo-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import ModelSelector, { useModel, apiModeFromVersion } from "@/components/ModelSelector";
import UpgradePrompt from "@/components/common/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "fetching" | "done";
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

const placeholderContainerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.015 } },
  exit: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const letterVariants = {
  initial: { opacity: 0, filter: "blur(12px)", y: 10 },
  animate: {
    opacity: 1, filter: "blur(0px)", y: 0,
    transition: { opacity: { duration: 0.25 }, filter: { duration: 0.4 }, y: { type: "spring", stiffness: 80, damping: 20 } },
  },
  exit: {
    opacity: 0, filter: "blur(12px)", y: -10,
    transition: { opacity: { duration: 0.2 }, filter: { duration: 0.3 }, y: { type: "spring", stiffness: 80, damping: 20 } },
  },
};

export default function ChatPage() {
  const { user } = useAuth();
  const { version } = useModel();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("session") || "default";
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const firstName = getFirstName(user?.display_name || user?.email || "");

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
    let cancelled = false;

    async function loadSession() {
      setIsHistoryLoading(true);
      setUpgradeMessage(null);

      try {
        const res = await api.chatSessionMessages(activeSessionId);
        if (cancelled) return;

        const loadedMessages = res.messages.map((message) => ({
          id: String(message.id),
          role: message.role,
          content: message.content,
        }));
        const demoConversation = getDemoChatConversation(activeSessionId);
        const demoMessages = demoConversation?.messages.map((message) => ({
          id: String(message.id),
          role: message.role,
          content: message.content,
        })) ?? [];
        setMessages(loadedMessages.length > 0 ? loadedMessages : demoMessages.length > 0 ? demoMessages : [GREETING]);
      } catch (err: any) {
        if (cancelled) return;
        const demoConversation = getDemoChatConversation(activeSessionId);
        if (demoConversation) {
          setMessages(
            demoConversation.messages.map((message) => ({
              id: String(message.id),
              role: message.role,
              content: message.content,
            }))
          );
          return;
        }
        setMessages([
          {
            id: "history-error",
            role: "assistant",
            content: `Unable to load this chat history: ${err.message}`,
          },
        ]);
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    }

    loadSession();
    setInput("");

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const fetchingLabel = version === "2.0"
      ? "Running multi-agent consensus analysis..."
      : "Analyzing market context...";
    const fetchingMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: fetchingLabel, status: "fetching" };

    setMessages((prev) => [...prev, userMsg, fetchingMsg]);
    setIsLoading(true);
    setUpgradeMessage(null);

    try {
      const mode = apiModeFromVersion(version);
      const res = await api.chat(text, activeSessionId, true, mode);
      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't process that request.",
        })
      );
      window.dispatchEvent(new Event("chat-sessions:changed"));
    } catch (err: any) {
      if (isUpgradeRequiredError(err)) {
        setUpgradeMessage(err.detail.message);
      }
      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: isUpgradeRequiredError(err) ? err.detail.message : `Error: ${err.message}`,
        })
      );
    } finally {
      setIsLoading(false);
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
      <div className="absolute left-4 top-3 z-20 sm:left-8 sm:top-6">
        <ModelSelector />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-16 sm:space-y-6 sm:px-8 sm:pb-4 sm:pt-24">
        {upgradeMessage && <UpgradePrompt message={upgradeMessage} />}
        {isHistoryLoading && (
          <Card className="mx-auto max-w-fit rounded-xl border-indigo-primary/30 bg-indigo-primary/10 px-4 py-2 text-sm text-indigo-primary shadow-none">
            <CardContent className="flex items-center gap-3 p-0">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Loading chat history...</span>
            </CardContent>
          </Card>
        )}
        {messages.length === 1 && (
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
                <Card className="max-w-full rounded-xl border-indigo-primary/30 bg-indigo-primary/10 px-4 py-2 text-sm text-indigo-primary shadow-none">
                  <CardContent className="flex items-center gap-3 p-0">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="truncate">{msg.content}</span>
                  </CardContent>
                </Card>
              ) : (
                <div
                  className={cn(
                    "min-w-0 max-w-[92%] break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap sm:max-w-[75%] sm:px-5 sm:py-4",
                    msg.role === "user"
                      ? "on-accent accent-gradient-surface glow-indigo"
                      : "glass text-white/90"
                  )}
                >
                  {msg.content}
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
          className="mx-auto w-full max-w-5xl overflow-hidden rounded-[24px] border bg-white/[0.045] p-1.5 text-white transition-colors sm:p-2 cursor-text"
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
              className="relative z-10 w-full max-h-[240px] min-h-12 border-transparent bg-transparent pl-3 pr-12 py-3 text-sm text-white focus-visible:border-transparent focus-visible:ring-0 sm:min-h-14 sm:pl-4 sm:pr-14 sm:py-3.5 resize-none overflow-y-auto"
            />
            <div className="absolute inset-0 pointer-events-none flex items-start pl-3 pr-12 py-3 sm:pl-4 sm:pr-14 sm:py-3.5">
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
            
            <div className="absolute right-1.5 bottom-1.5 z-20 sm:right-2 sm:bottom-2">
              <Button
                onClick={handleSend}
                disabled={isLoading}
                size="icon"
                className="on-accent accent-gradient-surface h-9 w-9 shrink-0 rounded-xl shadow-[var(--shadow-primary-action)] hover:shadow-[var(--shadow-primary-action-hover)]"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <AnimatePresence>
            {(isActive || input) && (
              <motion.div
                initial={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                exit={{ opacity: 0, height: 0, filter: "blur(8px)" }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
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
