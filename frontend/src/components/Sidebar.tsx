"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
    Atom,
    BookOpen,
    BarChart3,
    Brain,
    ChevronRight,
    Code2,
    ExternalLink,
    FlaskConical,
    LineChart,
    Menu,
    MessageSquare,
    MoreHorizontal,
    PenLine,
    Pencil,
    PieChart,
    Pin,
    Search,
    Shield,
    Signal,
    Sparkles,
    Trash2,
    TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ChatSession } from "@/lib/api";
import { createLocalChatSession, deleteLocalChatSession, listLocalChatSessions, renameLocalChatSession } from "@/lib/local-chat-history";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Plan } from "@/components/auth/AuthProvider";
import ChatSearchDialog from "@/components/ChatSearchDialog";
import ProfileMenu from "@/components/ProfileMenu";
import { showToast } from "@/components/ui/toast";

type NavItem = {
    href: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    minPlan?: Plan;
};

const NAV: NavItem[] = [
    { href: "/dashboard", icon: Sparkles, label: "Dashboard" },
    { href: "/session", icon: MessageSquare, label: "AI Advisor" },
    { href: "/market", icon: TrendingUp, label: "Market" },
    { href: "/sentiment", icon: Brain, label: "Sentiment" },
    { href: "/watchlist", icon: Pin, label: "Watchlist" },
    { href: "/portfolio", icon: PieChart, label: "Portfolio" },
    { href: "/backtest", icon: FlaskConical, label: "Backtest Lab", minPlan: "trader" },
    { href: "/quantum", icon: Atom, label: "Quantum", minPlan: "quant" },
];

const MORE_NAV: NavItem[] = [
    { href: "/risk", icon: Shield, label: "Risk", minPlan: "pro" },
    { href: "/journal", icon: BookOpen, label: "Journal", minPlan: "trader" },
    { href: "/strategy-compare", icon: LineChart, label: "Strategy Compare", minPlan: "quant" },
    { href: "/validation", icon: BarChart3, label: "Validation", minPlan: "quant" },
    { href: "/signals", icon: Signal, label: "Signals", minPlan: "quant" },
    { href: "/export", icon: Code2, label: "Export", minPlan: "quant" },
];

function isNavItemActive(path: string, href: string) {
    return path === href || (href === "/session" && path.startsWith("/session/"));
}

export default function Sidebar({
    isOpen,
    onToggle,
    onSettingsClick,
    onProfileClick,
    onAlertsClick,
}: {
    isOpen: boolean;
    onToggle: () => void;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    onAlertsClick?: () => void;
}) {
    const path = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const isGuest = !authLoading && Boolean(user?.is_guest);
    const visibleNav = isGuest
        ? NAV.filter((item) => item.href === "/session" || item.href === "/market")
        : getVisibleNav(user?.plan ?? "free");
    const visibleMoreNav = isGuest ? [] : getVisibleMoreNav(user?.plan ?? "free");
    const isSessionPath = path === "/session" || path.startsWith("/session/");
    const routeSessionId = isSessionPath && path !== "/session" ? decodeURIComponent(path.split("/")[2] || "") : null;
    const activeSessionId = isSessionPath ? routeSessionId || searchParams.get("session") || "default" : null;
    const displaySessions = useMemo(() => sessions, [sessions]);
    const creatingSessionRef = useRef(false);

    const openSearch = useCallback(() => {
        setSearchOpen(true);
        setMobileOpen(false);
    }, []);

    const refreshSessions = useCallback(async () => {
        setSessionsLoading(true);
        if (authLoading) return;
        if (user?.is_guest) {
            setSessions(listLocalChatSessions());
            setSessionsLoading(false);
            return;
        }

        try {
            setSessions(await api.chatSessions());
        } catch {
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    }, [authLoading, user?.id, user?.is_guest]);

    const startNewAnalysis = useCallback(() => {
        const activeSessionIsListed = activeSessionId ? sessions.some((session) => session.session_id === activeSessionId) : false;
        if (activeSessionId && !activeSessionIsListed) {
            router.push(activeSessionId === "default" ? "/session" : `/session/${encodeURIComponent(activeSessionId)}`);
            setMobileOpen(false);
            window.setTimeout(() => window.dispatchEvent(new Event("chat-input:focus")), 80);
            return;
        }

        const reusableBlankSession = sessions.find((session) => session.message_count === 0);
        if (reusableBlankSession) {
            router.push(`/session/${encodeURIComponent(reusableBlankSession.session_id)}`);
            setMobileOpen(false);
            window.setTimeout(() => window.dispatchEvent(new Event("chat-input:focus")), 80);
            return;
        }
        if (creatingSessionRef.current) return;
        creatingSessionRef.current = true;

        const nextSessionId = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `session-${Date.now()}`;
        const optimisticSession: ChatSession = {
            session_id: nextSessionId,
            title: "New chat",
            message_count: 0,
            last_active: new Date().toISOString(),
        };

        setSessions((current) => [optimisticSession, ...current.filter((session) => session.session_id !== nextSessionId)]);
        router.push(`/session/${encodeURIComponent(nextSessionId)}`);
        setMobileOpen(false);
        window.setTimeout(() => window.dispatchEvent(new Event("chat-input:focus")), 80);

        if (user?.is_guest) {
            createLocalChatSession(nextSessionId);
            creatingSessionRef.current = false;
            return;
        }

        api.createChatSession(nextSessionId)
            .then((savedSession) => {
                setSessions((current) => [savedSession, ...current.filter((session) => session.session_id !== nextSessionId)]);
            })
            .catch(() => {
                setSessions((current) => current.filter((session) => session.session_id !== nextSessionId));
                router.replace("/session");
            })
            .finally(() => {
                creatingSessionRef.current = false;
            });
    }, [activeSessionId, router, sessions, user?.is_guest]);

    const handleSessionDeleted = useCallback((sessionId: string) => {
        refreshSessions();
        if (activeSessionId === sessionId) {
            router.push("/session");
        }
    }, [activeSessionId, refreshSessions, router]);

    useEffect(() => {
        setMobileOpen(false);
    }, [path]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                openSearch();
            }
        };

        window.addEventListener("keydown", handleShortcut);

        return () => {
            window.removeEventListener("keydown", handleShortcut);
        };
    }, [openSearch]);

    useEffect(() => {
        refreshSessions();

        const handleChanged = () => refreshSessions();
        const handlePrivacyReset = () => {
            setSessions([]);
            setSessionsLoading(false);
        };
        window.addEventListener("chat-sessions:changed", handleChanged);
        window.addEventListener("chat-privacy:reset", handlePrivacyReset);

        return () => {
            window.removeEventListener("chat-sessions:changed", handleChanged);
            window.removeEventListener("chat-privacy:reset", handlePrivacyReset);
        };
    }, [refreshSessions]);

    return (
        <>
            <button
                type="button"
                aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((open) => !open)}
                className="group fixed left-4 top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--surface-mobile-trigger)] text-[var(--text-secondary)] shadow-[var(--shadow-control)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 md:hidden"
            >
                {mobileOpen ? (
                    <img
                        src="/close-svgrepo-com.svg"
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-5 opacity-70 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    />
                ) : (
                    <Menu className="h-5 w-5 transition-colors group-hover:text-[var(--text-primary)]" />
                )}
            </button>

            <DesktopSidebar
                path={path}
                isOpen={isOpen}
                onToggle={onToggle}
                nav={visibleNav}
                moreNav={visibleMoreNav}
                sessions={displaySessions}
                sessionsLoading={sessionsLoading}
                activeSessionId={activeSessionId}
                isGuest={isGuest}
                onNewAnalysis={startNewAnalysis}
                onSearchClick={openSearch}
                onSessionsChanged={refreshSessions}
                onSessionDeleted={handleSessionDeleted}
                onSettingsClick={onSettingsClick}
                onProfileClick={onProfileClick}
                onAlertsClick={onAlertsClick}
            />

            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close navigation backdrop"
                            className="fixed inset-0 z-[55] bg-[var(--surface-nav-backdrop)] backdrop-blur-sm md:hidden"
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
                            <SidebarSurface
                                path={path}
                                nav={visibleNav}
                                moreNav={visibleMoreNav}
                                sessions={displaySessions}
                                sessionsLoading={sessionsLoading}
                                activeSessionId={activeSessionId}
                                isGuest={isGuest}
                                onNewAnalysis={startNewAnalysis}
                                onSearchClick={openSearch}
                                onSessionsChanged={refreshSessions}
                                onSessionDeleted={handleSessionDeleted}
                                onSettingsClick={onSettingsClick}
                                onProfileClick={onProfileClick}
                                onAlertsClick={onAlertsClick}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <ChatSearchDialog open={searchOpen} onOpenChange={setSearchOpen} sessions={sessions} />
        </>
    );
}

function DesktopSidebar({
    path,
    isOpen,
    onToggle,
    nav,
    moreNav,
    sessions,
    sessionsLoading,
    activeSessionId,
    isGuest,
    onNewAnalysis,
    onSearchClick,
    onSessionsChanged,
    onSessionDeleted,
    onSettingsClick,
    onProfileClick,
    onAlertsClick,
}: {
    path: string;
    isOpen: boolean;
    onToggle: () => void;
    nav: NavItem[];
    moreNav: NavItem[];
    sessions: ChatSession[];
    sessionsLoading: boolean;
    activeSessionId: string | null;
    isGuest: boolean;
    onNewAnalysis: () => void;
    onSearchClick: () => void;
    onSessionsChanged: () => void;
    onSessionDeleted: (sessionId: string) => void;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    onAlertsClick?: () => void;
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
                <SidebarSurface
                    path={path}
                    onToggle={onToggle}
                    nav={nav}
                    moreNav={moreNav}
                    sessions={sessions}
                    sessionsLoading={sessionsLoading}
                    activeSessionId={activeSessionId}
                    isGuest={isGuest}
                    onNewAnalysis={onNewAnalysis}
                    onSearchClick={onSearchClick}
                    onSessionsChanged={onSessionsChanged}
                    onSessionDeleted={onSessionDeleted}
                    onSettingsClick={onSettingsClick}
                    onProfileClick={onProfileClick}
                    onAlertsClick={onAlertsClick}
                />
            ) : (
                <MiniSidebar
                    path={path}
                    nav={nav}
                    moreNav={moreNav}
                    sessions={sessions}
                    sessionsLoading={sessionsLoading}
                    activeSessionId={activeSessionId}
                    isGuest={isGuest}
                    recentsOpen={recentsOpen}
                    onNewAnalysis={onNewAnalysis}
                    onSearchClick={onSearchClick}
                    onToggleRecents={() => setRecentsOpen((open) => !open)}
                    onToggleSidebar={onToggle}
                    onSessionsChanged={onSessionsChanged}
                    onSessionDeleted={onSessionDeleted}
                    onSettingsClick={onSettingsClick}
                    onProfileClick={onProfileClick}
                    onAlertsClick={onAlertsClick}
                />
            )}
        </motion.aside>
    );
}

function MiniSidebar({
    path,
    nav,
    moreNav,
    sessions,
    sessionsLoading,
    activeSessionId,
    isGuest,
    recentsOpen,
    onNewAnalysis,
    onSearchClick,
    onToggleRecents,
    onToggleSidebar,
    onSessionsChanged,
    onSessionDeleted,
    onSettingsClick,
    onProfileClick,
    onAlertsClick,
}: {
    path: string;
    nav: NavItem[];
    moreNav: NavItem[];
    sessions: ChatSession[];
    sessionsLoading: boolean;
    activeSessionId: string | null;
    isGuest: boolean;
    recentsOpen: boolean;
    onNewAnalysis: () => void;
    onSearchClick: () => void;
    onToggleRecents: () => void;
    onToggleSidebar: () => void;
    onSessionsChanged: () => void;
    onSessionDeleted: (sessionId: string) => void;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    onAlertsClick?: () => void;
}) {
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = moreNav.some((item) => path === item.href);

    return (
        <div className="relative flex h-full flex-col items-center border-r border-[var(--theme-border)] bg-[var(--surface-popover-strong)] py-4 shadow-[var(--shadow-sidebar)]">
            <button
                type="button"
                aria-label="Open sidebar"
                onClick={onToggleSidebar}
                className="group relative mb-3 flex h-10 w-10 cursor-e-resize items-center justify-center rounded-xl text-white/58 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                    <span className="absolute flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] opacity-100 shadow-[var(--shadow-brand-mark)] transition-opacity group-hover:opacity-0">
                    <img src="/logo.svg" alt="" className="h-6 w-6 object-contain" />
                </span>
                <span className="absolute flex h-10 w-10 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <SidebarGlyph />
                </span>
            </button>

            <button
                type="button"
                onClick={onNewAnalysis}
	                aria-label="New chat"
                className="mb-4 flex h-11 w-10 items-center justify-center rounded-xl text-white/58 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <PenLine className="h-5 w-5" />
            </button>

            <button
                type="button"
                onClick={onSearchClick}
                aria-label="Search chats"
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white/58 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
                <Search className="h-5 w-5" />
            </button>

            <div className="h-6" />

            <nav className="flex flex-col items-center gap-1" aria-label="Primary navigation">
                {nav.map(({ href, icon: Icon, label }) => {
                    const active = isNavItemActive(path, href);

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

            {moreNav.length > 0 && (
                <div className="relative mt-1">
                    <button
                        type="button"
                        aria-label="More sections"
                        aria-haspopup="menu"
                        aria-expanded={moreOpen}
                        onClick={() => setMoreOpen((open) => !open)}
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                            moreOpen || moreActive ? "bg-white/[0.09] text-indigo-primary" : "text-white/42 hover:bg-white/[0.07] hover:text-white"
                        )}
                    >
                        <MoreHorizontal className="h-5 w-5" />
                    </button>
                    <AnimatePresence>
                        {moreOpen && (
                            <motion.div
                                role="menu"
                                initial={{ opacity: 0, x: -8, scale: 0.98 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -8, scale: 0.98 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute left-12 top-0 w-48 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]"
                            >
                                {moreNav.map(({ href, icon: Icon, label }) => {
                                    const active = isNavItemActive(path, href);
                                    return (
                                        <Link
                                            key={href}
                                            href={href}
                                            role="menuitem"
                                            onClick={() => setMoreOpen(false)}
                                            className={cn(
                                                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                                active ? "bg-white/[0.09] text-white" : "text-white/62 hover:bg-white/[0.06] hover:text-white"
                                            )}
                                        >
                                            <Icon className={cn("h-4 w-4", active ? "text-indigo-primary" : "text-white/45")} />
                                            {label}
                                        </Link>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div className="mt-6 h-px w-8 bg-white/[0.08]" />

            <div className="relative mt-3">
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
                            className="absolute left-12 top-0 w-72 rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-2 shadow-[var(--shadow-popover)]"
                        >
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/38">Recent conversations</div>
                            {sessionsLoading && sessions.length === 0 ? (
                                <ChatHistorySkeleton compact count={4} />
                            ) : sessions.length > 0 ? (
                                <div className="max-h-72 overflow-y-auto pr-1">
                                    <AnimatePresence initial={false}>
                                        {sessions.map((session) => (
                                            <RecentThreadRow
                                                key={session.session_id}
                                                session={session}
                                                active={activeSessionId === session.session_id}
                                                isGuest={isGuest}
                                                onSessionsChanged={onSessionsChanged}
                                                onSessionDeleted={onSessionDeleted}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="px-3 py-2 text-sm text-white/38">No recent chats yet.</div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mt-auto">
                <ProfileMenu compact onSettingsClick={onSettingsClick} onProfileClick={onProfileClick} onAlertsClick={onAlertsClick} />
            </div>
        </div>
    );
}

function SidebarSurface({
    path,
    nav,
    moreNav,
    sessions,
    sessionsLoading,
    activeSessionId,
    isGuest,
    onNewAnalysis,
    onSearchClick,
    onToggle,
    onSessionsChanged,
    onSessionDeleted,
    onSettingsClick,
    onProfileClick,
    onAlertsClick,
}: {
    path: string;
    nav: NavItem[];
    moreNav: NavItem[];
    sessions: ChatSession[];
    sessionsLoading: boolean;
    activeSessionId: string | null;
    isGuest: boolean;
    onNewAnalysis: () => void;
    onSearchClick: () => void;
    onToggle?: () => void;
    onSessionsChanged: () => void;
    onSessionDeleted: (sessionId: string) => void;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    onAlertsClick?: () => void;
}) {
    const [showProCard, setShowProCard] = useState(true);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreActive = moreNav.some((item) => path === item.href);

    return (
        <div className="relative flex h-full flex-col overflow-hidden border-r border-[var(--theme-border)] bg-[var(--surface-sidebar)] px-3 py-4 shadow-[var(--shadow-sidebar)]">

            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex h-10 items-center justify-between">
                    <Link
                        href="/session"
                        aria-label="Quanfora home"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-[var(--shadow-brand-mark-strong)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    >
                        <img src="/logo.svg" alt="" className="h-6 w-6 object-contain" />
                    </Link>
                    {onToggle && (
                        <button
                            type="button"
                            aria-label="Close sidebar"
                            onClick={onToggle}
                            className="hidden h-10 w-10 cursor-w-resize items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.07] hover:text-white md:flex"
                        >
                            <SidebarGlyph />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onNewAnalysis}
                    className="accent-gradient-surface on-accent mb-4 flex h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold shadow-[var(--shadow-create-action)] outline-none transition-all duration-200 hover:shadow-[var(--shadow-create-action-hover)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space-black"
                >
                    <span className="flex items-center gap-2">
                        <PenLine className="h-5 w-5" />
                        New chat
                    </span>
                    <Sparkles className="h-4 w-4 text-white/70" />
                </button>

                <button
                    type="button"
                    onClick={onSearchClick}
                    className="mb-4 flex h-10 items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-card)] px-3 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-control)] outline-none transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                >
                    <Search className="h-5 w-5" />
                    <span className="min-w-0 flex-1 text-left">Search chats</span>
                    <span className="rounded-md border border-[var(--theme-border)] bg-[var(--surface-card-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] opacity-55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] blur-[0.1px]">
                        ⌘ K
                    </span>
                </button>

                <div className="flex min-h-0 flex-1 flex-col gap-6 pr-1">
                    <section className="shrink-0">
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                            Workspace
                        </div>
                        <nav className="space-y-1" aria-label="Primary navigation">
                            {nav.map(({ href, icon: Icon, label }) => {
                                const active = isNavItemActive(path, href);

                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                            active
                                                ? "bg-white/[0.09] text-white shadow-[var(--shadow-selected-nav)]"
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
                                        <Icon className={cn("relative h-5 w-5 shrink-0", active ? "text-indigo-primary" : "text-white/40 group-hover:text-white/75")} />
                                        <span className="relative min-w-0 flex-1 truncate">{label}</span>
                                        {active && <ChevronRight className="relative h-4 w-4 text-white/35" />}
                                    </Link>
                                );
                            })}
                        </nav>
                        {moreNav.length > 0 && (
                            <div className="mt-1">
                                <button
                                    type="button"
                                    aria-expanded={moreOpen}
                                    onClick={() => setMoreOpen((open) => !open)}
                                    className={cn(
                                        "group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                        moreOpen || moreActive
                                            ? "bg-white/[0.09] text-white shadow-[var(--shadow-selected-nav)]"
                                            : "text-white/55 hover:bg-white/[0.055] hover:text-white"
                                    )}
                                >
                                    {(moreOpen || moreActive) && (
                                        <motion.span
                                            layoutId="active-sidebar-more-pill"
                                            className="absolute inset-0 rounded-xl border border-indigo-primary/25 bg-gradient-to-r from-indigo-primary/14 to-cyan-secondary/5"
                                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                        />
                                    )}
                                    <MoreHorizontal className={cn("relative h-5 w-5 shrink-0", moreOpen || moreActive ? "text-indigo-primary" : "text-white/40 group-hover:text-white/75")} />
                                    <span className="relative min-w-0 flex-1 text-left">More</span>
                                    <ChevronRight className={cn("relative h-4 w-4 text-white/35 transition-transform", moreOpen && "rotate-90")} />
                                </button>
                                <AnimatePresence initial={false}>
                                    {moreOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-1 space-y-1 pl-3">
                                                {moreNav.map(({ href, icon: Icon, label }) => {
                                                    const active = isNavItemActive(path, href);
                                                    return (
                                                        <Link
                                                            key={href}
                                                            href={href}
                                                            aria-current={active ? "page" : undefined}
                                                            className={cn(
                                                                "group flex h-9 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                                                                active ? "bg-white/[0.08] text-white" : "text-white/48 hover:bg-white/[0.05] hover:text-white"
                                                            )}
                                                        >
                                                            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-indigo-primary" : "text-white/35 group-hover:text-white/70")} />
                                                            <span className="min-w-0 flex-1 truncate">{label}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col">
                        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                            Recent
                        </div>
                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Recent analysis threads">
                            {sessionsLoading && sessions.length === 0 ? (
                                <ChatHistorySkeleton count={6} />
                            ) : sessions.length > 0 ? (
                                <AnimatePresence initial={false}>
                                    {sessions.map((session) => (
                                        <RecentThreadRow
                                            key={session.session_id}
                                            session={session}
                                            compact
                                            active={activeSessionId === session.session_id}
                                            isGuest={isGuest}
                                            onSessionsChanged={onSessionsChanged}
                                            onSessionDeleted={onSessionDeleted}
                                        />
                                    ))}
                                </AnimatePresence>
                            ) : (
                                <div className="rounded-xl px-3 py-2 text-sm text-white/38">No recent chats yet.</div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-white/[0.06] pt-3">
                    {showProCard && (
                        <div className="relative overflow-hidden rounded-2xl border border-indigo-primary/20 bg-[var(--pro-card-bg)] p-3 shadow-[var(--pro-card-shadow)]">
                            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-secondary/15 blur-2xl" />
                            <button
                                type="button"
                                aria-label="Dismiss upgrade prompt"
                                onClick={() => setShowProCard(false)}
                                className="group absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-lg text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                            >
                                <img src="/close-svgrepo-com.svg" alt="" aria-hidden="true" className="size-3.5 opacity-70 transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:drop-shadow-[0_0_7px_rgba(255,255,255,0.65)]" />
                            </button>
                            <div className="relative pr-6">
                                <div className="text-sm font-semibold text-white">
                                    Upgrade to <span className="bg-gradient-to-r from-cyan-secondary to-indigo-primary bg-clip-text text-transparent">PRO</span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-white/38">
                                    Unlock deeper portfolio simulations, faster agents, and premium market memory.
                                </p>
                                <Link
                                    href="/pricing"
                                    className="mt-3 flex h-8 w-fit items-center gap-2 rounded-lg bg-white/[0.07] px-3 text-xs font-medium text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-white/[0.11] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                                >
                                    Learn more
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </div>
                    )}
                    <ProfileMenu onSettingsClick={onSettingsClick} onProfileClick={onProfileClick} onAlertsClick={onAlertsClick} />
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

function getVisibleMoreNav(plan: Plan): NavItem[] {
    const rank: Record<Plan, number> = {
        free: 0,
        pro: 1,
        trader: 2,
        quant: 3,
        execution_addon: 4,
    };
    return MORE_NAV.filter((item) => !item.minPlan || rank[plan] >= rank[item.minPlan]);
}

function ChatHistorySkeleton({ compact = false, count = 5 }: { compact?: boolean; count?: number }) {
    return (
        <div className="space-y-1 px-1" aria-label="Loading chat history">
            {Array.from({ length: count }, (_, index) => (
                <div
                    key={index}
                    className={cn(
                        "animate-pulse rounded-xl bg-white/[0.045]",
                        compact ? "h-9" : "h-10"
                    )}
                    style={{ width: `${92 - (index % 3) * 10}%` }}
                />
            ))}
        </div>
    );
}

function RecentThreadRow({
    session,
    compact = false,
    active = false,
    isGuest = false,
    onSessionsChanged,
    onSessionDeleted,
}: {
    session: ChatSession;
    compact?: boolean;
    active?: boolean;
    isGuest?: boolean;
    onSessionsChanged: () => void;
    onSessionDeleted: (sessionId: string) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(session.title);
    const [savingTitle, setSavingTitle] = useState(false);
    const rowRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!editing) setDraftTitle(session.title);
    }, [editing, session.title]);

    useEffect(() => {
        if (!editing) return;
        window.requestAnimationFrame(() => {
            titleInputRef.current?.focus();
            titleInputRef.current?.select();
        });
    }, [editing]);

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

    const renameSession = async () => {
        setMenuOpen(false);
        setEditing(true);
    };

    const commitRename = async () => {
        const nextTitle = draftTitle.trim();
        if (!nextTitle) {
            cancelRename();
            return;
        }
        if (nextTitle === session.title) {
            setEditing(false);
            return;
        }

        setSavingTitle(true);
        try {
            if (isGuest) {
                renameLocalChatSession(session.session_id, nextTitle);
            } else {
                await api.renameChatSession(session.session_id, nextTitle);
            }
            setEditing(false);
            onSessionsChanged();
            showToast({
                title: "Chat renamed",
                message: `Renamed to ${nextTitle}.`,
                variant: "success",
            });
        } catch (error) {
            showToast({
                title: "Unable to rename chat",
                message: error instanceof Error ? error.message : "Unable to rename this chat.",
                variant: "error",
            });
        } finally {
            setSavingTitle(false);
        }
    };

    const cancelRename = () => {
        setDraftTitle(session.title);
        setEditing(false);
    };

    const deleteSession = async () => {
        setMenuOpen(false);
        if (!window.confirm(`Delete "${session.title}"?`)) return;

        try {
            if (isGuest) {
                deleteLocalChatSession(session.session_id);
            } else {
                await api.deleteChatSession(session.session_id);
            }
            onSessionDeleted(session.session_id);
            showToast({
                title: "Chat deleted",
                message: `${session.title} was removed.`,
                variant: "success",
            });
        } catch (error) {
            showToast({
                title: "Unable to delete chat",
                message: error instanceof Error ? error.message : "Unable to delete this chat.",
                variant: "error",
            });
        }
    };

    return (
        <motion.div
            ref={rowRef}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="group/thread relative"
        >
            {editing ? (
                <input
                    ref={titleInputRef}
                    value={draftTitle}
                    disabled={savingTitle}
                    aria-label={`Rename ${session.title}`}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                        }
                    }}
                    className={cn(
                        "w-full rounded-xl border border-indigo-primary/40 bg-white/[0.075] pr-10 text-sm text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:ring-2 focus:ring-indigo-primary/45",
                        compact ? "h-9 px-3" : "h-10 px-3"
                    )}
                />
            ) : (
                <Link
                    href={`/session/${encodeURIComponent(session.session_id)}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                        "flex items-center rounded-xl text-sm outline-none transition-all duration-200 hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-primary/50",
                        "pr-10",
                        compact ? "h-9 px-3 text-white/48" : "h-10 px-3 text-white/62",
                        active && "bg-white/[0.07] text-white"
                    )}
                >
                    <AnimatedChatTitle title={session.title} />
                </Link>
            )}
            <button
                ref={triggerRef}
                type="button"
                aria-label={`Open actions for ${session.title}`}
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
                    (menuOpen || editing) && "bg-transparent text-white opacity-100"
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
                        className="fixed z-[100] w-40 rounded-xl border border-[var(--theme-border)] bg-[var(--surface-popover)] p-1.5 shadow-[var(--shadow-popover)]"
                        style={{ left: menuPosition.left, top: menuPosition.top, transformOrigin: "top left" }}
                    >
                        <RecentAction icon={Pencil} label="Rename" onClick={renameSession} />
                        <div className="my-1 h-px bg-white/[0.08]" />
                        <RecentAction icon={Trash2} label="Delete" danger onClick={deleteSession} />
                    </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </motion.div>
    );
}

function AnimatedChatTitle({ title }: { title: string }) {
    return (
        <motion.span
            key={title}
            className="block min-w-0 truncate"
            aria-label={title}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: 0.018,
                        delayChildren: 0.03,
                    },
                },
            }}
        >
            {Array.from(title).map((char, index) => (
                <motion.span
                    key={`${char}-${index}`}
                    aria-hidden="true"
                    className="inline-block"
                    variants={{
                        hidden: { opacity: 0, x: -4 },
                        visible: {
                            opacity: 1,
                            x: 0,
                            transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
                        },
                    }}
                >
                    {char === " " ? "\u00a0" : char}
                </motion.span>
            ))}
        </motion.span>
    );
}

function RecentAction({
    icon: Icon,
    label,
    onClick,
    danger = false,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
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
