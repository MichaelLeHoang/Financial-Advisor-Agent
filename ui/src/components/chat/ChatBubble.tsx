import { User, Bot, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/hooks/useAgentChat";
import { ToolCallCard } from "./ToolCallCard";

export function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`message-enter flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          background: isUser ? "var(--accent)" : "rgba(255,255,255,0.06)",
          border: "1px solid var(--border)",
          boxShadow: isUser ? "0 0 12px var(--accent-glow)" : "none",
        }}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" style={{ color: "var(--accent-cyan)" }} />}
      </div>

      {/* Content */}
      <div className={`group flex flex-col gap-2 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 w-full">
            {message.toolCalls.map((tc, i) => <ToolCallCard key={i} toolCall={tc} />)}
          </div>
        )}

        {/* Text bubble */}
        {(message.content || message.streaming) && (
          <div
            className="relative rounded-2xl px-4 py-3 text-sm leading-relaxed"
            style={{
              background: isUser ? "var(--accent)" : "var(--bg-card)",
              border: `1px solid ${isUser ? "transparent" : "var(--border)"}`,
              borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            }}
          >
            {/* Streaming cursor */}
            {message.streaming && !message.content && (
              <div className="flex gap-1 items-center h-5">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
              </div>
            )}
            <span className="whitespace-pre-wrap">{message.content}</span>
            {message.streaming && message.content && (
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-current opacity-70 animate-pulse align-text-bottom" />
            )}

            {/* Copy button (agent only) */}
            {!isUser && !message.streaming && message.content && (
              <button
                onClick={copy}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                {copied ? <Check className="w-3.5 h-3.5" style={{ color: "var(--accent-green)" }} /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
