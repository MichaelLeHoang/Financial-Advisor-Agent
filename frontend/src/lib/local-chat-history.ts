import type { ChatMessage, ChatSession } from "@/lib/api";

const LOCAL_CHAT_STORAGE_KEY = "quanad.guestChatSessions";
const LEGACY_CHAT_STORAGE_KEYS = [
  LOCAL_CHAT_STORAGE_KEY,
  "financial-advisor.chat",
  "financial-advisor.chatHistory",
  "financial-advisor.messages",
  "financial-advisor.sessions",
  "quanad.chat",
  "quanad.chatHistory",
  "quanad.chatSessions",
  "chatHistory",
  "chatSessions",
];

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
  if (!firstUserMessage) return "New chat";
  const clean = firstUserMessage.replace(/\s+/g, " ");
  const stopWords = new Set(["a", "about", "and", "are", "can", "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "please", "should", "the", "to", "what", "with", "you"]);
  const words = clean.match(/[A-Za-z][A-Za-z0-9.$'-]*|\$?[A-Z]{1,5}(?:\.[A-Z]{1,3})?/g) ?? [];
  const keywords = words
    .map((word) => word.replace(/[.,?!:;"'()[\]{}]/g, ""))
    .filter((word) => word && !stopWords.has(word.toLowerCase()))
    .slice(0, 5);
  return keywords.length >= 3 ? keywords.join(" ") : clean.split(/\s+/).slice(0, 5).join(" ");
}

export function listLocalChatSessions(): ChatSession[] {
  return readSessions()
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
    title: existingIndex >= 0 && !["New chat", "New analysis"].includes(sessions[existingIndex].title)
      ? sessions[existingIndex].title
      : defaultTitle(meaningfulMessages),
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

export function createLocalChatSession(sessionId: string, title = "New chat") {
  const sessions = readSessions();
  if (sessions.some((session) => session.session_id === sessionId)) return;
  const now = new Date().toISOString();
  sessions.unshift({
    session_id: sessionId,
    title,
    message_count: 0,
    last_active: now,
    messages: [],
  });
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

export function clearLocalChatHistory() {
  if (typeof window === "undefined") return;
  const shouldClearKey = (key: string) => {
    const normalized = key.toLowerCase();
    return LEGACY_CHAT_STORAGE_KEYS.includes(key)
      || (normalized.includes("chat") && (normalized.includes("quanad") || normalized.includes("financial-advisor")));
  };

  for (const key of LEGACY_CHAT_STORAGE_KEYS) {
    try {
      window.sessionStorage?.removeItem(key);
      window.localStorage?.removeItem(key);
    } catch {
      // Ignore storage access failures in private browsing or restricted contexts.
    }
  }
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
      for (const key of keys) {
        if (shouldClearKey(key)) storage.removeItem(key);
      }
    } catch {
      // Ignore storage access failures in private browsing or restricted contexts.
    }
  }
}

export function notifyChatPrivacyReset() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("chat-privacy:reset"));
  window.dispatchEvent(new Event("chat-sessions:changed"));
}
