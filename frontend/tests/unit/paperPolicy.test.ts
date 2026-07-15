import test from "node:test";
import assert from "node:assert/strict";
import { calculatePositionSizing } from "../../src/lib/trading/positionSizing.ts";
import { DEFAULT_PAPER_POLICY, evaluatePaperPolicy } from "../../src/lib/trading/paperPolicy.ts";

const valid = calculatePositionSizing({ entry: 100, stop: 95, target: 110, riskBudget: 500, accountEquity: 100_000, existingOpenRisk: 1_000, buyingPower: 20_000 });
test("passes a compliant paper plan", () => { const policy = evaluatePaperPolicy(valid); assert.equal(policy.status, "passed"); assert.equal(policy.blockingReasons.length, 0); });
test("blocks weak reward/risk", () => { const result = calculatePositionSizing({ entry: 100, stop: 95, target: 104, riskBudget: 500, accountEquity: 100_000 }); assert.equal(evaluatePaperPolicy(result).status, "failed"); });
test("blocks excessive heat and multiple failures", () => { const result = calculatePositionSizing({ entry: 100, stop: 95, target: 104, riskBudget: 5_000, accountEquity: 10_000, existingOpenRisk: 2_000 }); const policy = evaluatePaperPolicy(result); assert.equal(policy.status, "failed"); assert.ok(policy.blockingReasons.length >= 2); });
test("blocks when planned risk exceeds the per-trade equity limit", () => { const result = calculatePositionSizing({ entry: 100, stop: 90, target: 120, riskBudget: 3_000, accountEquity: 100_000 }); assert.equal(evaluatePaperPolicy(result).status, "failed"); });
test("reports unavailable portfolio data and blocks disabled paper mode", () => { assert.ok(evaluatePaperPolicy(calculatePositionSizing({ entry: 100, stop: 95, target: 110, riskBudget: 500 })).checks.some((check) => check.status === "unavailable")); assert.equal(evaluatePaperPolicy(valid, { ...DEFAULT_PAPER_POLICY, paperMode: false }).status, "failed"); });
