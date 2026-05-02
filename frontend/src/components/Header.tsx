"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
    Bell,
    Building2,
    Check,
    ChevronDown,
    ChevronRight,
    CreditCard,
    Cpu,
    HelpCircle,
    LogOut,
    Plus,
    Search,
    Settings,
    Shield,
    Sparkles,
    User,
    Zap,
} from "lucide-react";

const currentUserName = "Michael";

const ACCOUNTS = [
    { name: currentUserName, plan: "PRO Trial", active: true },
    { name: "Personal Research", plan: "Free", active: false },
    { name: "Atlas Capital", plan: "Team", active: false },
];

export default function Header({ onSettingsClick }: { onSettingsClick?: () => void }) {
    const [modelOpen, setModelOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
    const modelRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (modelRef.current && !modelRef.current.contains(target)) {
                setModelOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(target)) {
                setProfileOpen(false);
                setAccountSwitcherOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    const openSettings = () => {
        setProfileOpen(false);
        setAccountSwitcherOpen(false);
        onSettingsClick?.();
    };

    return (
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-4 pl-16 md:px-8 md:pl-8 bg-space-black/30 backdrop-blur-md z-40 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-primary/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-indigo-primary" />
                </div>
                <div className="relative" ref={modelRef}>
                    <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={modelOpen}
                        onClick={() => {
                            setModelOpen((open) => !open);
                            setProfileOpen(false);
                            setAccountSwitcherOpen(false);
                        }}
                        className="flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-[#0a0a0c] px-4 text-sm font-semibold text-white/86 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_28px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-[#101016] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    >
                        QuanAd 1.0
                        <ChevronDown className="h-4 w-4 text-white/45" />
                    </button>

                    <AnimatePresence>
                        {modelOpen && (
                            <motion.div
                                role="menu"
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute left-0 top-12 w-72 rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.58),0_0_52px_rgba(99,102,241,0.12)]"
                            >
                                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">Models</div>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-3 text-left"
                                >
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-primary/18 text-indigo-primary ring-1 ring-indigo-primary/25">
                                        <Cpu className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-white">QuanAd 1.0</div>
                                        <div className="text-xs text-white/38">Balanced advisor for market, portfolio, and sentiment work.</div>
                                    </div>
                                    <Check className="h-4 w-4 text-green-positive" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex items-center gap-3 md:gap-6">
                <div className="relative hidden lg:block">
                    <Search className="w-5 h-5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search markets..."
                        className="glass bg-white/5 border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-primary/50 w-64"
                    />
                </div>
                <button className="relative text-white/40 hover:text-white transition-colors">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-negative rounded-full border border-space-black" />
                </button>
                <div className="h-8 w-[1px] bg-white/10 mx-1 md:mx-2" />
                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={profileOpen}
                        onClick={() => {
                            setProfileOpen((open) => !open);
                            setAccountSwitcherOpen(false);
                            setModelOpen(false);
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.065] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    >
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-primary/20 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/30">
                            M
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-space-black bg-green-positive shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        </div>
                        <div className="hidden min-w-0 sm:block">
                            <div className="truncate text-sm font-medium text-white/85">{currentUserName}</div>
                        </div>
                    </button>

                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                role="menu"
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute right-0 top-12 w-80 rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.58),0_0_60px_rgba(99,102,241,0.1)]"
                            >
                                <button
                                    type="button"
                                    onClick={() => setAccountSwitcherOpen((open) => !open)}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                                >
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-primary/20 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/30">
                                        M
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-white">{currentUserName}</div>
                                        <div className="truncate text-xs text-white/42">Current plan: PRO Trial</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-white/35" />
                                </button>

                                <div className="my-2 h-px bg-white/[0.08]" />

                                <MenuItem icon={Sparkles} label="Upgrade plan" />
                                <MenuItem icon={User} label="Profile" />
                                <MenuItem icon={CreditCard} label="Billing" />
                                <MenuItem icon={Shield} label="Security" />
                                <MenuItem icon={HelpCircle} label="Help center" />
                                <MenuItem icon={Settings} label="Settings" onClick={openSettings} />

                                <div className="my-2 h-px bg-white/[0.08]" />

                                <button
                                    type="button"
                                    className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-red-negative/85 transition-colors hover:bg-red-negative/10 hover:text-red-negative"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Log out
                                </button>

                                <AnimatePresence>
                                    {accountSwitcherOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 8, scale: 0.98 }}
                                            animate={{ opacity: 1, x: 0, scale: 1 }}
                                            exit={{ opacity: 0, x: 8, scale: 0.98 }}
                                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                            className="absolute right-[calc(100%+0.75rem)] top-2 hidden w-64 rounded-2xl border border-white/[0.08] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_60px_rgba(0,0,0,0.58)] lg:block"
                                        >
                                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">Switch account</div>
                                            {ACCOUNTS.map((account) => (
                                                <button
                                                    type="button"
                                                    key={account.name}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.055]"
                                                >
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/60 ring-1 ring-white/10">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm text-white/85">{account.name}</div>
                                                        <div className="truncate text-xs text-white/35">{account.plan}</div>
                                                    </div>
                                                    {account.active && <Check className="h-4 w-4 text-green-positive" />}
                                                </button>
                                            ))}
                                            <div className="my-2 h-px bg-white/[0.08]" />
                                            <button
                                                type="button"
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.055]"
                                            >
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-primary/14 text-indigo-primary ring-1 ring-indigo-primary/25">
                                                    <Plus className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1 truncate text-sm text-white/85">Add account</div>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}

function MenuItem({
    icon: Icon,
    label,
    onClick,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-white/[0.055]"
        >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.055] text-white/55 ring-1 ring-white/10">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 truncate text-sm text-white/82">{label}</div>
        </button>
    );
}
