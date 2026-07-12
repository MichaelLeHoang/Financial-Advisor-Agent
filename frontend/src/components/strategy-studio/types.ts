export type StrategyMode = "investment" | "trading";

export type StrategyNodeType =
  | "universe"
  | "asset"
  | "group"
  | "condition"
  | "filter"
  | "rank"
  | "select"
  | "weight"
  | "entry"
  | "exit"
  | "risk"
  | "schedule";

export type BacktestTemplate = "buy_and_hold" | "moving_average_crossover" | "rsi_mean_reversion";

export interface StrategyNode {
  id: string;
  type: StrategyNodeType;
  label: string;
  detail: string;
  parameters: Record<string, string | number | boolean>;
  children: StrategyNode[];
}

export interface StrategyVersion {
  id: string;
  number: number;
  createdAt: string;
  nodes: StrategyNode[];
  summary: string;
}

export interface StrategyDraft {
  id: string;
  name: string;
  mode: StrategyMode;
  status: "draft" | "paper";
  template: BacktestTemplate;
  symbols: string[];
  nodes: StrategyNode[];
  versions: StrategyVersion[];
  updatedAt: string;
}

export interface StrategyValidationIssue {
  id: string;
  nodeId?: string;
  severity: "error" | "warning";
  message: string;
}

export interface StrategyProposal {
  id: string;
  title: string;
  description: string;
  node: StrategyNode;
}

export interface StrategyStudioState {
  drafts: StrategyDraft[];
}
