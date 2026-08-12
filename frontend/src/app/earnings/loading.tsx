import { APP_RADIUS } from "@/lib/ui-design";
import { cn } from "@/lib/utils";

export default function Loading() {
  return (
    <main className="min-h-full bg-[var(--background)] px-4 pb-8 pt-20 text-[var(--text-primary)] md:pt-6 lg:px-8">
      <div className="mx-auto max-w-[1680px] animate-pulse motion-reduce:animate-none">
        <div className="h-12 border-b border-[var(--theme-border)]"><div className="h-7 w-40 rounded bg-[var(--surface-control)]" /></div>
        <div className={cn(APP_RADIUS.surface, "mt-6 h-[640px] border border-[var(--theme-border)] bg-[var(--surface-card)]")} />
      </div>
    </main>
  );
}
