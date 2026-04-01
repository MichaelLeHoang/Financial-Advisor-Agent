"use client";

import { useState, useRef, useCallback } from "react";
import { wsUrl } from "@/lib/api";

export type MessageRole = "user" | "assistant";

export interface ToolCall {
  tool: string;
  input?: string;
  result?: string;
  status: "running" | "done";
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
}

export function useAgentChat(sessionId = "default") {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const agentMsgId = crypto.randomUUID();
    const agentMsg: Message = {
      id: agentMsgId,
      role: "assistant",
      content: "",
      toolCalls: [],
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setIsStreaming(true);

    const ws = new WebSocket(wsUrl(sessionId));
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ message: text, remember: true }));

    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);

      if (data.type === "token") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, content: m.content + data.content } : m
          )
        );
      } else if (data.type === "tool_start") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? {
                  ...m,
                  toolCalls: [...(m.toolCalls ?? []), {
                    tool: data.tool,
                    input: data.input,
                    status: "running",
                  }],
                }
              : m
          )
        );
      } else if (data.type === "tool_end") {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== agentMsgId) return m;
            return {
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.tool === data.tool && tc.status === "running"
                  ? { ...tc, result: data.result, status: "done" }
                  : tc
              ),
            };
          })
        );
      } else if (data.type === "done") {
        setMessages((prev) =>
          prev.map((m) => m.id === agentMsgId ? { ...m, streaming: false } : m)
        );
        setIsStreaming(false);
        ws.close();
      } else if (data.type === "error") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: `⚠️ Error: ${data.message}`, streaming: false }
              : m
          )
        );
        setIsStreaming(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setIsStreaming(false);
      ws.close();
    };
  }, [isStreaming, sessionId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, isStreaming, clearHistory };
}
