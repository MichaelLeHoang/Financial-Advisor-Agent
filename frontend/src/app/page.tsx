"use client";

import { useRef, useEffect, useState } from "react";
import type { ChangeEvent, ComponentType, MouseEvent } from "react";
import { Brain, Image, Loader2, Paperclip, PieChart, Send, TableProperties, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "fetching" | "done";
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

const currentUserName = "Michael";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: "Hello! I'm your Quantum AI Financial Advisor. How can I help you optimize your wealth today?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const fetchingMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "📈 Analyzing...", status: "fetching" };

    setMessages((prev) => [...prev, userMsg, fetchingMsg]);
    setIsLoading(true);

    try {
      const res = await api.chat(text);
      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't process that request.",
        })
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((m) => m.status !== "fetching").concat({
          id: Date.now().toString(),
          role: "assistant",
          content: `⚠️ Error: ${err.message}`,
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
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.length === 1 && (
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center space-y-8">
            <div className="w-full max-w-3xl space-y-1 text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-semibold bg-gradient-to-r from-white via-indigo-primary to-cyan-secondary bg-clip-text text-transparent"
              >
                Hello {currentUserName}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="text-4xl md:text-5xl font-semibold text-white/42"
              >
                How can I help you today?
              </motion.p>
            </div>
            <div className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
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
              className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.status === "fetching" ? (
                <div className="glass px-4 py-2 rounded-xl flex items-center gap-3 text-sm text-indigo-primary border-indigo-primary/30">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {msg.content}
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[70%] p-4 rounded-2xl whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-indigo-primary text-white glow-indigo"
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
      <div className="p-8 pt-0">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.045] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.38),0_0_54px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-colors focus-within:border-indigo-primary/45 focus-within:shadow-[0_0_0_1px_rgba(99,102,241,0.28),0_18px_50px_rgba(0,0,0,0.42),0_0_70px_rgba(99,102,241,0.12)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything about markets, stocks, or your portfolio..."
            rows={2}
            className="max-h-36 min-h-14 w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm text-white outline-none placeholder:text-white/24"
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-2 pt-2">
            <div className="flex items-center gap-1.5">
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
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-primary text-white shadow-[0_0_0_1px_rgba(99,102,241,0.55),0_8px_22px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:bg-indigo-primary/90 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.65),0_12px_30px_rgba(99,102,241,0.36),inset_0_1px_0_rgba(255,255,255,0.24)] active:scale-[0.98] disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs mt-3 text-white/20">
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

  const moveSpotlight = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--y", `${event.clientY - rect.top}px`);
  };

  return (
    <button
      type="button"
      onMouseMove={moveSpotlight}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-4 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_14px_38px_rgba(0,0,0,0.32)] transition-all duration-200 hover:-translate-y-1 hover:border-white/[0.12] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_46px_rgba(0,0,0,0.42),0_0_60px_rgba(99,102,241,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: "radial-gradient(260px circle at var(--x, 50%) var(--y, 50%), rgba(99,102,241,0.16), transparent 42%)" }} />
      <div className="relative">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.055] text-indigo-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold text-white/88">{suggestion.title}</div>
        <p className="mt-1 text-sm leading-relaxed text-white/42">{suggestion.description}</p>
      </div>
    </button>
  );
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
    <label className="group flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 text-xs font-medium text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.075] hover:text-white">
      <Icon className="h-4 w-4 text-white/38 group-hover:text-indigo-primary" />
      <span className="hidden sm:inline">{label}</span>
      <input type="file" accept={accept} className="sr-only" onChange={onChange} />
    </label>
  );
}
