"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
    Bell,
    Building2,
    Check,
    ChevronRight,
    Flame,
    HelpCircle,
    Keyboard,
    Languages,
    LogIn,
    LogOut,
    Monitor,
    Moon,
    Palette,
    Plus,
    Settings,
    Sparkles,
    Sun,
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
    DropdownMenuSubmenu,
    DropdownMenuSubmenuContent,
    DropdownMenuSubmenuTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getAvatarColor, getAvatarInitials } from "@/lib/avatar";
import { persistThemePreference, readThemePreference, type AppThemePreference } from "@/lib/app-theme";

const PROFILE_THEME_OPTIONS: Array<{ name: AppThemePreference; label: string; icon: ComponentType<{ className?: string }> }> = [
    { name: "White", label: "Light", icon: Sun },
    { name: "Deep Space", label: "Dark", icon: Moon },
    { name: "Crimson", label: "Red", icon: Flame },
    { name: "System", label: "System", icon: Monitor },
];

export default function ProfileMenu({
    compact = false,
    onSettingsClick,
    onProfileClick,
    onAlertsClick,
}: {
    compact?: boolean;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    onAlertsClick?: () => void;
}) {
    const router = useRouter();
    const { user, loading, error: authError, signIn, signUp, signOut } = useAuth();
    const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [policyAccepted, setPolicyAccepted] = useState(false);
    const [authFormError, setAuthFormError] = useState<string | null>(null);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [themePreference, setThemePreference] = useState<AppThemePreference>("Deep Space");
    const triggerRef = useRef<HTMLButtonElement>(null);

    const currentUserName = loading ? "Loading account..." : user?.display_name || user?.email?.split("@")[0] || "Researcher";
    const currentPlan = user?.plan ?? "free";
    const initial = loading ? "" : getAvatarInitials(user?.display_name, user?.email);
    const avatarColor = getAvatarColor(user?.id || user?.email);
    const isGuest = !loading && (user?.is_guest ?? false);

    const submitAuth = async (event: FormEvent) => {
        event.preventDefault();
        setAuthFormError(null);
        if (authMode === "signup" && !policyAccepted) {
            setAuthFormError("Please agree to the Terms of Service and Privacy Policy to create an account.");
            return;
        }
        setAuthSubmitting(true);
        try {
            if (authMode === "signin") {
                await signIn(email, password);
            } else {
                window.sessionStorage.setItem("quanfora.onboarding.intent", "signup");
                await signUp(email, password, "/home");
                window.localStorage.setItem("financial-advisor.coverSeen", "true");
                router.push("/onboarding?next=/home");
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

    const openHelpCenter = () => {
        setAccountSwitcherOpen(false);
        setSignInOpen(false);
        router.push("/help");
    };

    const openAlerts = () => {
        setAccountSwitcherOpen(false);
        setSignInOpen(false);
        onAlertsClick?.();
    };

    const openShortcuts = () => {
        window.dispatchEvent(new Event("financial-advisor:shortcuts-open"));
    };

    const chooseTheme = (theme: AppThemePreference) => {
        setThemePreference(theme);
        persistThemePreference(theme);
    };

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (open) setThemePreference(readThemePreference());
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
                    ? "flex h-10 w-10 items-center justify-center rounded-xl bg-transparent p-0 text-left transition-colors hover:bg-[var(--surface-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                    : "flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] py-2 pl-1 pr-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-white/[0.065] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                }
            >
                <ProfileAvatar
                    avatarUrl={user?.avatar_url}
                    initial={initial}
                    placeholderColor={avatarColor}
                    size="default"
                />
                {!compact && (
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white/85">{currentUserName}</div>
                        <div className="truncate text-xs text-white/35">{formatPlan(currentPlan)}</div>
                    </div>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent side="right" align="end" sideOffset={compact ? 8 : 14} className="w-64 bg-[var(--surface-popover-strong)] p-2 text-[var(--text-secondary)]">
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        closeOnClick={false}
                        onClick={() => setAccountSwitcherOpen((open) => !open)}
                        className="h-auto gap-2.5 px-2 py-2"
                    >
                        <ProfileAvatar
                            avatarUrl={user?.avatar_url}
                            initial={initial}
                            placeholderColor={avatarColor}
                            size="default"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{currentUserName}</div>
                            <div className="truncate text-[11px] text-[var(--text-muted)]">Current plan: {formatPlan(currentPlan)}</div>
                        </div>
                        <ChevronRight className="size-4 text-[var(--text-subtle)]" />
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                {accountSwitcherOpen && (
                    <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.035] p-2">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/35">Switch account</div>
                        <button
                            type="button"
                            className="theme-menu-item flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.055]"
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
                            className="theme-menu-item flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.055]"
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
                    {!isGuest && <MenuItem icon={Sparkles} label="Workspace setup" onClick={() => router.push("/onboarding?next=/home")} />}
                    <MenuItem icon={Bell} label="Alerts" onClick={openAlerts} />
                    <MenuItem icon={HelpCircle} label="Help center" onClick={openHelpCenter} />
                    <DropdownMenuSubmenu>
                        <DropdownMenuSubmenuTrigger openOnHover>
                            <Palette className="size-4 shrink-0 text-[var(--text-muted)]" />
                            <span className="min-w-0 flex-1 truncate">Appearance</span>
                            <ChevronRight className="size-4 text-[var(--text-subtle)]" />
                        </DropdownMenuSubmenuTrigger>
                        <DropdownMenuSubmenuContent aria-label="Appearance">
                            {PROFILE_THEME_OPTIONS.map((theme) => {
                                const Icon = theme.icon;
                                const selected = themePreference === theme.name;
                                return (
                                    <DropdownMenuItem key={theme.name} closeOnClick={false} onClick={() => chooseTheme(theme.name)} className="h-10 gap-2.5 px-2">
                                        <Icon className="size-4 shrink-0 text-[var(--text-muted)]" />
                                        <span className="flex-1">{theme.label}</span>
                                        <span className={cn("flex size-5 items-center justify-center rounded-full border-2 border-[var(--theme-border-strong)]", selected && "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--surface-popover-strong)]")}>
                                            {selected && <Check className="size-3" strokeWidth={3} />}
                                        </span>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuSubmenuContent>
                    </DropdownMenuSubmenu>
                    <DropdownMenuSubmenu>
                        <DropdownMenuSubmenuTrigger openOnHover>
                            <Languages className="size-4 shrink-0 text-[var(--text-muted)]" />
                            <span className="min-w-0 flex-1 truncate">Language</span>
                            <ChevronRight className="size-4 text-[var(--text-subtle)]" />
                        </DropdownMenuSubmenuTrigger>
                        <DropdownMenuSubmenuContent aria-label="Language" className="w-52">
                            <DropdownMenuItem closeOnClick={false} className="h-10 gap-2.5 px-2">
                                <span className="flex-1">English (US)</span>
                                <Check className="size-4" />
                            </DropdownMenuItem>
                            <p className="px-2 pb-1 pt-2 text-[11px] text-[var(--text-subtle)]">More languages will appear here as localization is added.</p>
                        </DropdownMenuSubmenuContent>
                    </DropdownMenuSubmenu>
                    <MenuItem icon={Keyboard} label="Shortcuts" onClick={openShortcuts} />
                    <MenuItem icon={Settings} label="Settings" onClick={openSettings} />
                    {!isGuest && <DropdownMenuSeparator className="my-1.5" />}
                    {!isGuest && <MenuItem icon={LogOut} label="Sign out" onClick={signOut} />}
                </DropdownMenuGroup>

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
                        {authMode === "signup" && (
                            <label className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] p-2">
                                <input
                                    type="checkbox"
                                    checked={policyAccepted}
                                    onChange={(event) => setPolicyAccepted(event.target.checked)}
                                    className="mt-1 size-3.5 rounded border-white/15 bg-white/5 accent-indigo-primary"
                                />
                                <span className="text-[11px] leading-4 text-white/45">
                                    I agree to the{" "}
                                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-300 hover:text-white">Terms</a>
                                    {" "}and{" "}
                                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-300 hover:text-white">Privacy Policy</a>.
                                </span>
                            </label>
                        )}
                        {(authFormError || authError) && <p className="text-xs text-red-negative">{authFormError || authError}</p>}
                        <Button
                            type="submit"
                            disabled={authSubmitting || (authMode === "signup" && !policyAccepted)}
                            className="theme-solid-action h-10 w-full rounded-lg text-sm font-semibold"
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
    placeholderColor,
    size = "default",
}: {
    avatarUrl?: string | null;
    initial: string;
    placeholderColor: string;
    size?: "default" | "lg";
}) {
    return (
        <Avatar
            size={size}
            className={cn(
                "text-white after:border-white/20 after:mix-blend-normal",
                size === "lg" && "size-10"
            )}
            style={{ backgroundColor: placeholderColor }}
        >
            {avatarUrl && (
                <AvatarImage
                    src={avatarUrl}
                    alt=""
                    className="object-cover"
                />
            )}
            <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: placeholderColor }}
            >
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
            className="h-9 gap-2.5 px-2"
        >
            <div className="flex size-5 shrink-0 items-center justify-center text-[var(--text-muted)]">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 truncate text-sm text-[var(--text-secondary)]">{label}</div>
        </DropdownMenuItem>
    );
}
