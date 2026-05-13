"use client";

import Link from "next/link";
import { Newspaper } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { IntroductionFooter, IntroductionNav } from "@/app/introduction/components";

export default function NewsPage() {
  const { user, loading } = useAuth();
  const isSignedIn = !loading && !user?.is_guest;

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      <section className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-4xl items-center px-6 pb-16 pt-32">
        <Empty className="w-full border-white/[0.08] bg-white/[0.035]">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-indigo-300">
            <Newspaper className="size-6" />
          </div>
          <EmptyTitle>{isSignedIn ? "News is coming soon" : "Sign in to access News"}</EmptyTitle>
          <EmptyDescription>
            {isSignedIn
              ? "This logged-in news workspace is a placeholder for the next feature."
              : "News will be available for authenticated users when the feature is ready."}
          </EmptyDescription>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {isSignedIn ? (
              <Link href="/" className="inline-flex h-10 items-center rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400">
                Open App
              </Link>
            ) : (
              <Link href="/login" className="inline-flex h-10 items-center rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400">
                Log in
              </Link>
            )}
            <Link href="/introduction/help" className="inline-flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white">
              Help center
            </Link>
          </div>
        </Empty>
      </section>

      <IntroductionFooter />
    </main>
  );
}
