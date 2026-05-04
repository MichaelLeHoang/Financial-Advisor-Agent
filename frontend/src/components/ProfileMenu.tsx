"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
    Building2,
    Check,
    ChevronRight,
    CreditCard,
    HelpCircle,
    LogIn,
    LogOut,
    Plus,
    Settings,
    Shield,
    Sparkles,
    User,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProfileMenu({
    compact = false,
    onSettingsClick,
}: {
    compact?: boolean;
    onSettingsClick?: () => void;
}) {
    const router = useRouter();
    const { user, error: authError, signIn, signUp, signOut } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!profileRef.current?.contains(event.target as Node)) {
                setProfileOpen(false);
                setAccountSwitcherOpen(false);
                setSignInOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    const currentUserName = user?.display_name || user?.email?.split("@")[0] || "Researcher";
    const currentPlan = user?.plan ?? "free";
    const initial = currentUserName.slice(0, 1).toUpperCase();
    const isGuest = user?.is_guest ?? false;

    const submitAuth = async (event: FormEvent) => {
        event.preventDefault();
        setAuthSubmitting(true);
        try {
            if (authMode === "signin") {
                await signIn(email, password);
            } else {
                await signUp(email, password);
            }
            setSignInOpen(false);
            setProfileOpen(false);
        } finally {
            setAuthSubmitting(false);
        }
    };

    const openSettings = () => {
        setProfileOpen(false);
        setAccountSwitcherOpen(false);
        setSignInOpen(false);
        onSettingsClick?.();
    };

    return (
        <div className="relative" ref={profileRef}>
            <button
                type="button"
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => {
                    setProfileOpen((open) => !open);
                    setAccountSwitcherOpen(false);
                }}
                className={compact
                    ? "flex size-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    : "flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.065] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                }
            >
                <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-primary/20 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/30">
                    {initial}
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full border border-space-black bg-green-positive shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                {!compact && (
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white/85">{currentUserName}</div>
                        <div className="truncate text-xs text-white/35">{formatPlan(currentPlan)}</div>
                    </div>
                )}
            </button>

            <AnimatePresence>
                {profileOpen && (
                    <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className={compact
                            ? "absolute bottom-0 left-12 z-[130] w-80 rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.58),0_0_60px_rgba(99,102,241,0.1)]"
                            : "absolute bottom-14 left-0 z-[130] w-80 rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.58),0_0_60px_rgba(99,102,241,0.1)]"
                        }
                    >
                        <button
                            type="button"
                            onClick={() => setAccountSwitcherOpen((open) => !open)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                        >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-primary/20 text-xs font-semibold text-indigo-primary ring-1 ring-indigo-primary/30">
                                {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">{currentUserName}</div>
                                <div className="truncate text-xs text-white/42">Current plan: {formatPlan(currentPlan)}</div>
                            </div>
                            <ChevronRight className="size-4 text-white/35" />
                        </button>

                        <div className="my-2 h-px bg-white/[0.08]" />

                        {isGuest && (
                            <MenuItem
                                icon={LogIn}
                                label="Sign in"
                                onClick={() => {
                                    setSignInOpen((open) => !open);
                                    setAccountSwitcherOpen(false);
                                }}
                            />
                        )}
                        <MenuItem icon={Sparkles} label="Upgrade plan" />
                        {!isGuest && <MenuItem icon={User} label="Profile" />}
                        {!isGuest && <MenuItem icon={CreditCard} label="Billing" onClick={() => router.push("/billing")} />}
                        <MenuItem icon={Shield} label="Security" />
                        <MenuItem icon={HelpCircle} label="Help center" />
                        <MenuItem icon={Settings} label="Settings" onClick={openSettings} />
                        {!isGuest && <MenuItem icon={LogOut} label="Sign out" onClick={signOut} />}

                        <div className="my-2 h-px bg-white/[0.08]" />

                        <AnimatePresence>
                            {signInOpen && (
                                <motion.form
                                    onSubmit={submitAuth}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.16 }}
                                    className="mb-2 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] p-3"
                                >
                                    <div className="flex rounded-lg bg-black/20 p-1">
                                        <Button
                                            type="button"
                                            variant={authMode === "signin" ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setAuthMode("signin")}
                                            className="h-8 flex-1 rounded-md text-xs"
                                        >
                                            Sign in
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={authMode === "signup" ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => setAuthMode("signup")}
                                            className="h-8 flex-1 rounded-md text-xs"
                                        >
                                            Sign up
                                        </Button>
                                    </div>
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="Email"
                                        className="h-10 rounded-lg border-white/[0.06] bg-black/20 text-sm"
                                        required
                                    />
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Password"
                                        className="h-10 rounded-lg border-white/[0.06] bg-black/20 text-sm"
                                        required
                                        minLength={6}
                                    />
                                    {authError && <p className="text-xs text-red-negative">{authError}</p>}
                                    <Button
                                        type="submit"
                                        disabled={authSubmitting}
                                        className="h-10 w-full rounded-lg bg-indigo-primary text-sm font-semibold text-white hover:bg-indigo-primary/90"
                                    >
                                        {authSubmitting ? "Working..." : authMode === "signin" ? "Sign in" : "Create account"}
                                    </Button>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {accountSwitcherOpen && (
                                <motion.div
                                    initial={{ opacity: 0, x: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 8, scale: 0.98 }}
                                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute bottom-0 left-[calc(100%+0.75rem)] hidden w-64 rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_20px_60px_rgba(0,0,0,0.58)] lg:block"
                                >
                                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">Switch account</div>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.055]"
                                    >
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/60 ring-1 ring-white/10">
                                            <Building2 className="size-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm text-white/85">{currentUserName}</div>
                                            <div className="truncate text-xs text-white/35">{formatPlan(currentPlan)}</div>
                                        </div>
                                        <Check className="size-4 text-green-positive" />
                                    </button>
                                    <div className="my-2 h-px bg-white/[0.08]" />
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.055]"
                                    >
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-primary/14 text-indigo-primary ring-1 ring-indigo-primary/25">
                                            <Plus className="size-4" />
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
    );
}

function formatPlan(plan: string) {
    return plan
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.055] text-white/55 ring-1 ring-white/10">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 truncate text-sm text-white/82">{label}</div>
        </button>
    );
}
