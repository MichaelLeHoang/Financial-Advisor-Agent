"use client";

import { useRef, useEffect, useState } from "react";
import { Send, RotateCcw, Sparkles } from "lucide-react";
import { useAgentChat } from "@/hooks/useAgentChat";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { SuggestionChips } from "@/components/chat/SuggestionChips";

export default function ChatPage() {
  const { messages, sendMessage, isStreaming, clearHistory } = useAgentChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 h-16 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "rgba(7,8,11,0.8)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h1 className="font-semibold" style={{ color: "var(--text-primary)" }}>Financial Advisor AI</h1>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg glass transition-colors hover:text-[var(--accent-red)]"
          style={{ color: "var(--text-muted)" }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New chat
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 mt-16 text-center">
              <div>
                <h2 className="text-3xl font-bold glow-text mb-2">What would you like to know?</h2>
                <p style={{ color: "var(--text-muted)" }}>
                  Ask me about stocks, portfolio optimization, market sentiment, or price predictions.
                </p>
              </div>
              <SuggestionChips onSelect={(s) => { sendMessage(s); }} />
            </div>
          )}

          {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-4 border-t"
        style={{ borderColor: "var(--border)", background: "rgba(7,8,11,0.9)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div
            className="flex-1 glass rounded-2xl flex items-end gap-2 px-4 py-3 transition-all"
            style={{
              borderColor: input ? "var(--accent)" : "var(--border)",
              boxShadow: input ? "0 0 0 1px var(--accent-glow)" : "none",
            }}
          >
            <textarea
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed"
              style={{
                color: "var(--text-primary)",
                maxHeight: "120px",
                fontFamily: "inherit",
              }}
              placeholder="Ask about any stock, portfolio, or market..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              boxShadow: input.trim() && !isStreaming ? "0 0 16px var(--accent-glow)" : "none",
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          AI-generated analysis only. Not professional financial advice.
        </p>
      </div>
    </div>
  );
}
