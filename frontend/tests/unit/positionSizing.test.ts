import test from "node:test";
import assert from "node:assert/strict";
import { calculatePositionSizing } from "../../src/lib/trading/positionSizing.ts";

test("sizes a valid long trade and calculates portfolio heat", () => {
  const result = calculatePositionSizing({ entry: 170, stop: 164, target: 182, riskBudget: 600, buyingPower: 20_000, accountEquity: 100_000, existingOpenRisk: 2_400 });
  assert.equal(result.isValid, true); assert.equal(result.quantity, 100); assert.equal(result.capitalRequired, 17_000); assert.equal(result.maximumLoss, 600); assert.equal(result.rewardRiskRatio, 2); assert.equal(result.portfolioHeatAfter, 3);
});

test("sizes a valid short trade", () => {
  const result = calculatePositionSizing({ direction: "short", entry: 100, stop: 105, target: 90, riskBudget: 500, accountEquity: 50_000 });
  assert.equal(result.isValid, true); assert.equal(result.quantity, 100); assert.equal(result.rewardRiskRatio, 2);
});

test("rejects equal stop, wrong target, zero budget, and negative inputs", () => {
  const result = calculatePositionSizing({ entry: -1, stop: -1, target: -2, riskBudget: 0 });
  assert.equal(result.isValid, false); assert.ok(result.errors.length >= 4); assert.equal(result.quantity, 0);
});

test("rounds quantity down and handles budget below per-share risk", () => {
  assert.equal(calculatePositionSizing({ entry: 10, stop: 7, target: 16, riskBudget: 10 }).quantity, 3);
  assert.equal(calculatePositionSizing({ entry: 10, stop: 7, target: 16, riskBudget: 2 }).quantity, 0);
});

test("handles missing equity, large values, and floating-point prices", () => {
  const missing = calculatePositionSizing({ entry: 0.3, stop: 0.2, target: 0.5, riskBudget: 1, accountEquity: null });
  assert.equal(missing.portfolioHeatAfter, null); assert.ok(Number.isFinite(missing.capitalRequired));
  const large = calculatePositionSizing({ entry: 1_000_000, stop: 999_999.99, target: 1_000_000.02, riskBudget: 1_000_000, buyingPower: 10_000_000 });
  assert.ok(Number.isFinite(large.quantity)); assert.ok(large.quantity <= 10);
});
