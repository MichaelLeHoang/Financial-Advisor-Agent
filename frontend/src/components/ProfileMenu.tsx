"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
    Building2,
    Check,
    ChevronRight,
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
import { cn } from "@/lib/utils";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export default function ProfileMenu({
    compact = false,
    onSettingsClick,
    onProfileClick,
}: {
    compact?: boolean;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
}) {
    const router = useRouter();
    const { user, error: authError, signIn, signUp, signOut } = useAuth();
    const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

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
        } finally {
            setAuthSubmitting(false);
        }
    };

    const openSettings = () => {
        setAccountSwitcherOpen(false);
        setSignInOpen(false);
        onSettingsClick?.();
    };

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (!open) {
                    setAccountSwitcherOpen(false);
                    setSignInOpen(false);
                }
            }}
        >
            <DropdownMenuTrigger
                ref={triggerRef}
                aria-label="Open profile menu"
                className={compact
                    ? "flex size-11 items-center justify-center rounded-full bg-transparent p-0 text-left transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    : "flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.065] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                }
            >
                <ProfileAvatar
                    avatarUrl={user?.avatar_url}
                    initial={initial}
                    size={compact ? "lg" : "default"}
                />
                {!compact && (
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white/85">{currentUserName}</div>
                        <div className="truncate text-xs text-white/35">{formatPlan(currentPlan)}</div>
                    </div>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent side="right" align="end" sideOffset={compact ? 8 : 14} className="bg-[var(--surface-popover-strong)] text-[var(--text-secondary)]">
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        closeOnClick={false}
                        onClick={() => setAccountSwitcherOpen((open) => !open)}
                        className="h-auto py-3"
                    >
                        <ProfileAvatar avatarUrl={user?.avatar_url} initial={initial} size="lg" />
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{currentUserName}</div>
                            <div className="truncate text-xs text-[var(--text-muted)]">Current plan: {formatPlan(currentPlan)}</div>
                        </div>
                        <ChevronRight className="size-4 text-[var(--text-subtle)]" />
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                {accountSwitcherOpen && (
                    <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.035] p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/35">Switch account</div>
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.055]"
                        >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/60 ring-1 ring-white/10">
                                <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-[var(--text-secondary)]">{currentUserName}</div>
                                <div className="truncate text-xs text-[var(--text-subtle)]">{formatPlan(currentPlan)}</div>
                            </div>
                            <Check className="size-4 text-green-positive" />
                        </button>
                        <div className="my-1 h-px bg-white/[0.08]" />
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.055]"
                        >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-primary/14 text-indigo-primary ring-1 ring-indigo-primary/25">
                                <Plus className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">Add account</div>
                        </button>
                    </div>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    {isGuest && (
                        <MenuItem
                            icon={LogIn}
                            label="Sign in"
                            onClick={() => router.push("/login")}
                        />
                    )}
                    <MenuItem icon={Sparkles} label={isGuest ? "Upgrade plan" : "Plans & billing"} onClick={() => router.push("/pricing")} />
                    {!isGuest && <MenuItem icon={User} label="Profile" onClick={() => { onProfileClick?.(); }} />}
                    <MenuItem icon={Shield} label="Security" />
                    <MenuItem icon={HelpCircle} label="Help center" />
                    <MenuItem icon={Settings} label="Settings" onClick={openSettings} />
                    {!isGuest && <MenuItem icon={LogOut} label="Sign out" onClick={signOut} />}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                {signInOpen && (
                    <form
                        onSubmit={submitAuth}
                        className="mb-2 flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] p-3"
                    >
                        <div className="flex rounded-lg bg-white/[0.035] p-1">
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
                            className="h-10 rounded-lg border-white/[0.06] bg-white/[0.035] text-sm"
                            required
                        />
                        <Input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Password"
                            className="h-10 rounded-lg border-white/[0.06] bg-white/[0.035] text-sm"
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
                    </form>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ProfileAvatar({
    avatarUrl,
    initial,
    size = "default",
}: {
    avatarUrl?: string | null;
    initial: string;
    size?: "default" | "lg";
}) {
    return (
        <Avatar
            size={size}
            className={cn(
                "bg-indigo-primary/14 text-indigo-primary after:border-indigo-primary/24 after:mix-blend-normal",
                size === "lg" && "size-10"
            )}
        >
            {avatarUrl && (
                <AvatarImage
                    src={avatarUrl}
                    alt=""
                    className="bg-[var(--surface-card)] object-contain p-0.5"
                />
            )}
            <AvatarFallback className="bg-indigo-primary/14 text-xs font-semibold text-indigo-primary">
                {initial}
            </AvatarFallback>
            <AvatarBadge className="bg-green-positive shadow-[0_0_8px_rgba(52,211,153,0.72)] ring-[var(--surface-sidebar)]" />
        </Avatar>
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
    closeOnClick = true,
}: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    closeOnClick?: boolean;
}) {
    return (
        <DropdownMenuItem
            onClick={onClick}
            closeOnClick={closeOnClick}
        >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.055] text-[var(--text-muted)] ring-1 ring-white/10">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 truncate text-sm text-[var(--text-secondary)]">{label}</div>
        </DropdownMenuItem>
    );
}
