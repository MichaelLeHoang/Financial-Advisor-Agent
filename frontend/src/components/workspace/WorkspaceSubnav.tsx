"use client";

import { useEffect, useRef, useState } from "react";
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
  const topNavRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const topNav = topNavRef.current;
    if (!topNav) return;

    let scrollParent: HTMLElement | null = topNav.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const overflowY = getComputedStyle(scrollParent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }

    const target: HTMLElement | Window = scrollParent && scrollParent !== document.body ? scrollParent : window;
    const syncBorder = () => setIsScrolled(target instanceof Window ? target.scrollY > 2 : target.scrollTop > 2);
    syncBorder();
    target.addEventListener("scroll", syncBorder, { passive: true });
    return () => target.removeEventListener("scroll", syncBorder);
  }, [pathname]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="min-h-full">
      <div className="workspace-top-nav-shell pointer-events-none sticky top-0 z-[55] flex justify-center pb-1 pl-16 pr-2 pt-3 md:px-2">
        <nav
          ref={topNavRef}
          data-workspace-top-nav
          data-scrolled={isScrolled ? "true" : "false"}
          className={cn(
            "workspace-top-nav pointer-events-auto flex min-h-12 w-max max-w-full items-center justify-start overflow-x-auto rounded-full border bg-[var(--surface-header)] px-2 backdrop-blur-xl md:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            isScrolled ? "border-[var(--theme-border)]" : "border-transparent",
          )}
          aria-label={`${navigation.label} navigation`}
        >
          {navigation.items.map((item) => {
            const active = isWorkspaceItemActive(pathname, item);
            const allowed = planAllows(user.plan, item.minPlan);
            return (
              <Link
                ref={active ? activeItemRef : undefined}
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
                {active && (
                  <span
                    data-active-tab-indicator
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-1.5 left-1/2 h-1 w-10 -translate-x-1/2"
                  >
                    <span
                      data-active-tab-line
                      className="workspace-tab-line absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-[var(--text-primary)]"
                    />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
