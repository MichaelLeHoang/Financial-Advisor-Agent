"use client";

import { useState, useCallback } from "react";
import { api, isRedisUnavailableError } from "@/lib/api";

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

    (async () => {
      try {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, content: "Queued for analysis..." } : m
          )
        );
        let res;
        try {
          const queued = await api.chatJob(text, sessionId, true, "single");
          res = await api.waitForChatJob(queued.job_id, (job) => {
            if (job.status === "queued") {
              const positionText = job.queue_position ? ` Position ${job.queue_position}.` : "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: `Queued for analysis.${positionText}` } : m
                )
              );
            } else if (job.status === "running") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: "Analyzing market context..." } : m
                )
              );
            }
          });
        } catch (queueError) {
          if (!isRedisUnavailableError(queueError)) throw queueError;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMsgId ? { ...m, content: "Analyzing market context..." } : m
            )
          );
          res = await api.chat(text, sessionId, true, "single");
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: res.response || "I'm sorry, I couldn't process that request.", streaming: false }
              : m
          )
        );
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? { ...m, content: `Error: ${err.message}`, streaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    })();
  }, [isStreaming, sessionId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, isStreaming, clearHistory };
}
