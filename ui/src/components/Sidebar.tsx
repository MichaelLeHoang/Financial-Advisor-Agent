"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, TrendingUp, Brain, PieChart, Atom, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",           icon: MessageSquare, label: "AI Chat" },
  { href: "/market",     icon: TrendingUp,    label: "Market" },
  { href: "/sentiment",  icon: Brain,         label: "Sentiment" },
  { href: "/portfolio",  icon: PieChart,      label: "Portfolio" },
  { href: "/quantum",    icon: Atom,          label: "Quantum" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex flex-col w-16 glass border-r border-[var(--border)] bg-[var(--bg-surface)]">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-[var(--border)]">
        <Activity className="w-6 h-6 text-[var(--accent)]" style={{ filter: "drop-shadow(0 0 6px var(--accent))" }} />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1 py-4">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                active
                  ? "bg-[var(--accent)] text-white shadow-lg"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
              )}
              style={active ? { boxShadow: "0 0 16px var(--accent-glow)" } : {}}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <span className="absolute left-14 px-2 py-1 text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border)] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom status dot */}
      <div className="flex items-center justify-center h-14 border-t border-[var(--border)]">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" style={{ boxShadow: "0 0 8px var(--accent-green)" }} />
      </div>
    </aside>
  );
}
