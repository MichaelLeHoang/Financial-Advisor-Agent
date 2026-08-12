import type { PositionSizingResult } from "./positionSizing.ts";

export type PaperPolicyConfig = { minimumRewardRisk: number; maximumRiskPerTradePercent: number; maximumPortfolioHeatPercent: number; paperMode: boolean };
export type PolicyRuleResult = { id: string; label: string; status: "passed" | "failed" | "warning" | "unavailable"; detail: string };
export type PolicyCheckResult = { status: "passed" | "failed" | "warning" | "unavailable"; checks: PolicyRuleResult[]; blockingReasons: string[]; warnings: string[] };

export const DEFAULT_PAPER_POLICY: PaperPolicyConfig = { minimumRewardRisk: 1.5, maximumRiskPerTradePercent: 2, maximumPortfolioHeatPercent: 6, paperMode: true };

export function evaluatePaperPolicy(result: PositionSizingResult, config: PaperPolicyConfig = DEFAULT_PAPER_POLICY): PolicyCheckResult {
  const checks: PolicyRuleResult[] = [];
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const add = (id: string, label: string, status: PolicyRuleResult["status"], detail: string, blocking = false) => {
    checks.push({ id, label, status, detail });
    if (blocking && status === "failed") blockingReasons.push(detail);
    if (status === "warning") warnings.push(detail);
  };
  add("inputs", "Entry, stop, and target relationship", result.isValid ? "passed" : "failed", result.isValid ? "Price levels are valid for this direction." : result.errors[0]?.message ?? "Correct the trade inputs.", true);
  const ratio = result.rewardRiskRatio;
  add("reward-risk", "Minimum reward/risk", ratio != null && ratio >= config.minimumRewardRisk ? "passed" : "failed", ratio == null ? "Reward/risk is unavailable." : `Reward/risk is ${ratio.toFixed(2)}:1; minimum is ${config.minimumRewardRisk.toFixed(2)}:1.`, true);
  add("risk", "Risk budget within policy", result.riskPercentOfEquity == null ? "unavailable" : result.riskPercentOfEquity <= config.maximumRiskPerTradePercent ? "passed" : "failed", result.riskPercentOfEquity == null ? "Account equity has not loaded." : `Planned risk is ${result.riskPercentOfEquity.toFixed(2)}% of equity; maximum is ${config.maximumRiskPerTradePercent.toFixed(2)}%.`, true);
  add("heat", "Portfolio heat remains under maximum", result.portfolioHeatAfter == null ? "unavailable" : result.portfolioHeatAfter <= config.maximumPortfolioHeatPercent ? "passed" : "failed", result.portfolioHeatAfter == null ? "Account equity has not loaded." : `Portfolio heat would be ${result.portfolioHeatAfter.toFixed(2)}%; maximum is ${config.maximumPortfolioHeatPercent.toFixed(2)}%.`, true);
  add("quantity", "Quantity is at least one", result.quantity >= 1 ? "passed" : "failed", result.quantity >= 1 ? `${result.quantity} shares can be planned.` : "Calculated quantity is below one share.", true);
  add("paper", "Paper mode is active", config.paperMode ? "passed" : "failed", config.paperMode ? "No brokerage execution is connected." : "Paper mode is disabled.", true);
  return { status: blockingReasons.length ? "failed" : warnings.length ? "warning" : "passed", checks, blockingReasons, warnings };
}
