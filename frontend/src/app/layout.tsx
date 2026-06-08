"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import EditProfileModal from "@/components/EditProfileModal";
import AlertsModal from "@/components/AlertsModal";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ModelProvider } from "@/components/ModelSelector";

const SETTINGS_STORAGE_KEY = "financial-advisor.settings";
const COVER_SEEN_STORAGE_KEY = "financial-advisor.coverSeen";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isStandalonePage = pathname.startsWith("/introduction")
    || pathname.startsWith("/login")
    || pathname.startsWith("/news")
    || pathname.startsWith("/blog")
    || pathname.startsWith("/pricing")
    || pathname.startsWith("/docs");

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
    if (isStandalonePage) {
      setEntryChecked(true);
      return;
    }

    const hasSeenCover = window.localStorage.getItem(COVER_SEEN_STORAGE_KEY) === "true";
    if (!hasSeenCover) {
      router.replace("/introduction");
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
      <html lang="en" className="dark">
      <body className="bg-[#050507] text-white font-sans antialiased overflow-x-hidden">
          <AuthProvider>
            <ModelProvider>
              {children}
            </ModelProvider>
          </AuthProvider>
        </body>
      </html>
    );
  }

  if (!entryChecked) {
    return (
      <html lang="en" className="dark">
        <body data-theme={settings.theme} className="flex h-screen overflow-hidden relative" />
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <body data-theme={settings.theme} className="flex h-screen overflow-hidden relative">
        <AuthProvider>
          <ModelProvider>
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((open) => !open)}
            onSettingsClick={() => setIsSettingsOpen(true)}
            onProfileClick={() => setIsProfileOpen(true)}
            onAlertsClick={() => setIsAlertsOpen(true)}
          />

          {/* Main content area */}
          <main className={`flex-1 flex flex-col relative z-10 overflow-hidden transition-[margin] duration-300 ease-out ${isSidebarOpen ? "md:ml-72" : "md:ml-16"}`}>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </main>

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            setSettings={updateSettings}
          />

          {/* Edit Profile Modal */}
          <EditProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
          />

          {/* Alerts Modal */}
          <AlertsModal
            isOpen={isAlertsOpen}
            onClose={() => setIsAlertsOpen(false)}
          />
          </ModelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
