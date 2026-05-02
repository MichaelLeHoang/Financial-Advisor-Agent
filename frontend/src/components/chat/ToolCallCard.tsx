import { Loader2, CheckCircle2, Wrench } from "lucide-react";
import type { ToolCall } from "@/hooks/useAgentChat";

const TOOL_LABELS: Record<string, string> = {
  get_stock_info:         "📈 Fetching stock data",
  analyze_sentiment:      "🧠 Analyzing sentiment",
  predict_stock_price:    "🔮 Running ML prediction",
  optimize_portfolio_tool:"⚖️ Optimizing portfolio",
};

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const label = TOOL_LABELS[toolCall.tool] ?? `🔧 ${toolCall.tool}`;
  const done = toolCall.status === "done";

  return (
    <div className={`glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 transition-all duration-300 ${done ? "opacity-70" : ""}`}>
      {done
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-green)" }} />
        : <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: "var(--accent)" }} />
      }
      <span style={{ color: done ? "var(--text-secondary)" : "var(--text-primary)" }}>
        {label}
        {done && toolCall.result && (
          <span className="ml-2" style={{ color: "var(--text-muted)" }}>
            — done
          </span>
        )}
      </span>
    </div>
  );
}
