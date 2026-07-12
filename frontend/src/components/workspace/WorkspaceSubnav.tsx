"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { WORKSPACE_NAVIGATION, isWorkspaceItemActive, planAllows, type WorkspaceKey } from "@/config/workspace-navigation";
import { cn } from "@/lib/utils";

export default function WorkspaceSubnav({ workspace, children }: { workspace: WorkspaceKey; children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const navigation = WORKSPACE_NAVIGATION[workspace];

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-[55] border-b border-[var(--theme-border)] bg-[var(--surface-sidebar)]/95 backdrop-blur-xl">
        <nav className="flex min-h-12 items-center overflow-x-auto pl-20 pr-4 [scrollbar-width:none] md:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden" aria-label={`${navigation.label} navigation`}>
          <span className="mr-5 hidden shrink-0 text-xs font-semibold uppercase text-[var(--text-subtle)] xl:block">{navigation.label}</span>
          {navigation.items.map((item) => {
            const active = isWorkspaceItemActive(pathname, item);
            const allowed = planAllows(user.plan, item.minPlan);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-primary/45",
                  active && "text-[var(--text-primary)]",
                )}
              >
                {item.label}
                {!allowed && <LockKeyhole className="size-3 text-[var(--text-subtle)]" aria-label={`${item.minPlan} plan required`} />}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[var(--text-primary)]" />}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
