"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function DelayedSkeleton({
  className,
  delay = 120,
  label = "Loading",
}: {
  className?: string;
  delay?: number;
  label?: string;
}) {
  const [visible, setVisible] = useState(delay <= 0);

  useEffect(() => {
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      role="status"
      aria-label={label}
      className={cn("transition-opacity duration-100", visible ? "data-skeleton opacity-100" : "opacity-0", className)}
    />
  );
}

export function DataReveal({
  ready,
  children,
  className,
}: {
  ready: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [revealStarted, setRevealStarted] = useState(ready);

  useEffect(() => {
    if (ready) setRevealStarted(true);
  }, [ready]);

  return (
    <div
      aria-busy={!ready}
      className={cn(revealStarted ? "data-reveal" : "opacity-0", className)}
    >
      {children}
    </div>
  );
}

export function RefreshingIndicator({ refreshing, label = "Updating data" }: { refreshing: boolean; label?: string }) {
  if (!refreshing) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]" role="status" aria-live="polite">
      <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </span>
  );
}

export function WorkspaceLoadingShell({ label = "Restoring your workspace" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <DelayedSkeleton className="h-4 w-36 rounded-sm" label={label} />
        <DelayedSkeleton className="h-10 w-72 max-w-[70vw] rounded-sm" label={label} />
        <DelayedSkeleton className="h-4 w-[34rem] max-w-[88vw] rounded-sm" label={label} />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-border)] lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-[var(--surface-primary)] p-5">
            <DelayedSkeleton className="h-3 w-24 rounded-sm" label={label} />
            <DelayedSkeleton className="mt-4 h-8 w-32 rounded-sm" label={label} />
            <DelayedSkeleton className="mt-3 h-3 w-40 max-w-full rounded-sm" label={label} />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-border)] xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="min-h-56 bg-[var(--surface-primary)] p-6">
            <DelayedSkeleton className="h-5 w-36 rounded-sm" label={label} />
            <DelayedSkeleton className="mt-7 h-24 w-full rounded-sm" label={label} />
          </div>
        ))}
      </div>
    </div>
  );
}
