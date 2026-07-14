"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MessageSquare, Search } from "lucide-react";

import { api } from "@/lib/api";
import type { ChatMessage, ChatSession } from "@/lib/api";
import { loadLocalChatMessages, listLocalChatSessions } from "@/lib/local-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type SearchConversation = ChatSession & {
  messages: ChatMessage[];
};

export default function ChatSearchDialog({
  open,
  onOpenChange,
  sessions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSession[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<SearchConversation[]>([]);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handlePrivacyReset = () => {
      setConversations([]);
      setHoveredSessionId(null);
      setQuery("");
    };

    window.addEventListener("chat-privacy:reset", handlePrivacyReset);
    return () => window.removeEventListener("chat-privacy:reset", handlePrivacyReset);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadConversations() {
      setLoading(true);

      try {
        if (user.is_guest) {
          const localSessions = sessions.length > 0 ? sessions : listLocalChatSessions();
          const localConversations = localSessions.map((session) => ({
            ...session,
            messages: loadLocalChatMessages(session.session_id),
          }));
          if (cancelled) return;
          setConversations(localConversations);
          setHoveredSessionId((current) => current ?? localConversations[0]?.session_id ?? null);
          return;
        }

        const sourceSessions = sessions.length > 0 ? sessions : await api.chatSessions();
        const realConversations = await Promise.all(
          sourceSessions.map(async (session) => {
            const response = await api.chatSessionMessages(session.session_id);
            return { ...session, messages: response.messages };
          })
        );

        if (cancelled) return;
        setConversations(realConversations);
        setHoveredSessionId((current) => current ?? realConversations[0]?.session_id ?? null);
      } catch {
        if (cancelled) return;
        setConversations([]);
        setHoveredSessionId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [open, sessions, user.id, user.is_guest]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.title,
        conversation.messages.map((message) => message.content).join(" "),
      ].join(" ").toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [conversations, query]);

  const previewConversation = useMemo(() => {
    return filteredConversations.find((conversation) => conversation.session_id === hoveredSessionId)
      ?? filteredConversations[0]
      ?? null;
  }, [filteredConversations, hoveredSessionId]);

  useEffect(() => {
    if (!filteredConversations.some((conversation) => conversation.session_id === hoveredSessionId)) {
      setHoveredSessionId(filteredConversations[0]?.session_id ?? null);
    }
  }, [filteredConversations, hoveredSessionId]);

  const openConversation = (conversation: SearchConversation) => {
    router.push(`/session/${encodeURIComponent(conversation.session_id)}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] p-0 sm:w-[min(92vw,820px)]">
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5 pb-2">
          <DialogTitle>Search chats</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Search by ticker, thesis, risk, or headline..."
              className="h-11 rounded-xl pl-10"
            />
          </div>

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card className="min-h-0 py-0" size="sm">
              <CardHeader className="px-4 p-1">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare data-icon="inline-start" />
                  Conversations
                </CardTitle>
                <Separator />
                <CardDescription>
                  {loading ? "Loading conversations..." : `${filteredConversations.length} matching chats`}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 px-2 pb-2">
                {filteredConversations.length > 0 ? (
                  <ScrollArea className="h-[14rem] rounded-xl lg:h-[20rem]">
                    <div className="flex flex-col gap-1 p-1">
                      {filteredConversations.map((conversation) => (
                        <button
                          key={conversation.session_id}
                          type="button"
                          onMouseEnter={() => setHoveredSessionId(conversation.session_id)}
                          onFocus={() => setHoveredSessionId(conversation.session_id)}
                          onClick={() => openConversation(conversation)}
                          className={cn(
                            "flex w-full flex-col gap-2 rounded-xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                            previewConversation?.session_id === conversation.session_id
                              ? "bg-[var(--surface-card-hover)] text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold">{conversation.title}</span>
                          </span>
                          <span className="block truncate text-xs leading-5 text-[var(--text-tertiary)]">
                            {conversation.messages[0]?.content ?? "No messages yet."}
                          </span>
                          <span className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                            <Clock className="size-3" aria-hidden="true" />
                            {formatRelativeDate(conversation.last_active)}
                            <span>{conversation.message_count} messages</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Empty className="min-h-[18rem]">
                    <EmptyTitle>No chats found</EmptyTitle>
                    <EmptyDescription>Try searching for a ticker, theme, or risk keyword.</EmptyDescription>
                  </Empty>
                )}
              </CardContent>
            </Card>

            <Card className="min-h-0 py-0" size="sm">
              <CardHeader className="px-4 ">
                <CardTitle className="truncate text-sm">
                  {previewConversation?.title ?? "Preview"}
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="min-h-0 px-4 pb-4">
                {previewConversation ? (
                  <ScrollArea className="h-[14rem] rounded-xl lg:h-[20rem]">
                    <div className="flex flex-col gap-3 pr-3">
                      {previewConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-2xl px-4 py-3 text-sm leading-6",
                            message.role === "user"
                              ? "ml-auto max-w-[86%] theme-accent-surface on-accent"
                              : "mr-auto max-w-[92%] bg-[var(--surface-card-hover)] text-[var(--text-secondary)]"
                          )}
                        >
                          {message.content}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <Empty className="min-h-[18rem]">
                    <EmptyTitle>No preview available</EmptyTitle>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recent";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
