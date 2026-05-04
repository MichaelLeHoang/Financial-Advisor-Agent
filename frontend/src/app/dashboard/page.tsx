"use client";

import { useEffect, useState } from "react";
import { Bookmark, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { Portfolio, Watchlist } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);

  useEffect(() => {
    void Promise.all([api.portfolios(), api.watchlists()]).then(([portfolioRows, watchlistRows]) => {
      setPortfolios(portfolioRows);
      setWatchlists(watchlistRows);
    });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="mt-2 text-white/42">Plan: {formatPlan(user?.plan ?? "free")}</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <MetricCard icon={BriefcaseBusiness} label="Portfolios" value={portfolios.length} />
          <MetricCard icon={Bookmark} label="Watchlists" value={watchlists.length} />
          <MetricCard icon={ShieldCheck} label="Account Scope" value="Protected" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
      <CardContent className="p-6">
      <Icon className="mb-5 h-6 w-6 text-indigo-primary" />
      <div className="text-sm text-white/42">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatPlan(plan: string) {
  return plan
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
