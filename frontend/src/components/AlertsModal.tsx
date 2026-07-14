"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, UIEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bell, BookOpenCheck, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { AlertEvent, InvestmentDecisionRecord, InvestmentThesis, PortfolioBookEvent, RecurringBuy } from "@/lib/api";
import { cn } from "@/lib/utils";

type NotificationTab = "notifications" | "updates";
type NotificationItem = { id: string; symbol?: string | null; title: string; detail: string; at: string; unread: boolean };

const PRODUCT_UPDATES = [
  { id: "investment-workspace", title: "Investment workspace, rebuilt", label: "New", description: "Portfolio performance, holdings, thesis health, and policy review now share one focused workspace.", date: "July 13, 2026", image: "/cover-screenshot.png", href: "/invest", featured: true },
  { id: "performance-insights", title: "Performance insights", label: "New", description: "Review estimated position contribution, benchmark-relative performance, and data coverage.", date: "July 13, 2026", image: "/FinancialAdvisorWebsite.png", href: "/invest/performance" },
  { id: "portfolio-discipline", title: "Portfolio discipline controls", description: "Record investment theses, review concentration policy, and preserve owner-authored decisions.", date: "July 13, 2026", image: "/art-background.webp", href: "/invest/policy" },
];

export default function AlertsModal({ isOpen, onClose, sidebarOpen = false }: { isOpen: boolean; onClose: () => void; sidebarOpen?: boolean }) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("notifications");
  const [direction, setDirection] = useState(1);
  const [scrolling, setScrolling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [bookEvents, setBookEvents] = useState<PortfolioBookEvent[]>([]);
  const [decisions, setDecisions] = useState<InvestmentDecisionRecord[]>([]);
  const [theses, setTheses] = useState<InvestmentThesis[]>([]);
  const [recurringBuys, setRecurringBuys] = useState<RecurringBuy[]>([]);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const portfolios = await api.portfolios().catch(() => []);
      const [nextEvents, nextDecisions, nextTheses, bookRows, recurringRows] = await Promise.all([
        api.alertEvents().catch(() => []), api.investmentDecisions(undefined, 40).catch(() => []), api.investmentTheses().catch(() => []),
        Promise.all(portfolios.map((portfolio) => api.portfolioBookEvents(portfolio.id).catch(() => []))),
        Promise.all(portfolios.map((portfolio) => api.recurringBuys(portfolio.id).catch(() => []))),
      ]);
      setEvents(nextEvents); setDecisions(nextDecisions); setTheses(nextTheses); setBookEvents(bookRows.flat()); setRecurringBuys(recurringRows.flat());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) void refresh(); }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Element;
      if (target.closest("[data-notification-trigger]") || panelRef.current?.contains(target)) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    };
  }, [isOpen, onClose]);

  useEffect(() => () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); }, []);

  const notifications = useMemo(() => buildNotifications(pathname, events, bookEvents, decisions, theses, recurringBuys), [bookEvents, decisions, events, pathname, recurringBuys, theses]);
  const selectTab = (next: NotificationTab) => {
    if (next === tab) return;
    setDirection(next === "updates" ? 1 : -1);
    setTab(next);
  };
  const handleScroll = (_event: UIEvent<HTMLDivElement>) => {
    setScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setScrolling(false), 700);
  };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label="Notification center"
          initial={{ opacity: 0, x: -8, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.985 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "fixed inset-x-3 bottom-3 z-[230] flex h-[min(680px,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-3xl border border-[var(--theme-border-strong)] bg-[var(--surface-dialog)] text-[var(--text-primary)] shadow-[var(--shadow-dialog)] md:inset-x-auto md:bottom-4 md:w-[min(420px,calc(100vw-6rem))]",
            sidebarOpen ? "md:left-[18.75rem] md:w-[min(420px,calc(100vw-19.75rem))]" : "md:left-20",
          )}
        >
          <div className="border-b border-white/10 p-3">
            <div role="tablist" aria-label="Notification center sections" className="grid h-11 grid-cols-2 rounded-2xl border border-white/10 bg-black/25 p-1">
              <NotificationTabButton selected={tab === "notifications"} onClick={() => selectTab("notifications")}>Notifications</NotificationTabButton>
              <NotificationTabButton selected={tab === "updates"} onClick={() => selectTab("updates")}>What&apos;s new</NotificationTabButton>
            </div>
          </div>

          <div className="notification-feed min-h-0 flex-1 overflow-y-auto overscroll-contain" data-scrolling={scrolling ? "true" : "false"} onScroll={handleScroll}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={tab}
                role="tabpanel"
                aria-label={tab === "notifications" ? "Notifications" : "What's new"}
                initial={{ opacity: 0, x: direction * 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -36 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {tab === "notifications" ? (
                  <>
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5 text-xs text-[var(--text-muted)]">
                      <span>{pathname.startsWith("/invest") ? "Investment workspace activity" : "Workspace activity"}</span>
                      <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/[0.08] hover:text-white disabled:opacity-45" aria-label="Refresh notifications"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button>
                    </div>
                    {notifications.length ? <div className="divide-y divide-white/10">{notifications.map((item) => <NotificationRow key={item.id} item={item} />)}</div> : <EmptyState icon={<Bell className="size-6" />} title={loading ? "Loading activity" : "No workspace activity yet"} detail="Recorded purchases, thesis reviews, portfolio classifications, and triggered alerts will appear here." />}
                  </>
                ) : (
                  <div className="divide-y divide-white/10">
                    {PRODUCT_UPDATES.map((update) => (
                      <Link key={update.id} href={update.href} onClick={onClose} className="group block p-3 outline-none transition-colors duration-150 hover:bg-white/[0.045] focus-visible:bg-white/[0.06] motion-reduce:transition-none">
                        <article className={cn("rounded-2xl p-4 transition-colors duration-150 group-hover:bg-white/[0.055] motion-reduce:transition-none", update.featured && "bg-white/[0.055]") }>
                          <div className={cn("gap-4", update.featured ? "flex flex-col" : "grid grid-cols-[minmax(0,1fr)_112px] items-center") }>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold">{update.title}</h3>
                                {update.label && <span className="rounded-full bg-blue-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-blue-200">{update.label}</span>}
                                <ArrowRight aria-hidden="true" className="size-4 -translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                              </div>
                              <p className="mt-1.5 text-[13px] leading-5 text-[var(--text-secondary)]">{update.description}</p>
                              {!update.featured && <time className="mt-3 block text-xs text-[var(--text-muted)]">{update.date}</time>}
                            </div>
                            <img src={update.image} alt="" className={cn("w-full border border-white/10 object-cover", update.featured ? "aspect-[2.7/1] rounded-2xl" : "aspect-[1.5/1] rounded-2xl") } />
                            {update.featured && <time className="text-xs text-[var(--text-muted)]">{update.date}</time>}
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.section>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NotificationTabButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" role="tab" aria-selected={selected} onClick={onClick} className="relative overflow-hidden rounded-xl text-sm font-semibold text-[var(--text-muted)] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-primary/50">{selected && <motion.span layoutId="notification-active-tab" className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.10] shadow-[var(--shadow-control)]" transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} />}<span className={cn("relative z-10", selected && "text-white")}>{children}</span></button>;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return <article className="group grid grid-cols-[36px_minmax(0,1fr)_8px] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.045] motion-reduce:transition-none"><SymbolMark symbol={item.symbol} /><div className="min-w-0"><p className="text-sm font-medium leading-5 text-white">{item.title}</p><p className="mt-0.5 text-xs leading-4 text-[var(--text-secondary)]">{item.detail}</p><time className="mt-0.5 block text-xs text-[var(--text-muted)]">{relativeTime(item.at)}</time></div><span aria-label={item.unread ? "Unread" : "Read"} className={cn("size-2 rounded-full", item.unread ? "bg-blue-400" : "bg-transparent")} /></article>;
}
function SymbolMark({ symbol }: { symbol?: string | null }) { if (!symbol) return <span className="flex size-9 items-center justify-center rounded-full bg-white/[0.08] text-[var(--text-secondary)]"><BookOpenCheck className="size-4" /></span>; const hue = symbol.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4; const tone = ["bg-emerald-400/25 text-emerald-100", "bg-indigo-400/25 text-indigo-100", "bg-cyan-400/25 text-cyan-100", "bg-amber-400/25 text-amber-100"][hue]; return <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-full text-[9px] font-bold", tone)}>{symbol.slice(0, 4)}</span>; }
function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) { return <div className="px-8 py-20 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/[0.08] text-[var(--text-secondary)]">{icon}</div><h3 className="mt-4 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">{detail}</p></div>; }

function buildNotifications(pathname: string, events: AlertEvent[], bookEvents: PortfolioBookEvent[], decisions: InvestmentDecisionRecord[], theses: InvestmentThesis[], recurringBuys: RecurringBuy[]) {
  const investmentItems: NotificationItem[] = [
    ...recurringBuys.map((buy) => ({ id: `buy-${buy.id}`, symbol: buy.symbol, title: `${buy.symbol} recurring purchase recorded.`, detail: `${buy.filled_quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })} shares in ${buy.account || "Investment portfolio"}.`, at: buy.executed_at, unread: isRecent(buy.executed_at) })),
    ...decisions.map((decision) => ({ id: `decision-${decision.id}`, symbol: decision.symbol, title: `${decision.symbol} decision recorded.`, detail: `${capitalize(decision.action)} · ${decision.rationale}`, at: decision.created_at, unread: isRecent(decision.created_at) })),
    ...theses.map((thesis) => ({ id: `thesis-${thesis.id}`, symbol: thesis.symbol, title: `${thesis.symbol} ownership thesis updated.`, detail: thesis.status === "needs_review" ? "The thesis needs review." : thesis.status === "invalidated" ? "The thesis is marked invalidated." : "The thesis is active.", at: thesis.updated_at, unread: isRecent(thesis.updated_at) })),
    ...bookEvents.map((event) => ({ id: `book-${event.id}`, symbol: event.symbol, title: `${event.symbol} moved to ${capitalize(event.new_book_type)}.`, detail: `Classification source: ${event.classification_source.replaceAll("_", " ")}.`, at: event.created_at, unread: isRecent(event.created_at) })),
  ];
  const alertItems: NotificationItem[] = events.map((event) => ({ id: `alert-${event.id}`, symbol: event.symbol, title: event.message, detail: `${capitalize(event.alert_type)} alert`, at: event.created_at, unread: isRecent(event.created_at) }));
  const rows = pathname.startsWith("/invest") ? [...investmentItems, ...alertItems] : [...alertItems, ...investmentItems];
  return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30);
}
function isRecent(value: string) { return Date.now() - new Date(value).getTime() < 7 * 24 * 60 * 60 * 1000; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " "); }
function relativeTime(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "Just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`; if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
