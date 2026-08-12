"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BookOpen, BookOpenText, LogOut, Menu, Moon, Newspaper, Search, Sun, User, X } from "lucide-react";
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
import { Highlight, HighlightItem } from "@/components/ui/highlight";
import { getAvatarColor, getAvatarInitials } from "@/lib/avatar";
import SearchModal from "@/components/SearchModal";
import { loginHref } from "@/lib/workspace-routing";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const SETTINGS_STORAGE_KEY = "financial-advisor.settings";
const NAV_LINKS = [
  { href: "/#samples", label: "Samples" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
];

type IntroductionNavProps = {
  staticFull?: boolean;
  forceTheme?: "Deep Space" | "White";
};

export function IntroductionNav({ staticFull = false, forceTheme }: IntroductionNavProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const isSignedIn = Boolean(user && !user.is_guest);
  const showSignedOutActions = !loading && !isSignedIn;
  const displayName = user?.display_name || user?.email?.split("@")[0] || "Researcher";
  const initials = getAvatarInitials(user?.display_name, user?.email);
  const avatarColor = getAvatarColor(user?.id || user?.email);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"Deep Space" | "White">(forceTheme ?? "Deep Space");
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);
  const currentTheme = forceTheme ?? theme;
  const navExpanded = staticFull || isScrolled || mobileOpen;
  const platformActive = pathname.startsWith("/platform");
  const activeNavItem = platformActive ? "product" : activeSection;

  useEffect(() => {
    if (forceTheme) {
      setTheme(forceTheme);
      return;
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
      setTheme(stored.theme === "White" ? "White" : "Deep Space");
    } catch {
      setTheme("Deep Space");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    const samplesSection = window.document.getElementById("samples");
    const observer = samplesSection
      ? new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            setActiveSection(entry?.isIntersecting ? "samples" : null);
          },
          { threshold: 0.35 },
        )
      : null;

    handleScroll();
    if (samplesSection && observer) observer.observe(samplesSection);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, [forceTheme]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleOpenApp = () => {
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    router.push(isSignedIn ? "/home" : loginHref("/home"));
  };

  const toggleTheme = () => {
    if (forceTheme) return;

    const nextTheme = theme === "White" ? "Deep Space" : "White";
    let settings: Record<string, unknown> = {};

    try {
      settings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    } catch {
      settings = {};
    }

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...settings, theme: nextTheme })
    );
    document.body.dataset.theme = nextTheme;
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent("financial-advisor:theme-change", { detail: nextTheme }));
  };

  useEffect(() => {
    if (pathname.startsWith("/pricing")) {
      setActiveSection("pricing");
      return;
    }

    if (pathname.startsWith("/help")) {
      setActiveSection("help");
      return;
    }

    if (pathname === "/") {
      setActiveSection(null);
      return;
    }

    setActiveSection(null);
  }, [pathname]);

  return (
    <header className="introduction-nav fixed inset-x-0 top-0 z-50 px-4 py-3 sm:px-8 sm:py-4">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-[background-color,box-shadow,backdrop-filter] duration-200 sm:px-5 ${
          navExpanded
            ? currentTheme === "White"
              ? "bg-[#e9e6e0]/84 shadow-[0_10px_30px_rgba(18,26,44,0.10)] backdrop-blur-xl"
              : "bg-black/72 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl"
            : "bg-transparent shadow-none backdrop-blur-none"
        }`}
        style={
          {
            "--intro-nav-primary": navExpanded
              ? currentTheme === "White"
                ? "var(--text-primary)"
                : "rgba(255,255,255,0.92)"
              : "var(--text-primary)",
            "--intro-nav-muted": navExpanded
              ? currentTheme === "White"
                ? "var(--text-muted)"
                : "rgba(255,255,255,0.55)"
              : "var(--text-muted)",
            "--intro-nav-hover": navExpanded
              ? currentTheme === "White"
                ? "rgba(18,26,44,0.05)"
                : "rgba(255,255,255,0.08)"
              : "var(--surface-card-hover)",
            "--intro-nav-action-bg": currentTheme === "White"
              ? "#4f46e5"
              : navExpanded
                ? "rgba(255,255,255,0.96)"
                : "rgba(255,255,255,0.96)",
            "--intro-nav-action-text": currentTheme === "White"
              ? "rgb(255,255,255)"
              : navExpanded
                ? "rgb(0,0,0)"
                : "rgb(0,0,0)",
          } as CSSProperties
        }
      >
        <motion.div animate={{ x: navExpanded ? -2 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
          <Link
            href="/"
            aria-label="Quanfora home"
            className="flex shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="size-8 object-contain" />
            <span className="hidden text-sm font-semibold text-[var(--intro-nav-primary)] sm:block">
              Quanfora
            </span>
          </Link>
        </motion.div>

        <nav className="hidden items-center lg:flex" aria-label="Primary navigation">
          <Highlight
            controlledItems
            mode="parent"
            value={hoveredNavItem ?? activeNavItem}
            onValueChange={setHoveredNavItem}
            hover
            click={false}
            exitDelay={0.08}
            className="rounded-full bg-[var(--intro-nav-hover)] ring-1 ring-white/[0.035]"
            containerClassName="isolate"
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
          >
            <NavigationMenu viewport={false} className="relative z-[1]">
              <NavigationMenuList className="gap-2">
                <NavigationMenuItem>
                  <HighlightItem asChild value="product" activeClassName="text-[var(--intro-nav-primary)]">
                    <NavigationMenuTrigger className={`hover:bg-transparent hover:text-[var(--intro-nav-primary)] focus:bg-transparent focus:text-[var(--intro-nav-primary)] data-[state=open]:bg-transparent data-[state=open]:text-[var(--intro-nav-primary)] ${platformActive ? "text-[var(--intro-nav-primary)]" : "text-[var(--intro-nav-muted)]"}`}>
                      Product
                    </NavigationMenuTrigger>
                  </HighlightItem>
                  <NavigationMenuContent>
                    <ul className="grid w-[280px] gap-1 p-2">
                      <ProductLink href="/platform" title="Platform overview" detail="One portfolio, risk system, and AI layer" current={platformActive} />
                      <ProductLink href={isSignedIn ? "/invest" : loginHref("/invest")} title="Investment OS" detail="Theses, allocation, policy, and review" />
                      <ProductLink href={isSignedIn ? "/trade" : loginHref("/trade")} title="Trading OS" detail="Plans, sizing, paper execution, and journal" />
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                {NAV_LINKS.slice(0, 2).map((item) => (
                  <NavigationMenuItem key={item.href}>
                    <LandingNavItem item={item} activeSection={activeSection} />
                  </NavigationMenuItem>
                ))}
                <NavigationMenuItem>
                  <HighlightItem asChild value="resources" activeClassName="text-[var(--intro-nav-primary)]">
                    <NavigationMenuTrigger className="text-[var(--intro-nav-muted)] hover:bg-transparent hover:text-[var(--intro-nav-primary)] focus:bg-transparent focus:text-[var(--intro-nav-primary)] data-[state=open]:bg-transparent data-[state=open]:text-[var(--intro-nav-primary)]">
                      Resources
                    </NavigationMenuTrigger>
                  </HighlightItem>
                  <NavigationMenuContent>
                    <ul className="grid w-[220px] gap-1 p-2">
                      {isSignedIn && (
                        <li>
                          <NavigationMenuLink asChild>
                            <Link href="/discover/news" className="intro-resource-link flex flex-row items-center gap-3 rounded-xl p-3 transition-colors">
                              <div className="intro-resource-icon flex size-8 items-center justify-center rounded-md bg-white/5 text-white/70 transition-colors">
                                <Newspaper className="size-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="intro-resource-title text-sm font-medium text-white/90 transition-colors">News</span>
                                <span className="intro-resource-subtitle text-xs text-white/40 transition-colors">Market insights</span>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      )}
                      <li>
                        <NavigationMenuLink asChild>
                          <Link href="/docs" className="intro-resource-link flex flex-row items-center gap-3 rounded-xl p-3 transition-colors">
                            <div className="intro-resource-icon flex size-8 items-center justify-center rounded-md bg-white/5 text-white/70 transition-colors">
                              <BookOpenText className="size-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="intro-resource-title text-sm font-medium text-white/90 transition-colors">Docs</span>
                              <span className="intro-resource-subtitle text-xs text-white/40 transition-colors">Product guide</span>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <Link href="/blog" className="intro-resource-link flex flex-row items-center gap-3 rounded-xl p-3 transition-colors">
                            <div className="intro-resource-icon flex size-8 items-center justify-center rounded-md bg-white/5 text-white/70 transition-colors">
                              <BookOpen className="size-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="intro-resource-title text-sm font-medium text-white/90 transition-colors">Blog</span>
                              <span className="intro-resource-subtitle text-xs text-white/40 transition-colors">Our articles</span>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                {NAV_LINKS.slice(2).map((item) => (
                  <NavigationMenuItem key={item.href}>
                    <LandingNavItem item={item} activeSection={activeSection} />
                  </NavigationMenuItem>
                ))}
                {isSignedIn && (
                  <NavigationMenuItem>
                    <HighlightItem asChild value="contact" activeClassName="text-[var(--intro-nav-primary)]">
                      <NavigationMenuLink
                        asChild
                        className={`${navigationMenuTriggerStyle()} text-[var(--intro-nav-muted)] hover:bg-transparent hover:text-[var(--intro-nav-primary)] focus:bg-transparent focus:text-[var(--intro-nav-primary)] data-[active=true]:bg-transparent`}
                      >
                        <Link href="/contact-sales">Contact</Link>
                      </NavigationMenuLink>
                    </HighlightItem>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>
          </Highlight>
        </nav>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            aria-label="Search (⌘K)"
            onClick={() => setSearchOpen(true)}
            initial={false}
            animate={navExpanded ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="flex size-9 items-center justify-center rounded-full text-[var(--intro-nav-muted)] transition-colors hover:bg-[var(--intro-nav-hover)] hover:text-[var(--intro-nav-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
          >
            <Search className="size-4" />
          </motion.button>
          {!forceTheme && (
            <button
              type="button"
              aria-label={currentTheme === "White" ? "Switch to dark theme" : "Switch to light theme"}
              aria-pressed={currentTheme === "White"}
              onClick={toggleTheme}
              className="flex size-9 items-center justify-center rounded-full text-[var(--intro-nav-muted)] transition-colors hover:bg-[var(--intro-nav-hover)] hover:text-[var(--intro-nav-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
            >
              {currentTheme === "White" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          )}
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
                <DropdownMenuContent side="bottom" align="end" sideOffset={10} className="w-64">
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
                className="on-accent hidden h-9 items-center rounded-lg bg-indigo-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 sm:inline-flex"
              >
                Open App
              </button>
            </>
          ) : showSignedOutActions ? (
            <>
              <motion.div
                initial={false}
                animate={navExpanded ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="hidden sm:block"
              >
                <Link
                  href="/contact-sales"
                  className="flex h-9 items-center rounded-full border border-white/[0.14] px-4 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Contact Sales
                </Link>
              </motion.div>
              <motion.div
                initial={false}
                animate={navExpanded ? { opacity: 1, x: 0 } : { opacity: 0, x: 12 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="hidden sm:block"
              >
                <Link
                  href={loginHref("/home")}
                  className="flex h-9 items-center rounded-full bg-[var(--intro-nav-action-bg)] px-4 text-sm font-semibold text-[var(--intro-nav-action-text)] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
                >
                  Sign in
                </Link>
              </motion.div>
            </>
          ) : null}
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="flex size-9 items-center justify-center rounded-full text-[var(--intro-nav-muted)] transition-colors hover:bg-[var(--intro-nav-hover)] hover:text-[var(--intro-nav-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 lg:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className={`mx-auto mt-2 max-w-6xl rounded-2xl p-3 backdrop-blur-xl lg:hidden ${
            currentTheme === "White"
              ? "bg-[#f1efeb]/95 text-[#121a2c] shadow-[0_12px_36px_rgba(18,26,44,0.12)]"
              : "on-accent bg-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          }`}
        >
          <nav className="grid gap-1" aria-label="Mobile navigation">
            <div className={`mb-2 border-b pb-2 ${currentTheme === "White" ? "border-black/[0.08]" : "border-white/[0.08]"}`}>
              <div className={`px-3 pb-1 text-[11px] font-semibold uppercase ${currentTheme === "White" ? "text-[#98a2b3]" : "text-white/40"}`}>Product</div>
              <MobileProductLink href="/platform" label="Platform overview" onClick={() => setMobileOpen(false)} current={platformActive} />
              <MobileProductLink href={isSignedIn ? "/invest" : loginHref("/invest")} label="Investment OS" onClick={() => setMobileOpen(false)} />
              <MobileProductLink href={isSignedIn ? "/trade" : loginHref("/trade")} label="Trading OS" onClick={() => setMobileOpen(false)} />
            </div>
            {NAV_LINKS.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  currentTheme === "White"
                    ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className={`my-2 border-t pt-2 ${currentTheme === "White" ? "border-black/[0.08]" : "border-white/[0.08]"}`}>
              <div className={`px-3 pb-1 text-[11px] font-semibold uppercase ${currentTheme === "White" ? "text-[#98a2b3]" : "text-white/40"}`}>
                Resources
              </div>
              {isSignedIn && (
                <Link
                  href="/discover/news"
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    currentTheme === "White"
                      ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                      : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  News
                </Link>
              )}
              <Link
                href="/docs"
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  currentTheme === "White"
                    ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Docs
              </Link>
              <Link
                href="/blog"
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  currentTheme === "White"
                    ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Blog
              </Link>
            </div>
            {NAV_LINKS.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  currentTheme === "White"
                    ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isSignedIn && (
              <Link
                href="/contact-sales"
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  currentTheme === "White"
                    ? "text-[#667085] hover:bg-black/[0.04] hover:text-[#121a2c]"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Contact
              </Link>
            )}
            {isSignedIn ? (
              <button
                type="button"
                onClick={handleOpenApp}
                className="on-accent mt-3 h-10 rounded-full bg-indigo-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Open App
              </button>
            ) : showSignedOutActions ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href="/contact-sales"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.14] px-4 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Contact Sales
                </Link>
                <Link
                  href={loginHref("/home")}
                  onClick={() => setMobileOpen(false)}
                  className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 ${
                    currentTheme === "White"
                      ? "bg-[#4f46e5] text-white focus-visible:ring-[#4f46e5]"
                      : "bg-white text-black focus-visible:ring-white"
                  }`}
                >
                  Sign in
                </Link>
              </div>
            ) : null}
          </nav>
        </div>
      )}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

function ProductLink({ href, title, detail, current = false }: { href: string; title: string; detail: string; current?: boolean }) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link href={href} aria-current={current ? "page" : undefined} className={`intro-resource-link block rounded-xl p-3 transition-colors ${current ? "bg-white/[0.055]" : ""}`}>
          <span className="intro-resource-title block text-sm font-medium text-white/90">{title}</span>
          <span className="intro-resource-subtitle mt-1 block text-xs leading-5 text-white/40">{detail}</span>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

function MobileProductLink({ href, label, onClick, current = false }: { href: string; label: string; onClick: () => void; current?: boolean }) {
  return <Link href={href} onClick={onClick} aria-current={current ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--intro-nav-hover)] hover:text-[var(--intro-nav-primary)] ${current ? "bg-[var(--intro-nav-hover)] text-[var(--intro-nav-primary)]" : "text-[var(--intro-nav-muted)]"}`}>{label}</Link>;
}

function LandingNavItem({
  item,
  activeSection,
}: {
  item: (typeof NAV_LINKS)[number];
  activeSection: string | null;
}) {
  const isActive =
    (item.href === "/#samples" && activeSection === "samples")
    || (item.href === "/pricing" && activeSection === "pricing")
    || (item.href === "/help" && activeSection === "help");

  return (
    <HighlightItem asChild value={item.label.toLowerCase()} activeClassName="text-[var(--intro-nav-primary)]">
      <NavigationMenuLink
        asChild
        className={`${navigationMenuTriggerStyle()} relative z-10 rounded-full bg-transparent text-[var(--intro-nav-muted)] hover:bg-transparent hover:text-[var(--intro-nav-primary)] focus:bg-transparent focus:text-[var(--intro-nav-primary)] data-[active=true]:bg-transparent`}
      >
        <Link href={item.href} aria-current={isActive ? "page" : undefined}>{item.label}</Link>
      </NavigationMenuLink>
    </HighlightItem>
  );
}

export function IntroductionFooter() {
  return (
    <footer className="introduction-footer relative z-10 border-t border-white/[0.06] px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="size-8 object-contain" />
            <div className="text-sm font-semibold text-indigo-primary">Quanfora</div>
          </div>
          <div>
            <p className="mt-3 max-w-md text-xs leading-5 text-white/25">
              AI-generated analysis only. Not professional financial advice. © 2026 Michael Le.
            </p>
          </div>
        </div>
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35">Support</h2>
            <div className="mt-3 grid gap-2 text-white/36">
              <Link href="/help" className="footer-link transition-colors hover:text-white/70">Help center</Link>
              <Link href="/pricing" className="footer-link transition-colors hover:text-white/70">Pricing</Link>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/35">Terms & Policies</h2>
            <div className="mt-3 grid gap-2 text-white/36">
              <Link href="/terms" className="footer-link transition-colors hover:text-white/70">Terms of Service</Link>
              <Link href="/privacy" className="footer-link transition-colors hover:text-white/70">Privacy Policy</Link>
              <Link href="/help#other-policies" className="footer-link transition-colors hover:text-white/70">Other Policies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
