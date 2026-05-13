"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Bug,
  CreditCard,
  FileQuestion,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
} from "lucide-react";
import { IntroductionFooter, IntroductionNav } from "../components";

const SUPPORT_SERVICES = [
  {
    icon: MessageCircle,
    title: "Product support",
    description: "Get help using AI Advisor, market research, sentiment analysis, watchlists, portfolios, and saved conversations.",
    action: "Start with support",
    href: "mailto:support@quantumadvisor.app?subject=Product%20support",
  },
  {
    icon: CreditCard,
    title: "Billing and plans",
    description: "Questions about upgrades, invoices, plan limits, Stripe checkout, subscription changes, and billing errors.",
    action: "Billing help",
    href: "mailto:support@quantumadvisor.app?subject=Billing%20and%20plans",
  },
  {
    icon: UserRoundCog,
    title: "Account and profile",
    description: "Sign-in issues, profile updates, avatar uploads, email changes, session problems, and account recovery.",
    action: "Account help",
    href: "mailto:support@quantumadvisor.app?subject=Account%20and%20profile",
  },
  {
    icon: Bug,
    title: "Bug reports",
    description: "Report broken tools, incorrect UI states, upload failures, missing data, or unexpected app behavior.",
    action: "Report a bug",
    href: "mailto:support@quantumadvisor.app?subject=Bug%20report",
  },
  {
    icon: ShieldCheck,
    title: "Security and privacy",
    description: "Ask about data handling, authentication, Supabase sessions, API access, privacy concerns, or responsible disclosure.",
    action: "Security contact",
    href: "mailto:security@quantumadvisor.app?subject=Security%20question",
  },
  {
    icon: Sparkles,
    title: "Feature requests",
    description: "Request new indicators, agent tools, broker workflows, backtesting features, exports, alerts, or integrations.",
    action: "Request a feature",
    href: "mailto:support@quantumadvisor.app?subject=Feature%20request",
  },
];

const SELF_SERVICE = [
  { icon: BookOpen, title: "Getting started", text: "Learn the core workflow: ask the advisor, inspect market context, save research, and track follow-up actions." },
  { icon: FileQuestion, title: "Using AI outputs", text: "Treat responses as decision support. Review assumptions, sources, risk notes, and calculations before acting." },
  { icon: Radio, title: "Service status", text: "If market data, auth, billing, or AI tools fail, check the app again after refreshing your session." },
  { icon: LockKeyhole, title: "Access control", text: "Some tools depend on your plan. Upgrade prompts mean the feature is working, but your current plan has a limit." },
];

const FAQS = [
  {
    question: "Why did my avatar not update in the sidebar?",
    answer: "The sidebar uses your saved profile avatar from Supabase user metadata. If an upload fails, make sure the avatars storage bucket exists and then save your profile again.",
  },
  {
    question: "Is the AI advisor giving financial advice?",
    answer: "No. It provides research assistance, analysis, and risk context. You should verify outputs and make your own investment decisions.",
  },
  {
    question: "Why are some features locked?",
    answer: "Portfolio limits, quantum tools, advanced analysis, and premium market workflows can depend on your current plan.",
  },
  {
    question: "How do I report incorrect market data?",
    answer: "Send the ticker, timestamp, page, and a short description through Bug reports so support can reproduce the data issue.",
  },
  {
    question: "Can I recover deleted conversations?",
    answer: "Deleted conversations are treated as removed from your workspace. Contact support quickly if the deletion was accidental.",
  },
  {
    question: "What should I include in a support request?",
    answer: "Include your account email, browser, page URL, screenshots if useful, what you expected, and what happened instead.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
        <Link href="/introduction" className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Introduction
        </Link>

        <div className="max-w-3xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-indigo-300">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">Help center</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Support for account access, billing, profile setup, AI research workflows, market data, bug reports, security questions, and feature requests.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="mailto:support@quantumadvisor.app?subject=Support%20request" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_8px_24px_rgba(99,102,241,0.28)] transition-colors hover:bg-indigo-400">
              <Mail className="h-4 w-4" />
              Email support
            </a>
            <a href="#faq" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white">
              Browse FAQ
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Support services</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Choose the right support path</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SUPPORT_SERVICES.map((service) => (
            <a
              key={service.title}
              href={service.href}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 transition-colors hover:border-indigo-400/35 hover:bg-white/[0.055]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 ring-1 ring-white/10 transition-colors group-hover:text-indigo-200">
                <service.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-white/88">{service.title}</h3>
              <p className="mt-2 min-h-20 text-sm leading-6 text-white/48">{service.description}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-indigo-300">{service.action}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Self-service</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Fast checks before contacting support</h2>
          <p className="mt-4 text-sm leading-6 text-white/50">
            These steps resolve the most common customer support issues and help the team diagnose anything that remains.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SELF_SERVICE.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <item.icon className="h-5 w-5 text-cyan-300" />
              <h3 className="mt-4 text-sm font-semibold text-white/86">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/48">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Frequently asked questions</h2>
        </div>
        <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-white/[0.03]">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group p-5 open:bg-white/[0.025]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white/86">
                {faq.question}
                <span className="text-xl leading-none text-white/35 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Terms & Policies</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div id="terms-of-use" className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <h2 className="text-sm font-semibold text-white/86">Terms of Use</h2>
              <p className="mt-2 text-sm leading-6 text-white/48">
                Use the platform for research and workflow support only. AI outputs are not guarantees, recommendations, or professional financial advice.
              </p>
            </div>
            <div id="privacy-policy" className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <h2 className="text-sm font-semibold text-white/86">Privacy Policy</h2>
              <p className="mt-2 text-sm leading-6 text-white/48">
                Account, profile, and usage data support authentication, billing, product workflows, and customer support diagnostics.
              </p>
            </div>
            <div id="other-policies" className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <h2 className="text-sm font-semibold text-white/86">Other Policies</h2>
              <p className="mt-2 text-sm leading-6 text-white/48">
                Security, billing, acceptable use, and feature-access policies may vary by plan and integration status.
              </p>
            </div>
          </div>
        </div>
      </section>

      <IntroductionFooter />
    </main>
  );
}
