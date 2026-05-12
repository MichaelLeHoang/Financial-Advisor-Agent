import type { ChatMessage, ChatSession } from "@/lib/api";

export type DemoChatConversation = ChatSession & {
  messages: ChatMessage[];
};

export const DEMO_CHAT_CONVERSATIONS: DemoChatConversation[] = [
  {
    session_id: "demo-market-risk",
    title: "NVDA earnings risk review",
    message_count: 4,
    last_active: "2026-05-10T14:30:00Z",
    messages: [
      { id: "d1", role: "user", content: "Run a quick risk review for NVDA before earnings." },
      { id: "d2", role: "assistant", content: "The setup is momentum-heavy. Watch data center growth, gross margin guide, and capex commentary from hyperscalers." },
      { id: "d3", role: "user", content: "What would invalidate the bullish case?" },
      { id: "d4", role: "assistant", content: "A material slowdown in accelerator demand, weaker forward margin, or evidence of cloud customers pausing AI infrastructure orders." },
    ],
  },
  {
    session_id: "demo-portfolio-balance",
    title: "Rebalance growth portfolio",
    message_count: 5,
    last_active: "2026-05-09T18:05:00Z",
    messages: [
      { id: "d5", role: "user", content: "Check AAPL, MSFT, GOOGL, and VOO for concentration risk." },
      { id: "d6", role: "assistant", content: "The portfolio leans mega-cap tech. VOO helps, but the overlap still leaves earnings-cycle exposure clustered in the same growth factor." },
      { id: "d7", role: "user", content: "Suggest one defensive adjustment." },
      { id: "d8", role: "assistant", content: "Trim single-name overweight first, then add a lower-beta sleeve or cash buffer instead of forcing a sector rotation." },
      { id: "d9", role: "assistant", content: "The key is lowering drawdown sensitivity without abandoning the portfolio thesis." },
    ],
  },
  {
    session_id: "demo-sentiment-brief",
    title: "AAPL sentiment brief",
    message_count: 3,
    last_active: "2026-05-08T12:12:00Z",
    messages: [
      { id: "d10", role: "user", content: "Summarize recent AAPL sentiment and what could move the stock next." },
      { id: "d11", role: "assistant", content: "The narrative is balanced: services resilience supports valuation, while hardware replacement-cycle uncertainty caps enthusiasm." },
      { id: "d12", role: "assistant", content: "Near-term movement likely depends on China demand signals, AI product credibility, and buyback commentary." },
    ],
  },
  {
    session_id: "demo-quantum-selection",
    title: "Quantum stock selection",
    message_count: 4,
    last_active: "2026-05-07T21:44:00Z",
    messages: [
      { id: "d13", role: "user", content: "Use quantum selection for AAPL, MSFT, NVDA, TSLA, and AMZN." },
      { id: "d14", role: "assistant", content: "The highest-probability basket favors NVDA, MSFT, and AMZN under the current risk tolerance." },
      { id: "d15", role: "user", content: "Why exclude TSLA?" },
      { id: "d16", role: "assistant", content: "Its volatility contribution dominates the small basket and reduces the risk-adjusted outcome in this configuration." },
    ],
  },
  {
    session_id: "demo-rate-cut-watch",
    title: "Rate cut watchlist",
    message_count: 4,
    last_active: "2026-05-06T15:18:00Z",
    messages: [
      { id: "d17", role: "user", content: "Build a watchlist for stocks that could benefit from rate cuts." },
      { id: "d18", role: "assistant", content: "Focus on long-duration growth, quality REITs, and profitable small-cap names with refinancing sensitivity." },
      { id: "d19", role: "user", content: "What is the main risk?" },
      { id: "d20", role: "assistant", content: "The main risk is that rate cuts arrive because growth deteriorates, which can offset multiple expansion." },
    ],
  },
];

export const DEMO_CHAT_SESSIONS: ChatSession[] = DEMO_CHAT_CONVERSATIONS.map(
  ({ session_id, title, message_count, last_active }) => ({
    session_id,
    title,
    message_count,
    last_active,
  })
);

export function getDemoChatConversation(sessionId: string) {
  return DEMO_CHAT_CONVERSATIONS.find((conversation) => conversation.session_id === sessionId) ?? null;
}

export function isDemoChatSession(sessionId: string) {
  return DEMO_CHAT_CONVERSATIONS.some((conversation) => conversation.session_id === sessionId);
}
