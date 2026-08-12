import type {
  BacktestTemplate,
  StrategyDraft,
  StrategyMode,
  StrategyNode,
  StrategyProposal,
  StrategyValidationIssue,
} from "@/components/strategy-studio/types";

const INVESTMENT_NODES: StrategyNode[] = [
  node("investment-universe", "universe", "US quality universe", "Large-cap US equities and ETFs", { symbols: "MSFT,NVDA,VOO" }, [
    node("investment-filter", "filter", "Quality filter", "Positive free cash flow and durable margins", { minimumMargin: 20 }),
    node("investment-rank", "rank", "Rank by quality", "Favor profitability, stability, and valuation", { top: 10 }),
  ]),
  node("investment-weight", "weight", "Equal weight", "Allocate evenly across selected holdings", { maximumWeight: 12 }),
  node("investment-risk", "risk", "Concentration guard", "Keep each position below the policy maximum", { maximumWeight: 12 }),
  node("investment-schedule", "schedule", "Quarterly review", "Evaluate drift on the first market day of each quarter", { cadence: "quarterly" }),
];

const TRADING_NODES: StrategyNode[] = [
  node("trading-universe", "universe", "Liquid technology equities", "Trade AAPL and MSFT using daily bars", { symbols: "AAPL,MSFT" }, [
    node("trading-condition", "condition", "Trend regime", "Only act when the short average exceeds the long average", { shortWindow: 20, longWindow: 50 }),
    node("trading-entry", "entry", "Enter on crossover", "Open a long position after the close confirms the signal", { confirmationBars: 1 }),
    node("trading-exit", "exit", "Exit on reversal", "Close when the short average falls below the long average", {}),
  ]),
  node("trading-risk", "risk", "Risk budget", "Limit each position to one percent of paper equity", { riskPercent: 1 }),
  node("trading-schedule", "schedule", "Daily evaluation", "Evaluate once after the market close", { cadence: "daily" }),
];

function node(
  id: string,
  type: StrategyNode["type"],
  label: string,
  detail: string,
  parameters: StrategyNode["parameters"],
  children: StrategyNode[] = [],
): StrategyNode {
  return { id, type, label, detail, parameters, children };
}

export function createDraft(mode: StrategyMode, id = `${mode}-starter`): StrategyDraft {
  const trading = mode === "trading";
  return {
    id,
    name: trading ? "Daily Trend Discipline" : "Quality Compounder Allocation",
    mode,
    status: "draft",
    template: trading ? "moving_average_crossover" : "buy_and_hold",
    symbols: trading ? ["AAPL", "MSFT"] : ["MSFT", "NVDA", "VOO"],
    nodes: structuredClone(trading ? TRADING_NODES : INVESTMENT_NODES),
    versions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function initialStrategyState() {
  return { drafts: [createDraft("investment"), createDraft("trading")] };
}

export function validateStrategy(draft: StrategyDraft): StrategyValidationIssue[] {
  const issues: StrategyValidationIssue[] = [];
  const nodes = flattenNodes(draft.nodes);
  const ids = new Set<string>();

  if (!draft.name.trim()) issues.push({ id: "missing-name", severity: "error", message: "Give the strategy a name before saving a version." });
  if (draft.symbols.length === 0) issues.push({ id: "missing-symbols", severity: "error", message: "Add at least one symbol to the universe." });
  for (const current of nodes) {
    if (ids.has(current.id)) issues.push({ id: `duplicate-${current.id}`, nodeId: current.id, severity: "error", message: "This node has a duplicate identifier." });
    ids.add(current.id);
    if (!current.label.trim()) issues.push({ id: `label-${current.id}`, nodeId: current.id, severity: "error", message: "Every node needs a visible label." });
  }
  if (!nodes.some((current) => current.type === "universe" || current.type === "asset")) {
    issues.push({ id: "missing-universe", severity: "error", message: "Add a Universe or Asset node." });
  }
  if (!nodes.some((current) => current.type === "risk")) {
    issues.push({ id: "missing-risk", severity: "error", message: "Add a deterministic risk rule before validation." });
  }
  if (draft.mode === "trading" && !nodes.some((current) => current.type === "entry")) {
    issues.push({ id: "missing-entry", severity: "error", message: "Trading strategies require an Entry node." });
  }
  if (draft.mode === "trading" && !nodes.some((current) => current.type === "exit")) {
    issues.push({ id: "missing-exit", severity: "error", message: "Trading strategies require an Exit node." });
  }
  if (!nodes.some((current) => current.type === "schedule")) {
    issues.push({ id: "missing-schedule", severity: "warning", message: "Add an evaluation schedule before paper deployment." });
  }
  return issues;
}

export function proposalFor(draft: StrategyDraft): StrategyProposal {
  const investment = draft.mode === "investment";
  return {
    id: `${draft.id}-proposal`,
    title: investment ? "Add a drawdown review" : "Add a volatility guard",
    description: investment
      ? "Flag the allocation for review after a 15% portfolio drawdown. This does not sell automatically."
      : "Pause new paper entries when 20-day volatility exceeds 45%. Existing positions remain unchanged.",
    node: node(
      `${draft.id}-${investment ? "drawdown" : "volatility"}`,
      "risk",
      investment ? "Drawdown review" : "Volatility guard",
      investment ? "Request review after a 15% portfolio drawdown" : "Pause entries above 45% annualized volatility",
      investment ? { drawdownPercent: 15 } : { volatilityPercent: 45 },
    ),
  };
}

export function updateNode(nodes: StrategyNode[], nodeId: string, updater: (node: StrategyNode) => StrategyNode): StrategyNode[] {
  return nodes.map((current) => current.id === nodeId
    ? updater(current)
    : { ...current, children: updateNode(current.children, nodeId, updater) });
}

export function removeNode(nodes: StrategyNode[], nodeId: string): StrategyNode[] {
  return nodes.filter((current) => current.id !== nodeId).map((current) => ({ ...current, children: removeNode(current.children, nodeId) }));
}

export function moveNode(nodes: StrategyNode[], nodeId: string, direction: -1 | 1): StrategyNode[] {
  const index = nodes.findIndex((current) => current.id === nodeId);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }
  return nodes.map((current) => ({ ...current, children: moveNode(current.children, nodeId, direction) }));
}

export function flattenNodes(nodes: StrategyNode[]): StrategyNode[] {
  return nodes.flatMap((current) => [current, ...flattenNodes(current.children)]);
}

export function backtestHref(draft: StrategyDraft) {
  const parameters = templateParameters(draft.template, draft.nodes);
  const query = new URLSearchParams({
    template: draft.template,
    name: draft.name,
    symbols: draft.symbols.join(","),
    ...Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, String(value)])),
  });
  return `/trade/strategies/backtest?${query.toString()}`;
}

function templateParameters(template: BacktestTemplate, nodes: StrategyNode[]) {
  const condition = flattenNodes(nodes).find((current) => current.type === "condition");
  if (template === "moving_average_crossover") {
    return {
      short_window: Number(condition?.parameters.shortWindow ?? 20),
      long_window: Number(condition?.parameters.longWindow ?? 50),
    };
  }
  if (template === "rsi_mean_reversion") return { rsi_window: 14, buy_threshold: 30, sell_threshold: 55 };
  return {};
}
