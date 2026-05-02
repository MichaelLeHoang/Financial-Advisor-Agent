"use client";

import { useState } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import SettingsModal from "@/components/SettingsModal";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [settings, setSettings] = useState({
    model: "Gemini 3 Flash",
    theme: "Deep Space",
    risk: "moderate",
    quantum: "IonQ Forte (11 Qubits)",
  });

  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden relative">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-primary/10 rounded-full blur-[120px] animate-blob" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-secondary/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-primary/5 rounded-full blur-[100px] animate-blob animation-delay-4000" />
        </div>

        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((open) => !open)}
        />

        {/* Main content area */}
        <main className={`flex-1 flex flex-col relative z-10 overflow-hidden transition-[margin] duration-300 ease-out ${isSidebarOpen ? "md:ml-72" : "md:ml-16"}`}>
          <Header onSettingsClick={() => setIsSettingsOpen(true)} />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          setSettings={setSettings}
        />
      </body>
    </html>
  );
}
