import type { InvestmentDecisionRecord, InvestmentThesis, PortfolioBookEvent, RecurringBuy } from "@/lib/api";

export interface InvestmentActivityItem {
  id: string;
  symbol: string;
  label: string;
  detail: string;
  at: string;
  kind: "decision" | "thesis" | "classification" | "purchase";
}

export function buildInvestmentActivity(
  decisions: InvestmentDecisionRecord[],
  theses: InvestmentThesis[],
  events: PortfolioBookEvent[],
  buys: RecurringBuy[],
): InvestmentActivityItem[] {
  return [
    ...decisions.map((item): InvestmentActivityItem => ({
      id: item.id,
      symbol: item.symbol,
      label: `${capitalize(item.action)} decision recorded`,
      detail: "Owner decision",
      at: item.created_at,
      kind: "decision",
    })),
    ...theses.map((item): InvestmentActivityItem => ({
      id: `thesis-${item.id}-${item.updated_at}`,
      symbol: item.symbol,
      label: "Ownership thesis updated",
      detail: thesisHealth(item),
      at: item.updated_at,
      kind: "thesis",
    })),
    ...events.filter((item) => item.new_book_type === "investment").map((item): InvestmentActivityItem => ({
      id: item.id,
      symbol: item.symbol,
      label: "Classified as Investment",
      detail: "Portfolio book",
      at: item.created_at,
      kind: "classification",
    })),
    ...buys.map((item): InvestmentActivityItem => ({
      id: item.id,
      symbol: item.symbol,
      label: "Recurring purchase recorded",
      detail: formatMoney(item.entered_amount, item.entered_currency),
      at: item.executed_at,
      kind: "purchase",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

function thesisHealth(thesis: InvestmentThesis) {
  if (thesis.status === "invalidated") return "Invalidated";
  if (thesis.status === "needs_review" || (thesis.next_review_at && new Date(thesis.next_review_at) < new Date())) return "Needs review";
  return "Healthy";
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
