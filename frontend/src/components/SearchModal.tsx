"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Search, X } from "lucide-react";
import { blogPosts } from "@/app/blog/data";

const RECENT_KEY = "financial-advisor.recent-searches";
const MAX_RECENT = 8;

const SUGGESTED = [
  "portfolio optimization",
  "market sentiment",
  "risk analysis",
  "quantum computing",
  "backtesting strategies",
  "trading journal",
];

export interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);

  // Load recents from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_KEY);
      if (stored) setRecents(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist recents
  const saveRecents = useCallback((next: string[]) => {
    setRecents(next);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const addRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const next = [trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
      saveRecents(next);
    },
    [recents, saveRecents]
  );

  const deleteRecent = useCallback(
    (term: string) => {
      saveRecents(recents.filter((r) => r !== term));
    },
    [recents, saveRecents]
  );

  const performSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      addRecent(trimmed);
      onOpenChange(false);

      // Search in blog posts first
      const match = blogPosts.find(
        (p) =>
          p.title.toLowerCase().includes(trimmed.toLowerCase()) ||
          p.excerpt.toLowerCase().includes(trimmed.toLowerCase()) ||
          p.category.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (match) {
        router.push(`/blog/${match.slug}`);
      } else {
        router.push(`/blog`);
      }
    },
    [addRecent, onOpenChange, router]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  // Blog matches for live preview
  const liveMatches =
    query.length >= 2
      ? blogPosts.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.excerpt.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
      : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[12vh] z-[110] w-[min(94vw,640px)] -translate-x-1/2 overflow-hidden rounded-[24px] border border-[var(--theme-border)] bg-[var(--surface-popover-strong)] shadow-[var(--shadow-popover)]"
          >
            {/* Close button */}
            <button
              type="button"
              aria-label="Close search"
              onClick={() => onOpenChange(false)}
              className="absolute right-5 top-5 z-20 flex size-8 items-center justify-center rounded-lg text-[var(--text-subtle)] transition-colors hover:text-[var(--text-primary)]"
            >
              <X className="size-[18px]" />
            </button>

            {/* Search input */}
            <form onSubmit={handleSubmit} className="border-b border-[var(--theme-border)] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <Search className="size-5 shrink-0 text-[var(--text-placeholder)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start searching"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-transparent text-lg text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
                />
              </div>
            </form>

            {/* Content area */}
            <div className="max-h-[55vh] overflow-y-auto px-5 py-5 sm:px-6">
              {/* Live results */}
              {liveMatches.length > 0 && (
                <section className="mb-5">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">
                    Results
                  </h3>
                  <div className="space-y-1">
                    {liveMatches.map((post) => (
                      <button
                        key={post.slug}
                        type="button"
                        onClick={() => {
                          addRecent(query.trim());
                          onOpenChange(false);
                          router.push(`/blog/${post.slug}`);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-selected)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[var(--text-primary)]">{post.title}</div>
                          <div className="truncate text-xs text-[var(--text-subtle)]">{post.category} · {post.readTime}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent searches */}
              {recents.length > 0 && query.length === 0 && (
                <section className="mb-5">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">
                    Recent
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recents.map((term) => (
                      <span
                        key={term}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-selected)]"
                      >
                        <button
                          type="button"
                          onClick={() => performSearch(term)}
                          className="flex items-center gap-1.5 outline-none"
                        >
                          <Clock className="size-3 text-[var(--text-subtle)]" />
                          {term}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${term}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRecent(term);
                          }}
                          className="flex size-4 items-center justify-center rounded-full text-[var(--text-subtle)] transition-colors hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)]"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Suggested */}
              {query.length === 0 && (
                <section>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-subtle)]">
                    Suggested
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          performSearch(term);
                        }}
                        className="rounded-full border border-[var(--theme-border)] bg-[var(--surface-card)] px-3.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--theme-border-strong)] hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)]"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
