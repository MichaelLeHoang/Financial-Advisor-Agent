"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
    Archive,
    Atom,
    Brain,
    ChevronRight,
    ExternalLink,
    Menu,
    MessageSquare,
    MoreHorizontal,
    PenLine,
    Pencil,
    PieChart,
    Pin,
    Share2,
    Sparkles,
    Trash2,
    TrendingUp,
    X,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Plan } from "@/components/auth/AuthProvider";

type NavItem = {
    href: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    minPlan?: Plan;
};

const NAV: NavItem[] = [
    { href: "/dashboard", icon: Sparkles, label: "Dashboard" },
    { href: "/", icon: MessageSquare, label: "AI Advisor" },
    { href: "/market", icon: TrendingUp, label: "Market" },
    { href: "/sentiment", icon: Brain, label: "Sentiment" },
    { href: "/watchlist", icon: Pin, label: "Watchlist" },
    { href: "/portfolio", icon: PieChart, label: "Portfolio" },
    { href: "/quantum", icon: Atom, label: "Quantum", minPlan: "quant" },
];

const RECENT_THREADS = [
    "Market outlook 2026",
    "NVDA earnings risk",
    "AAPL sentiment brief",
    "Rebalance growth portfolio",
    "Quantum stock selection",
];

export default function Sidebar({
    isOpen,
    onToggle,
}: {
    isOpen: boolean;
    onToggle: () => void;
}) {
    const path = usePathname();
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const visibleNav = getVisibleNav(user?.plan ?? "free");

    useEffect(() => {
        setMobileOpen(false);
    }, [path]);

    return (
        <>
            <button
                type="button"
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((open) => !open)}
                className="fixed left-4 top-4 z-[70] flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-space-black/80 text-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <DesktopSidebar path={path} isOpen={isOpen} onToggle={onToggle} nav={visibleNav} />

            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close navigation backdrop"
                            className="fixed inset-0 z-[55] bg-space-black/70 backdrop-blur-sm md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.div
                            className="fixed inset-y-0 left-0 z-[60] w-[min(86vw,320px)] md:hidden"
                            initial={{ x: -340, opacity: 0.8 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -340, opacity: 0.8 }}
                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <SidebarSurface path={path} nav={visibleNav} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function DesktopSidebar({
    path,
    isOpen,
    onToggle,
    nav,
}: {
    path: string;
    isOpen: boolean;
    onToggle: () => void;
    nav: NavItem[];
}) {
    const [recentsOpen, setRecentsOpen] = useState(false);

    return (
        <motion.aside
            className={cn(
                "fixed inset-y-0 left-0 z-50 hidden overflow-visible md:block",
                isOpen ? "w-72" : "w-16"
            )}
            animate={{ width: isOpen ? 288 : 64 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
            {isOpen ? (
                <SidebarSurface path={path} onToggle={onToggle} nav={nav} />
            ) : (
                <MiniSidebar
                    path={path}
                    nav={nav}
                    recentsOpen={recentsOpen}
                    onToggleRecents={() => setRecentsOpen((open) => !open)}
                    onToggleSidebar={onToggle}
                />
            )}
        </motion.aside>
    );
}

function MiniSidebar({
    path,
    nav,
    recentsOpen,
    onToggleRecents,
    onToggleSidebar,
}: {
    path: string;
    nav: NavItem[];
    recentsOpen: boolean;
    onToggleRecents: () => void;
    onToggleSidebar: () => void;
}) {
    return (
        <div className="relative flex h-full flex-col items-center border-r border-white/[0.08] bg-[#050506] py-3 shadow-[12px_0_42px_rgba(0,0,0,0.4)]">
            <button
                type="button"
                aria-label="Open sidebar"
                onClick={onToggleSidebar}
                className="group relative mb-3 flex h-10 w-10 cursor-e-resize items-center justify-center rounded-xl text-white/58 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <span className="absolute flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-primary to-cyan-secondary text-white opacity-100 shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_10px_28px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] transition-opacity group-hover:opacity-0">
                    <Zap className="h-5 w-5" />
                </span>
                <span className="absolute flex h-10 w-10 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <SidebarGlyph />
                </span>
            </button>

            <Link
                href="/"
                aria-label="New analysis"
                className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-white/58 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <PenLine className="h-5 w-5" />
            </Link>

            <div className="relative mb-3">
                <button
                    type="button"
                    aria-label="Recents"
                    aria-haspopup="menu"
                    aria-expanded={recentsOpen}
                    onClick={onToggleRecents}
                    className={cn(
                        "group flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                        recentsOpen ? "bg-white/[0.09] text-white" : "text-white/52 hover:bg-white/[0.07] hover:text-white"
                    )}
                >
                    <RecentsGlyph />
                    <span className="sr-only">Recents</span>
                </button>

                <AnimatePresence>
                    {recentsOpen && (
                        <motion.div
                            role="menu"
                            initial={{ opacity: 0, x: -8, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -8, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-12 top-0 w-72 rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_rgba(0,0,0,0.58),0_0_48px_rgba(99,102,241,0.1)]"
                        >
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/38">Recent conversations</div>
                            {RECENT_THREADS.map((thread) => (
                                <RecentThreadRow key={thread} thread={thread} />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mb-3 h-px w-8 bg-white/[0.08]" />

            <nav className="flex flex-col items-center gap-1" aria-label="Primary navigation">
                {nav.map(({ href, icon: Icon, label }) => {
                    const active = path === href;

                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-label={label}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                active ? "bg-white/[0.09] text-indigo-primary" : "text-white/42 hover:bg-white/[0.07] hover:text-white"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

function SidebarSurface({
    path,
    nav,
    onToggle,
}: {
    path: string;
    nav: NavItem[];
    onToggle?: () => void;
}) {
    return (
        <div className="relative flex h-full flex-col overflow-hidden border-r border-white/[0.08] bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.16),transparent_42%),linear-gradient(180deg,rgba(7,8,11,0.96),rgba(2,2,3,0.94))] px-3 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),18px_0_55px_rgba(0,0,0,0.48),0_0_80px_rgba(99,102,241,0.08)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="pointer-events-none absolute -left-28 top-20 h-72 w-72 rounded-full bg-indigo-primary/15 blur-[95px]" />
            <div className="pointer-events-none absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-cyan-secondary/10 blur-[90px]" />

            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex h-10 items-center justify-between">
                    <Link
                        href="/"
                        aria-label="Quantum Advisor home"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-primary to-cyan-secondary text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_10px_28px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    >
                        <Zap className="h-5 w-5" />
                    </Link>
                    {onToggle && (
                        <button
                            type="button"
                            aria-label="Close sidebar"
                            onClick={onToggle}
                            className="hidden h-10 w-10 cursor-w-resize items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.07] hover:text-white md:flex"
                        >
                            <SidebarGlyph />
                        </button>
                    )}
                </div>

                <Link
                    href="/"
                    className="mb-4 flex h-11 items-center justify-between rounded-xl bg-indigo-primary px-3 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,0.55),0_8px_22px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] outline-none transition-all duration-200 hover:bg-indigo-primary/90 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.65),0_12px_30px_rgba(99,102,241,0.34),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space-black"
                >
                    <span className="flex items-center gap-2">
                        <PenLine className="h-4 w-4" />
                        New analysis
                    </span>
                    <Sparkles className="h-4 w-4 text-white/70" />
                </Link>

                <div className="space-y-6 overflow-y-auto pr-1">
                    <section>
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                            Workspace
                        </div>
                        <nav className="space-y-1" aria-label="Primary navigation">
                            {nav.map(({ href, icon: Icon, label }) => {
                                const active = path === href;

                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                            active
                                                ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_26px_rgba(99,102,241,0.14)]"
                                                : "text-white/55 hover:bg-white/[0.055] hover:text-white"
                                        )}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="active-sidebar-pill"
                                                className="absolute inset-0 rounded-xl border border-indigo-primary/25 bg-gradient-to-r from-indigo-primary/14 to-cyan-secondary/5"
                                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                            />
                                        )}
                                        <Icon className={cn("relative h-4 w-4 shrink-0", active ? "text-indigo-primary" : "text-white/40 group-hover:text-white/75")} />
                                        <span className="relative min-w-0 flex-1 truncate">{label}</span>
                                        {active && <ChevronRight className="relative h-4 w-4 text-white/35" />}
                                    </Link>
                                );
                            })}
                        </nav>
                    </section>

                    <section>
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                            Recent
                        </div>
                        <div className="space-y-1" aria-label="Recent analysis threads">
                            {RECENT_THREADS.map((thread) => (
                                <RecentThreadRow key={thread} thread={thread} compact />
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-auto border-t border-white/[0.07] pt-3">
                    <div className="relative overflow-hidden rounded-2xl border border-indigo-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_44%),rgba(255,255,255,0.045)] p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_14px_36px_rgba(0,0,0,0.34),0_0_46px_rgba(99,102,241,0.12)]">
                        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-secondary/15 blur-2xl" />
                        <div className="relative">
                            <div className="text-sm font-semibold text-white">
                                Upgrade to <span className="bg-gradient-to-r from-cyan-secondary to-indigo-primary bg-clip-text text-transparent">PRO</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-white/38">
                                Unlock deeper portfolio simulations, faster agents, and premium market memory.
                            </p>
                            <button
                                type="button"
                                className="mt-3 flex h-8 items-center gap-2 rounded-lg bg-white/[0.07] px-3 text-xs font-medium text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.11] hover:text-white"
                            >
                                Learn more
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getVisibleNav(plan: Plan): NavItem[] {
    const rank: Record<Plan, number> = {
        free: 0,
        pro: 1,
        trader: 2,
        quant: 3,
        execution_addon: 4,
    };
    return NAV.filter((item) => !item.minPlan || rank[plan] >= rank[item.minPlan]);
}

function RecentThreadRow({ thread, compact = false }: { thread: string; compact?: boolean }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
    const rowRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rowRef.current?.contains(target) && !menuRef.current?.contains(target)) {
                setMenuOpen(false);
            }
        };

        const handleReposition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuPosition({
                left: Math.min(rect.right, window.innerWidth - 176),
                top: Math.min(rect.top, window.innerHeight - 230),
            });
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
        };
    }, [menuOpen]);

    return (
        <div ref={rowRef} className="group/thread relative">
            <Link
                href="/"
                className={cn(
                    "flex items-center rounded-xl pr-10 text-sm outline-none transition-all duration-200 hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                    compact ? "h-9 px-3 text-white/48" : "h-10 px-3 text-white/62"
                )}
            >
                <span className="truncate">{thread}</span>
            </Link>
            <button
                ref={triggerRef}
                type="button"
                aria-label={`Open actions for ${thread}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenuPosition({
                        left: Math.min(rect.right, window.innerWidth - 176),
                        top: Math.min(rect.top, window.innerHeight - 230),
                    });
                    setMenuOpen((open) => !open);
                }}
                className={cn(
                    "absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-transparent text-white/40 opacity-0 transition-colors hover:bg-transparent hover:text-white group-hover/thread:opacity-100 focus:bg-transparent focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                    menuOpen && "bg-transparent text-white opacity-100"
                )}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {mounted && createPortal(
                <AnimatePresence>
                    {menuOpen && (
                    <motion.div
                        ref={menuRef}
                        role="menu"
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed z-[100] w-40 rounded-xl border border-white/[0.08] bg-[#0a0a0c] p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_48px_rgba(0,0,0,0.58),0_0_36px_rgba(99,102,241,0.1)]"
                        style={{ left: menuPosition.left, top: menuPosition.top, transformOrigin: "top left" }}
                    >
                        <RecentAction icon={Share2} label="Share" />
                        <RecentAction icon={Pencil} label="Rename" />
                        <div className="my-1 h-px bg-white/[0.08]" />
                        <RecentAction icon={Pin} label="Pin chat" />
                        <RecentAction icon={Archive} label="Archive" />
                        <RecentAction icon={Trash2} label="Delete" danger />
                    </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

function RecentAction({
    icon: Icon,
    label,
    danger = false,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            className={cn(
                "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors",
                danger ? "text-red-negative/85 hover:bg-red-negative/10 hover:text-red-negative" : "text-white/72 hover:bg-white/[0.06] hover:text-white"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function SidebarGlyph() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" data-rtl-flip="" className="icon max-md:hidden" viewBox="0 0 20 20">
            <use href="/cdn/assets/sprites-core-e650466a.svg#836f7a" fill="currentColor" />
            <path fill="currentColor" d="M4.75 3A2.75 2.75 0 0 0 2 5.75v8.5A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-8.5A2.75 2.75 0 0 0 15.25 3H4.75Zm0 1.5h2.5v11h-2.5c-.69 0-1.25-.56-1.25-1.25v-8.5c0-.69.56-1.25 1.25-1.25Zm4 0h6.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25h-6.5v-11Z" />
        </svg>
    );
}

function RecentsGlyph() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" className="icon" viewBox="0 0 20 20">
            <use href="/cdn/assets/sprites-core-e650466a.svg#003104" fill="currentColor" />
            <path fill="currentColor" d="M5.5 4.5A2.5 2.5 0 0 0 3 7v5a2.5 2.5 0 0 0 2.5 2.5h.44l-.3 1.2a.65.65 0 0 0 .98.7l2.86-1.9h5.02A2.5 2.5 0 0 0 17 12V7a2.5 2.5 0 0 0-2.5-2.5h-9Zm0 1.5h9A1 1 0 0 1 15.5 7v5a1 1 0 0 1-1 1H9.25a.75.75 0 0 0-.42.13l-1.28.85.1-.4A.75.75 0 0 0 6.92 13H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
        </svg>
    );
}
