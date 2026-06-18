"use client";

import Link from "next/link";
import { LockKeyhole, ArrowRight, Radio, Search } from "lucide-react";

export default function PublicAccessGate() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <section className="w-full max-w-3xl rounded-3xl border border-white/[0.08] bg-white/[0.045] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-primary/15 text-indigo-200 ring-1 ring-indigo-primary/25">
          <LockKeyhole className="size-5" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">Sign in to use this workspace feature</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">
          Public access includes the AI Advisor demo, market lookup, and shallow QuanAd 2.1 research previews. Portfolio tools,
          watchlists, saved state, risk workflows, and advanced research history require a signed-in workspace.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <Search className="size-4 text-cyan-secondary" />
            <div className="mt-3 text-sm font-semibold text-white">Public demo access</div>
            <p className="mt-1 text-xs leading-5 text-white/48">Try market lookup and quick AI research without saving account data.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <Radio className="size-4 text-indigo-300" />
            <div className="mt-3 text-sm font-semibold text-white">Signed-in workspace</div>
            <p className="mt-1 text-xs leading-5 text-white/48">Save analysis, manage portfolios, build watchlists, and unlock plan-based tools.</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-indigo-primary px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
          >
            Sign in
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/market"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
          >
            Continue to market lookup
          </Link>
        </div>
      </section>
    </div>
  );
}
