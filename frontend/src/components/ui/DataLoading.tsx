"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  remainingSkeletonTime,
  SKELETON_APPEARANCE_DELAY_MS,
  SKELETON_MINIMUM_VISIBLE_MS,
} from "@/lib/loading-state";

type SkeletonPhase = "idle" | "pending" | "visible";

function useSkeletonPhase(
  loading: boolean,
  delay: number,
  minimumDuration: number,
) {
  const [phase, setPhase] = useState<SkeletonPhase>(() => {
    if (!loading) return "idle";
    return delay <= 0 ? "visible" : "pending";
  });
  const visibleAt = useRef<number | null>(delay <= 0 && loading ? Date.now() : null);

  useEffect(() => {
    let timer: number | undefined;

    if (loading) {
      if (visibleAt.current !== null) {
        setPhase("visible");
        return;
      }

      if (delay <= 0) {
        visibleAt.current = Date.now();
        setPhase("visible");
        return;
      }

      setPhase("pending");
      timer = window.setTimeout(() => {
        visibleAt.current = Date.now();
        setPhase("visible");
      }, delay);
    } else if (visibleAt.current === null) {
      setPhase("idle");
    } else {
      const remaining = remainingSkeletonTime(visibleAt.current, Date.now(), minimumDuration);
      if (remaining === 0) {
        visibleAt.current = null;
        setPhase("idle");
      } else {
        timer = window.setTimeout(() => {
          visibleAt.current = null;
          setPhase("idle");
        }, remaining);
      }
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [delay, loading, minimumDuration]);

  return phase;
}

export function SkeletonBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" className={cn("data-skeleton", className)} />;
}

export function SkeletonText({
  lines = 3,
  widths = ["100%", "88%", "64%"],
  className,
}: {
  lines?: number;
  widths?: string[];
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          className="h-3 rounded-sm"
          style={{ width: widths[index % widths.length] }}
        />
      ))}
    </div>
  );
}

export function LoadingRegion({
  loading,
  label,
  skeleton,
  children,
  className,
  delay = SKELETON_APPEARANCE_DELAY_MS,
  minimumDuration = SKELETON_MINIMUM_VISIBLE_MS,
}: {
  loading: boolean;
  label: string;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  minimumDuration?: number;
}) {
  const phase = useSkeletonPhase(loading, delay, minimumDuration);

  if (phase === "idle") {
    return <div className={cn("data-loading-content", className)}>{children}</div>;
  }

  const statusLabel = /[.…]$/.test(label) ? label : `${label}…`;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("data-loading-region", phase === "visible" ? "opacity-100" : "opacity-0", className)}
    >
      <span className="sr-only">{statusLabel}</span>
      {skeleton}
    </div>
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
    <LoadingRegion
      loading
      label={label}
      delay={0}
      className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8"
      skeleton={(
        <>
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-28 rounded-sm" />
            <SkeletonBlock className="h-9 w-72 max-w-[70vw] rounded-sm" />
            <SkeletonBlock className="h-3 w-[32rem] max-w-[88vw] rounded-sm" />
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-xl bg-[var(--surface-primary)] p-5">
                <SkeletonBlock className="h-3 w-20 rounded-sm" />
                <SkeletonBlock className="mt-4 h-7 w-28 rounded-sm" />
                <SkeletonBlock className="mt-3 h-3 w-36 max-w-full rounded-sm" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
            <div className="min-h-64 rounded-xl bg-[var(--surface-primary)] p-6">
              <SkeletonBlock className="h-4 w-32 rounded-sm" />
              <SkeletonBlock className="mt-7 h-40 w-full rounded-lg" />
            </div>
            <div className="min-h-64 rounded-xl bg-[var(--surface-primary)] p-6">
              <SkeletonBlock className="h-4 w-28 rounded-sm" />
              <SkeletonText className="mt-7" lines={5} widths={["100%", "82%", "94%", "74%", "58%"]} />
            </div>
          </div>
        </>
      )}
    >
      {null}
    </LoadingRegion>
  );
}
