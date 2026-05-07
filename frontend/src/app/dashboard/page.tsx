"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Bookmark, Brain, BriefcaseBusiness, ClipboardList, LineChart, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import type { Portfolio, Watchlist } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

const WORKFLOW = [
  {
    title: "Research queue",
    status: "Start with market structure",
    detail: "Review watched names, scan recent momentum, then ask the advisor for a focused thesis.",
    href: "/market",
    action: "Open market",
    icon: LineChart,
  },
  {
    title: "Risk review",
    status: "Before sizing",
    detail: "Run allocation and volatility checks before a ticker becomes a position.",
    href: "/portfolio",
    action: "Review risk",
    icon: ShieldCheck,
  },
  {
    title: "Narrative check",
    status: "Confirm the catalyst",
    detail: "Compare your thesis against recent headlines and sentiment before acting.",
    href: "/sentiment",
    action: "Analyze sentiment",
    icon: Brain,
  },
  {
    title: "Discipline loop",
    status: "Alerts and journal next",
    detail: "Use watchlists as the staging area for alerts, trade review, and journal workflows.",
    href: "/watchlist",
    action: "Open watchlists",
    icon: ClipboardList,
  },
];

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
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div>
          <h1 className="text-4xl font-bold">
            Trading <span className="gradient-highlight">workspace</span>
          </h1>
          <p className="mt-2 max-w-2xl text-white/42">
            Plan: {formatPlan(user?.plan ?? "free")}. Keep research, risk, alerts, and journal prep in one decision trail.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <MetricCard icon={BriefcaseBusiness} label="Portfolios" value={portfolios.length} />
          <MetricCard icon={Bookmark} label="Watchlists" value={watchlists.length} />
          <MetricCard icon={ShieldCheck} label="Account Scope" value="Protected" />
        </div>
        <section className="grid gap-4 lg:grid-cols-4" aria-label="Primary trading workflow">
          {WORKFLOW.map((item) => (
            <WorkflowCard key={item.title} item={item} />
          ))}
        </section>
        <Card className="rounded-2xl border border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.22)]">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Bell className="h-4 w-4 text-amber-warning" />
                Missing workflow link: alerts and journal
              </div>
              <p className="mt-1 text-sm leading-6 text-white/46">
                The current build has market, sentiment, watchlist, and portfolio tools. Alerts, backtests, and trade journal should become first-class modules so traders can close the loop after research.
              </p>
            </div>
            <Link
              href="/watchlist"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-4 text-sm font-semibold text-white/78 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
              Stage symbols
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkflowCard({
  item,
}: {
  item: {
    title: string;
    status: string;
    detail: string;
    href: string;
    action: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex min-h-52 flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.035] p-5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_34px_rgba(0,0,0,0.22)] transition-colors hover:border-indigo-primary/35 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
    >
      <div>
        <Icon className="mb-4 h-5 w-5 text-indigo-primary" />
        <div className="text-sm font-semibold text-white">{item.title}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/32">{item.status}</div>
        <p className="mt-3 text-sm leading-6 text-white/50">{item.detail}</p>
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-indigo-primary">
        {item.action}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
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
