const SUGGESTIONS = [
  "Should I buy NVDA right now?",
  "What's the sentiment on AAPL?",
  "Optimize a portfolio of AAPL, MSFT, GOOGL",
  "Predict TSLA's price direction",
  "Compare NVDA vs AMD",
];

export function SuggestionChips({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="glass px-3 py-1.5 rounded-full text-sm transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-secondary)" }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
