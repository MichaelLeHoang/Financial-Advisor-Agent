"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import Sidebar from "@/components/Sidebar";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { OnboardingProvider, useOnboarding } from "@/components/onboarding/OnboardingProvider";
import PublicAccessGate from "@/components/auth/PublicAccessGate";
import { ModelProvider } from "@/components/ModelSelector";
import Toaster from "@/components/ui/toast";
import { WorkspacePrototypeProvider } from "@/components/workspace/WorkspacePrototypeProvider";
import { StrategyStudioProvider } from "@/components/strategy-studio/StrategyStudioProvider";
import { PortfolioBooksProvider } from "@/components/portfolio/PortfolioBooksProvider";
import { PortfolioBookViewProvider } from "@/components/portfolio/PortfolioBookViewProvider";
import { InvestmentPolicyProvider } from "@/components/investment-policy/InvestmentPolicyProvider";
import { normalizeAppPath, onboardingHref } from "@/lib/workspace-routing";
import {
  resolveAppAppearance,
  resolveAppTheme,
  SETTINGS_STORAGE_KEY,
  type AppAppearancePreference,
} from "@/lib/app-theme";
import { isEditableShortcutTarget, keyboardShortcutsEnabled } from "@/lib/keyboard-shortcuts";
import { WorkspaceLoadingShell } from "@/components/ui/DataLoading";

const SettingsModal = dynamic(() => import("@/components/SettingsModal"), { ssr: false });
const EditProfileModal = dynamic(() => import("@/components/EditProfileModal"), { ssr: false });
const AlertsModal = dynamic(() => import("@/components/AlertsModal"), { ssr: false });
const ShortcutsDialog = dynamic(() => import("@/components/ShortcutsDialog"), { ssr: false });

const COVER_SEEN_STORAGE_KEY = "financial-advisor.coverSeen";
const STANDALONE_PUBLIC_PATHS = [
  "/",
  "/help",
  "/login",
  "/onboarding",
  "/contact-sales",
  "/platform",
  "/news",
  "/blog",
  "/pricing",
  "/docs",
  "/terms",
  "/privacy",
  "/research",
  "/r/",
];

function isStandalonePublicPath(pathname: string) {
  return STANDALONE_PUBLIC_PATHS.some((path) => {
    if (path === "/") return pathname === "/";
    if (path.endsWith("/")) return pathname.startsWith(path);
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isStandalonePage = isStandalonePublicPath(pathname);

  const [entryChecked, setEntryChecked] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [settings, setSettings] = useState<{
    model: string;
    theme: string;
    appearance: AppAppearancePreference;
    risk: string;
    quantum: string;
  }>({
    model: "Gemini 3 Flash",
    theme: "Deep Space",
    appearance: "Solid",
    risk: "moderate",
    quantum: "IonQ Forte (11 Qubits)",
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      setSettings((current) => ({
        ...current,
        ...parsed,
        appearance: resolveAppAppearance(parsed.appearance),
      }));
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const handleAppearanceChange = (event: Event) => {
      const nextAppearance = resolveAppAppearance((event as CustomEvent<unknown>).detail);
      setSettings((current) => {
        const next = { ...current, appearance: nextAppearance };
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener("financial-advisor:appearance-change", handleAppearanceChange);
    return () => window.removeEventListener("financial-advisor:appearance-change", handleAppearanceChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemPrefersDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<string>).detail;
      if (!nextTheme) return;
      setSettings((current) => {
        const next = { ...current, theme: nextTheme };
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    window.addEventListener("financial-advisor:theme-change", handleThemeChange);
    return () => window.removeEventListener("financial-advisor:theme-change", handleThemeChange);
  }, []);

  useEffect(() => {
    const openShortcuts = () => setIsShortcutsOpen(true);
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey || isEditableShortcutTarget(event.target) || !keyboardShortcutsEnabled()) return;
      event.preventDefault();
      setIsShortcutsOpen(true);
    };
    window.addEventListener("financial-advisor:shortcuts-open", openShortcuts);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("financial-advisor:shortcuts-open", openShortcuts);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (isStandalonePage) {
      setEntryChecked(true);
      return;
    }

    const hasSeenCover = window.localStorage.getItem(COVER_SEEN_STORAGE_KEY) === "true";
    if (!hasSeenCover) {
      router.replace("/");
      return;
    }

    setEntryChecked(true);
  }, [isStandalonePage, router]);

  const updateSettings = (next: typeof settings) => {
    setSettings(next);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  };
  const resolvedTheme = resolveAppTheme(settings.theme, systemPrefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme !== "White");
    document.body.dataset.theme = resolvedTheme;
    document.body.dataset.appearance = settings.appearance;
  }, [resolvedTheme, settings.appearance]);

  if (isStandalonePage) {
    return (
      <MotionConfig reducedMotion="user">
            <AuthProvider>
              <OnboardingProvider>
                <PortfolioBookViewProvider>
                  <PortfolioBooksProvider>
                  <InvestmentPolicyProvider>
                    <WorkspacePrototypeProvider>
                  <StrategyStudioProvider>
                    <ModelProvider>
                      <div id="main-content" tabIndex={-1} className="contents">{children}</div>
                      <Toaster />
                    </ModelProvider>
                  </StrategyStudioProvider>
                    </WorkspacePrototypeProvider>
                  </InvestmentPolicyProvider>
                  </PortfolioBooksProvider>
                </PortfolioBookViewProvider>
              </OnboardingProvider>
            </AuthProvider>
      </MotionConfig>
    );
  }

  if (!entryChecked) {
    return <div className="flex h-screen overflow-hidden relative" />;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <OnboardingProvider>
              <PortfolioBookViewProvider>
                <PortfolioBooksProvider>
                <InvestmentPolicyProvider>
                  <WorkspacePrototypeProvider>
                <StrategyStudioProvider>
                  <ModelProvider>
                <MainWorkspace
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                  onSettingsClick={() => setIsSettingsOpen(true)}
                  onProfileClick={() => setIsProfileOpen(true)}
                  onAlertsClick={() => setIsAlertsOpen((open) => !open)}
                >
                  {children}
                </MainWorkspace>

                {isSettingsOpen && (
                  <SettingsModal
                    isOpen={true}
                    onClose={() => setIsSettingsOpen(false)}
                    settings={settings}
                    setSettings={updateSettings}
                  />
                )}
                {isProfileOpen && (
                  <EditProfileModal isOpen={true} onClose={() => setIsProfileOpen(false)} />
                )}
                {isAlertsOpen && (
                  <AlertsModal
                    isOpen={true}
                    onClose={() => setIsAlertsOpen(false)}
                    sidebarOpen={isSidebarOpen}
                  />
                )}
                {isShortcutsOpen && (
                  <ShortcutsDialog isOpen={true} onClose={() => setIsShortcutsOpen(false)} />
                )}
                <Toaster />
                  </ModelProvider>
                </StrategyStudioProvider>
                  </WorkspacePrototypeProvider>
                </InvestmentPolicyProvider>
                </PortfolioBooksProvider>
              </PortfolioBookViewProvider>
            </OnboardingProvider>
          </AuthProvider>
        </MotionConfig>
    </div>
  );
}

function MainWorkspace({
  children,
  isSidebarOpen,
  onToggleSidebar,
  onSettingsClick,
  onProfileClick,
  onAlertsClick,
}: {
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSettingsClick: () => void;
  onProfileClick: () => void;
  onAlertsClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { preferences, loading: onboardingLoading } = useOnboarding();
  const isPublicAppPath = pathname.startsWith("/ai") || pathname.startsWith("/discover/markets") || isStandalonePublicPath(pathname);
  const shouldGate = !loading && Boolean(user.is_guest) && !isPublicAppPath;
  const shouldOnboard = !loading
    && !onboardingLoading
    && !user.is_guest
    && preferences?.status === "pending"
    && !isPublicAppPath;
  const sidebarOffset = isSidebarOpen ? "19rem" : "5rem";

  useEffect(() => {
    if (!shouldOnboard) return;
    const requestedPath = normalizeAppPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    router.replace(onboardingHref(requestedPath));
  }, [router, shouldOnboard]);

  return (
    <>
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={onToggleSidebar}
        onSettingsClick={onSettingsClick}
        onProfileClick={onProfileClick}
        onAlertsClick={onAlertsClick}
      />

      <main
        id="main-content"
        tabIndex={-1}
        data-sidebar-expanded={isSidebarOpen}
        style={{ "--workspace-sidebar-offset": sidebarOffset } as CSSProperties}
        className={`workspace-appearance-canvas relative z-10 flex flex-1 flex-col overflow-hidden ${isSidebarOpen ? "md:ml-[19rem]" : "md:ml-20"}`}
      >
        <div className="flex-1 overflow-y-auto">
          {(loading || onboardingLoading || shouldOnboard) && !isPublicAppPath ? (
            <WorkspaceLoadingShell label={shouldOnboard ? "Opening workspace setup" : "Restoring your workspace"} />
          ) : shouldGate ? <PublicAccessGate /> : children}
        </div>
      </main>
    </>
  );
}
