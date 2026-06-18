import type { ChatMessage, ChatSession } from "@/lib/api";

const LOCAL_CHAT_STORAGE_KEY = "quanad.guestChatSessions";

type StoredSession = ChatSession & {
  messages: ChatMessage[];
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readSessions(): StoredSession[] {
  if (!canUseSessionStorage()) return [];
  try {
    const raw = window.sessionStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.sessionStorage.removeItem(LOCAL_CHAT_STORAGE_KEY);
    return [];
  }
}

function writeSessions(sessions: StoredSession[]) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(sessions));
}

function defaultTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "New analysis";
  return firstUserMessage.replace(/\s+/g, " ").slice(0, 64);
}

export function listLocalChatSessions(): ChatSession[] {
  return readSessions()
    .filter((session) => session.messages.some((message) => message.role === "user"))
    .map(({ messages: _messages, ...session }) => session)
    .sort((a, b) => Date.parse(b.last_active) - Date.parse(a.last_active));
}

export function loadLocalChatMessages(sessionId: string): ChatMessage[] {
  return readSessions().find((session) => session.session_id === sessionId)?.messages ?? [];
}

export function saveLocalChatMessages(sessionId: string, messages: ChatMessage[]) {
  const meaningfulMessages = messages.filter((message) => message.role === "user" || message.role === "assistant");
  if (!meaningfulMessages.some((message) => message.role === "user")) return;

  const sessions = readSessions();
  const existingIndex = sessions.findIndex((session) => session.session_id === sessionId);
  const now = new Date().toISOString();
  const nextSession: StoredSession = {
    session_id: sessionId,
    title: existingIndex >= 0 ? sessions[existingIndex].title : defaultTitle(meaningfulMessages),
    message_count: meaningfulMessages.length,
    last_active: now,
    messages: meaningfulMessages,
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = nextSession;
  } else {
    sessions.push(nextSession);
  }

  writeSessions(sessions);
}

export function renameLocalChatSession(sessionId: string, title: string) {
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.session_id === sessionId);
  if (index < 0) return;
  sessions[index] = {
    ...sessions[index],
    title: title.trim().slice(0, 64) || sessions[index].title,
    last_active: new Date().toISOString(),
  };
  writeSessions(sessions);
}

export function deleteLocalChatSession(sessionId: string) {
  writeSessions(readSessions().filter((session) => session.session_id !== sessionId));
}
