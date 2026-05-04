"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";

import { api, type AuthUser, type BillingSubscription } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BILLING_PLANS: Array<{
    plan: AuthUser["plan"];
    name: string;
    price: string;
    summary: string;
    features: string[];
}> = [
    {
        plan: "pro",
        name: "Pro",
        price: "$29/mo",
        summary: "Portfolio limits, classical optimization, saved research, and larger AI quotas.",
        features: ["5 portfolios", "50 watchlist assets", "Classical optimization"],
    },
    {
        plan: "trader",
        name: "Trader",
        price: "$79/mo",
        summary: "Backtesting, alerts, trade journal, and signal workflows when those modules unlock.",
        features: ["Backtesting ready", "Alerts", "Trade journal"],
    },
    {
        plan: "quant",
        name: "Quant",
        price: "$199/mo",
        summary: "Premium research workflows, quantum optimization, advanced validation, and exports.",
        features: ["Quantum optimization", "Premium routing", "Advanced validation"],
    },
];

export default function BillingPage() {
    const { user } = useAuth();
    const [billing, setBilling] = useState<BillingSubscription | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<AuthUser["plan"] | "portal" | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.billingSubscription()
            .then(setBilling)
            .catch((err) => setError(err.message));
    }, []);

    const startCheckout = async (plan: AuthUser["plan"]) => {
        setLoadingPlan(plan);
        setError(null);
        try {
            const session = await api.createCheckoutSession(plan);
            window.location.href = session.url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingPlan(null);
        }
    };

    const openPortal = async () => {
        setLoadingPlan("portal");
        setError(null);
        try {
            const session = await api.createCustomerPortalSession(window.location.href);
            window.location.href = session.url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingPlan(null);
        }
    };

    const currentPlan = billing?.publishable_plan ?? user.plan;
    const status = billing?.subscription.status ?? "inactive";

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-4xl font-bold">Billing</h1>
                        <p className="mt-2 text-sm text-white/42">Manage plan access, invoices, and subscription status.</p>
                    </div>
                    <Button
                        variant="outline"
                        className="h-10 rounded-xl"
                        onClick={openPortal}
                        disabled={loadingPlan !== null || user.is_guest}
                    >
                        <CreditCard data-icon="inline-start" />
                        Customer portal
                    </Button>
                </div>

                {error && (
                    <Card className="rounded-2xl border-red-negative/20 bg-red-negative/10 py-0 text-red-negative">
                        <CardContent className="p-4 text-sm">{error}</CardContent>
                    </Card>
                )}

                {user.is_guest && (
                    <Card className="rounded-2xl border-white/[0.06] bg-white/[0.045] py-0 text-white">
                        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-semibold">Sign in to upgrade</div>
                                <div className="mt-1 text-sm text-white/42">Guest users stay on the Free plan until they sign in.</div>
                            </div>
                            <Badge variant="outline" className="h-7 rounded-lg">Free</Badge>
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-2xl border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_18px_50px_rgba(0,0,0,0.34)]">
                    <CardHeader className="px-6 pt-6">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <ShieldCheck className="size-5 text-green-positive" />
                            Current subscription
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-4">
                        <SummaryTile label="Plan" value={formatPlan(currentPlan)} />
                        <SummaryTile label="Status" value={status} />
                        <SummaryTile label="Billing configured" value={billing?.configured ? "Yes" : "No"} />
                        <SummaryTile label="Renews" value={formatDate(billing?.subscription.current_period_end)} />
                    </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-3">
                    {BILLING_PLANS.map((plan) => {
                        const active = currentPlan === plan.plan && ["active", "trialing"].includes(status);
                        return (
                            <Card key={plan.plan} className="rounded-2xl border-white/[0.06] bg-white/[0.045] py-0 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_14px_38px_rgba(0,0,0,0.28)]">
                                <CardHeader className="px-6 pt-6">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                                            <div className="mt-2 text-3xl font-bold">{plan.price}</div>
                                        </div>
                                        {active && <Badge variant="outline" className="h-7 rounded-lg text-green-positive">Active</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-5 px-6 pb-6">
                                    <p className="text-sm leading-6 text-white/46">{plan.summary}</p>
                                    <div className="flex flex-col gap-2">
                                        {plan.features.map((feature) => (
                                            <div key={feature} className="rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-white/70">
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        className="h-11 rounded-xl bg-indigo-primary text-white hover:bg-indigo-primary/90"
                                        disabled={active || loadingPlan !== null || user.is_guest}
                                        onClick={() => startCheckout(plan.plan)}
                                    >
                                        {loadingPlan === plan.plan ? "Opening..." : active ? "Current plan" : "Upgrade"}
                                        {!active && <ArrowUpRight data-icon="inline-end" />}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card className="rounded-2xl border-white/[0.06] bg-gradient-to-b from-indigo-primary/12 to-cyan-secondary/8 py-0 text-white">
                    <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="font-semibold">Stripe test mode first</div>
                            <div className="mt-1 text-sm text-white/46">Use test price IDs and Stripe CLI webhooks before production keys.</div>
                        </div>
                        <Button variant="outline" className="rounded-xl" onClick={openPortal} disabled={loadingPlan !== null || user.is_guest}>
                            <ExternalLink data-icon="inline-start" />
                            Manage subscription
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-white/[0.035] p-4">
            <div className="text-xs text-white/35">{label}</div>
            <div className="mt-1 text-sm font-semibold text-white">{value}</div>
        </div>
    );
}

function formatPlan(plan: string) {
    return plan.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDate(value?: string | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
