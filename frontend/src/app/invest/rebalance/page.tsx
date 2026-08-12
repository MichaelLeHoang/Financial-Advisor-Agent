"use client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LockedFeature } from "@/components/LockedFeature";
import { planAllows } from "@/config/workspace-navigation";
import PortfolioPage from "../../portfolio/page";
export default function RebalancePage() { const { user } = useAuth(); return planAllows(user.plan, "pro") ? <PortfolioPage /> : <LockedFeature title="Rebalancing is available on Pro" description="Compare the current allocation with deterministic optimized weights before making a decision." requiredPlan="pro" />; }
