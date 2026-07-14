"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { APP_SHORTCUT_GROUPS, keyboardShortcutsEnabled, setKeyboardShortcutsEnabled } from "@/lib/keyboard-shortcuts";

export default function ShortcutsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setEnabled(keyboardShortcutsEnabled());
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen, onClose]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    setKeyboardShortcutsEnabled(next);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-6">
          <motion.button type="button" aria-label="Close shortcuts" className="absolute inset-0 bg-[var(--surface-backdrop)] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="relative flex max-h-[min(820px,calc(100dvh-1.5rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] text-[var(--text-primary)] shadow-[var(--shadow-dialog)]">
            <header className="flex shrink-0 items-start justify-between gap-6 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
              <div>
                <h2 id="shortcuts-title" className="text-2xl font-semibold sm:text-3xl">Shortcuts</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)] sm:text-base">Navigate and review the workspace quickly without leaving the keyboard.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close shortcuts" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50"><X className="size-5" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 sm:px-8">
              {APP_SHORTCUT_GROUPS.map((group) => (
                <section key={group.label} className="border-t border-[var(--theme-border)] py-6 first:border-t-0 first:pt-2">
                  <h3 className="mb-3 text-sm font-medium text-[var(--text-muted)]">{group.label}</h3>
                  <div className="space-y-1">
                    {group.shortcuts.map((shortcut) => (
                      <div key={shortcut.id} className="flex min-h-11 items-center justify-between gap-6 rounded-xl px-2 py-2 hover:bg-[var(--surface-card-hover)]">
                        <span className="text-sm font-semibold sm:text-base">{shortcut.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">{shortcut.keys.map((key) => <kbd key={key} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-control)] px-2 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-control)]">{key}</kbd>)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <footer className="flex shrink-0 items-center justify-between border-t border-[var(--theme-border)] bg-[var(--surface-popover-strong)] px-6 py-4 sm:px-8">
              <span className="text-sm font-semibold sm:text-base">Enable keyboard shortcuts</span>
              <button type="button" role="switch" aria-label="Enable keyboard shortcuts" aria-checked={enabled} onClick={toggleEnabled} className="relative h-8 w-14 rounded-full border border-[var(--theme-border-strong)] bg-[var(--surface-control)] transition-colors data-[enabled=true]:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50" data-enabled={enabled ? "true" : "false"}><span className={`absolute left-0 top-1 flex size-6 items-center justify-center rounded-full bg-white text-emerald-600 shadow transition-transform duration-150 motion-reduce:transition-none ${enabled ? "translate-x-7" : "translate-x-1"}`}>{enabled && <Check className="size-4" />}</span></button>
            </footer>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
