"use client";

import { useParams } from "next/navigation";
import StrategyStudioPage from "@/components/strategy-studio/StrategyStudioPage";

export default function TradingStrategyPage() {
  const { strategyId } = useParams<{ strategyId: string }>();
  return <StrategyStudioPage strategyId={strategyId} />;
}
