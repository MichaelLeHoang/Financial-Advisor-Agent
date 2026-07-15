export type TradeDirection = "long" | "short";

export type PositionSizingInput = {
  direction?: TradeDirection;
  entry: number | string;
  stop: number | string;
  target: number | string;
  riskBudget: number | string;
  accountEquity?: number | string | null;
  existingOpenRisk?: number | string;
  buyingPower?: number | string | null;
};

export type PositionSizingError = { field: string; message: string };

export type PositionSizingResult = {
  isValid: boolean;
  quantity: number;
  capitalRequired: number;
  riskPerShare: number;
  rewardPerShare: number;
  maximumLoss: number;
  rewardRiskRatio: number | null;
  portfolioHeatAfter: number | null;
  riskPercentOfEquity: number | null;
  errors: PositionSizingError[];
};

const finite = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const rounded = (value: number, precision = 8) => Number(value.toFixed(precision));

export function calculatePositionSizing(input: PositionSizingInput): PositionSizingResult {
  const direction = input.direction ?? "long";
  const entry = finite(input.entry);
  const stop = finite(input.stop);
  const target = finite(input.target);
  const riskBudget = finite(input.riskBudget);
  const accountEquity = input.accountEquity == null ? null : finite(input.accountEquity);
  const existingOpenRisk = finite(input.existingOpenRisk);
  const buyingPower = input.buyingPower == null ? null : finite(input.buyingPower);
  const errors: PositionSizingError[] = [];

  if (entry <= 0) errors.push({ field: "entry", message: "Entry must be greater than zero." });
  if (direction === "long" && stop >= entry) errors.push({ field: "stop", message: "Stop must be below entry for a long trade." });
  if (direction === "short" && stop <= entry) errors.push({ field: "stop", message: "Stop must be above entry for a short trade." });
  if (direction === "long" && target <= entry) errors.push({ field: "target", message: "Target must be above entry for a long trade." });
  if (direction === "short" && target >= entry) errors.push({ field: "target", message: "Target must be below entry for a short trade." });
  if (riskBudget <= 0) errors.push({ field: "riskBudget", message: "Risk budget must be greater than zero." });

  const riskPerShare = rounded(direction === "long" ? entry - stop : stop - entry);
  const rewardPerShare = rounded(direction === "long" ? target - entry : entry - target);
  if (riskPerShare <= 0) errors.push({ field: "riskPerShare", message: "Risk per share must be greater than zero." });

  const riskQuantity = riskPerShare > 0 ? Math.floor(riskBudget / riskPerShare) : 0;
  const buyingPowerQuantity = buyingPower == null || entry <= 0 ? Number.MAX_SAFE_INTEGER : Math.floor(buyingPower / entry);
  const quantity = Math.max(0, Math.min(riskQuantity, buyingPowerQuantity));
  if (quantity < 1 && errors.length === 0) errors.push({ field: "quantity", message: "Risk budget or buying power is insufficient for one share." });

  const capitalRequired = rounded(quantity * entry, 2);
  const maximumLoss = rounded(quantity * Math.max(0, riskPerShare), 2);
  const rewardRiskRatio = riskPerShare > 0 && rewardPerShare >= 0 ? rewardPerShare / riskPerShare : null;
  const portfolioHeatAfter = accountEquity && accountEquity > 0 ? ((existingOpenRisk + maximumLoss) / accountEquity) * 100 : null;
  const riskPercentOfEquity = accountEquity && accountEquity > 0 ? (maximumLoss / accountEquity) * 100 : null;

  return { isValid: errors.length === 0, quantity, capitalRequired, riskPerShare: Math.max(0, riskPerShare), rewardPerShare: Math.max(0, rewardPerShare), maximumLoss, rewardRiskRatio, portfolioHeatAfter, riskPercentOfEquity, errors };
}
