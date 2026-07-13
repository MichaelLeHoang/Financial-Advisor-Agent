"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Geist, Hanken_Grotesk, Inter } from "next/font/google";
import { MotionConfig } from "motion/react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import EditProfileModal from "@/components/EditProfileModal";
import AlertsModal from "@/components/AlertsModal";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import PublicAccessGate from "@/components/auth/PublicAccessGate";
import { ModelProvider } from "@/components/ModelSelector";
import Toaster from "@/components/ui/toast";
import { WorkspacePrototypeProvider } from "@/components/workspace/WorkspacePrototypeProvider";
import { StrategyStudioProvider } from "@/components/strategy-studio/StrategyStudioProvider";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const rootFontClasses = `${geist.variable} ${hankenGrotesk.variable} ${inter.variable}`;

const SETTINGS_STORAGE_KEY = "financial-advisor.settings";
const COVER_SEEN_STORAGE_KEY = "financial-advisor.coverSeen";
const STANDALONE_PUBLIC_PATHS = [
  "/",
  "/help",
  "/login",
  "/onboarding",
  "/contact-sales",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isStandalonePage = isStandalonePublicPath(pathname);

  const [entryChecked, setEntryChecked] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [settings, setSettings] = useState({
    model: "Gemini 3 Flash",
    theme: "Deep Space",
    risk: "moderate",
    quantum: "IonQ Forte (11 Qubits)",
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      setSettings((current) => ({ ...current, ...parsed }));
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<string>).detail;
      if (!nextTheme) return;
      setSettings((current) => ({ ...current, theme: nextTheme }));
    };

    window.addEventListener("financial-advisor:theme-change", handleThemeChange);
    return () => window.removeEventListener("financial-advisor:theme-change", handleThemeChange);
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

  if (isStandalonePage) {
    return (
      <html lang="en" className={`${rootFontClasses} dark`}>
      <body data-theme={settings.theme} className="bg-space-black text-white font-sans antialiased overflow-x-hidden">
          <MotionConfig reducedMotion="user">
            <AuthProvider>
              <WorkspacePrototypeProvider>
                <StrategyStudioProvider>
                  <ModelProvider>
                    {children}
                    <Toaster />
                  </ModelProvider>
                </StrategyStudioProvider>
              </WorkspacePrototypeProvider>
            </AuthProvider>
          </MotionConfig>
        </body>
      </html>
    );
  }

  if (!entryChecked) {
    return (
      <html lang="en" className={`${rootFontClasses} dark`}>
        <body data-theme={settings.theme} className="flex h-screen overflow-hidden relative" />
      </html>
    );
  }

  return (
    <html lang="en" className={`${rootFontClasses} dark`}>
      <body data-theme={settings.theme} className="flex h-screen overflow-hidden relative">
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <WorkspacePrototypeProvider>
              <StrategyStudioProvider>
                <ModelProvider>
                <MainWorkspace
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                  onSettingsClick={() => setIsSettingsOpen(true)}
                  onProfileClick={() => setIsProfileOpen(true)}
                  onAlertsClick={() => setIsAlertsOpen(true)}
                >
                  {children}
                </MainWorkspace>

                <SettingsModal
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  settings={settings}
                  setSettings={updateSettings}
                />
                <EditProfileModal
                  isOpen={isProfileOpen}
                  onClose={() => setIsProfileOpen(false)}
                />
                <AlertsModal
                  isOpen={isAlertsOpen}
                  onClose={() => setIsAlertsOpen(false)}
                />
                <Toaster />
                </ModelProvider>
              </StrategyStudioProvider>
            </WorkspacePrototypeProvider>
          </AuthProvider>
        </MotionConfig>
      </body>
    </html>
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
  const { user, loading } = useAuth();
  const isPublicAppPath = pathname.startsWith("/ai") || pathname.startsWith("/discover/markets") || isStandalonePublicPath(pathname);
  const shouldGate = !loading && Boolean(user.is_guest) && !isPublicAppPath;

  return (
    <>
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={onToggleSidebar}
        onSettingsClick={onSettingsClick}
        onProfileClick={onProfileClick}
        onAlertsClick={onAlertsClick}
      />

      <main className={`flex-1 flex flex-col relative z-10 overflow-hidden ${isSidebarOpen ? "md:ml-72" : "md:ml-16"}`}>
        <div className="flex-1 overflow-y-auto">
          {loading && !isPublicAppPath ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-white/45" role="status">
              Restoring your workspace...
            </div>
          ) : shouldGate ? <PublicAccessGate /> : children}
        </div>
      </main>
    </>
  );
}
