"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BookOpen, HelpCircle, LogOut, Newspaper, Search, User, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvatarColor, getAvatarInitials } from "@/lib/avatar";
import SearchModal from "@/components/SearchModal";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export function IntroductionNav() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const isSignedIn = !loading && !user?.is_guest;
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Researcher";
  const initials = getAvatarInitials(user?.display_name, user?.email);
  const avatarColor = getAvatarColor(user?.id || user?.email);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/introduction");
  };

  const handleOpenApp = () => {
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    router.push("/");
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="fixed left-0 right-0 top-0 z-50 px-6 py-4 sm:px-10"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-2.5 backdrop-blur-xl">
        <Link href="/introduction" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_6px_16px_rgba(99,102,241,0.25)]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white/80">Quantum Advisor</span>
        </Link>
        <div className="hidden items-center lg:flex">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/introduction#features">Home</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/introduction#samples">Samples</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/introduction#pricing">Pricing</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent text-white/40 hover:text-white data-[state=open]:text-white">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[220px] gap-1 p-2">
                    {isSignedIn && (
                      <li>
                        <NavigationMenuLink asChild>
                          <Link href="/news" className="flex flex-row items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
                              <Newspaper className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white/90">News</span>
                              <span className="text-xs text-white/40">Market insights</span>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    )}
                    <li>
                      <NavigationMenuLink asChild>
                        <Link href="/blog" className="flex flex-row items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-white/70">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white/90">Blog</span>
                            <span className="text-xs text-white/40">Our articles</span>
                          </div>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/docs">Doc</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/introduction/help">Help</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search (⌘K)"
            onClick={() => setSearchOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
          >
            <Search className="size-4" />
          </button>
          {isSignedIn ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Open account menu"
                  className="flex size-9 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                >
                  <Avatar className="size-9 text-white after:border-white/20 after:mix-blend-normal" style={{ backgroundColor: avatarColor }}>
                    {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" className="object-cover" />}
                    <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: avatarColor }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="center" sideOffset={10} className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuItem closeOnClick={false} className="h-auto cursor-default py-3">
                      <User className="h-4 w-4 text-white/48" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/90">{displayName}</div>
                        <div className="truncate text-xs text-white/42">{user?.email}</div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 text-white/48" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={handleOpenApp}
                className="inline-flex h-9 items-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_4px_12px_rgba(99,102,241,0.25)] transition-all hover:bg-indigo-400"
              >
                Open App
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block">Log in</Link>
              <button
                type="button"
                onClick={handleOpenApp}
                className="inline-flex h-9 items-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_4px_12px_rgba(99,102,241,0.25)] transition-all hover:bg-indigo-400"
              >
                Open App
              </button>
            </>
          )}
        </div>
      </div>
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </motion.nav>
  );
}

export function IntroductionFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_1fr]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm text-white/50">Quantum Financial Advisor</div>
            <p className="mt-1 max-w-md text-xs leading-5 text-white/25">
              AI-generated analysis only. Not professional financial advice. © 2026 Michael Le.
            </p>
          </div>
        </div>
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35">Support</h2>
            <div className="mt-3 grid gap-2 text-white/36">
              <Link href="/introduction/help" className="transition-colors hover:text-white/70">Help center</Link>
              <Link href="/pricing" className="transition-colors hover:text-white/70">Pricing</Link>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35">Terms & Policies</h2>
            <div className="mt-3 grid gap-2 text-white/36">
              <Link href="/introduction/help#terms-of-use" className="transition-colors hover:text-white/70">Terms of Use</Link>
              <Link href="/introduction/help#privacy-policy" className="transition-colors hover:text-white/70">Privacy Policy</Link>
              <Link href="/introduction/help#other-policies" className="transition-colors hover:text-white/70">Other Policies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
