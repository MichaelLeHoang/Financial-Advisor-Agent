"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export const PROMPT_NAVIGATION_THRESHOLD = 5;

export type PromptNavigationItem = {
  id: string;
  content: string;
};

export function promptAnchorId(messageId: string) {
  return `chat-prompt-${messageId}`;
}

function promptLabel(content: string) {
  return content.replace(/\s+/g, " ").trim() || "Untitled prompt";
}

export function PromptNavigator({
  prompts,
  scrollContainerRef,
}: {
  prompts: PromptNavigationItem[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const suppressNextFocusOpenRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(prompts.at(-1)?.id ?? null);

  const updateActivePrompt = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || prompts.length === 0) return;

    const remainingScroll = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remainingScroll <= 4) {
      setActivePromptId(prompts[prompts.length - 1].id);
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const activationLine = containerTop + Math.min(144, container.clientHeight * 0.24);
    let nextActiveId = prompts[0].id;

    for (const prompt of prompts) {
      const element = document.getElementById(promptAnchorId(prompt.id));
      if (!element || element.getBoundingClientRect().top > activationLine) break;
      nextActiveId = prompt.id;
    }

    setActivePromptId((current) => current === nextActiveId ? current : nextActiveId);
  }, [prompts, scrollContainerRef]);

  useEffect(() => {
    if (prompts.length < PROMPT_NAVIGATION_THRESHOLD) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let frame = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActivePrompt);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener("scroll", scheduleUpdate);
    };
  }, [prompts.length, scrollContainerRef, updateActivePrompt]);

  useEffect(() => {
    if (prompts.some((prompt) => prompt.id === activePromptId)) return;
    setActivePromptId(prompts.at(-1)?.id ?? null);
  }, [activePromptId, prompts]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  if (prompts.length < PROMPT_NAVIGATION_THRESHOLD) return null;

  const navigateToPrompt = (promptId: string) => {
    const container = scrollContainerRef.current;
    const prompt = document.getElementById(promptAnchorId(promptId));
    if (!container || !prompt) return;

    const containerBounds = container.getBoundingClientRect();
    const promptBounds = prompt.getBoundingClientRect();
    const top = container.scrollTop + promptBounds.top - containerBounds.top - 24;
    setActivePromptId(promptId);
    container.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  const closeAfterBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    suppressNextFocusOpenRef.current = true;
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-prompt-navigator-trigger]")?.focus();
  };

  return (
    <aside
      ref={rootRef}
      aria-label="Prompt navigation"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => {
        if (suppressNextFocusOpenRef.current) {
          suppressNextFocusOpenRef.current = false;
          return;
        }
        setOpen(true);
      }}
      onBlurCapture={closeAfterBlur}
      onKeyDown={handleKeyDown}
      className="absolute right-3 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <motion.button
        type="button"
        data-prompt-navigator-trigger
        aria-controls={menuId}
        aria-expanded={open}
        aria-label="Open prompt navigator"
        onClick={() => setOpen(true)}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.96 : 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.14 }}
        className={cn(
          "flex min-h-11 w-10 flex-col items-end justify-center gap-[7px] rounded-xl px-1.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none",
          open && "pointer-events-none"
        )}
      >
        {prompts.map((prompt, index) => {
          const active = prompt.id === activePromptId;
          return (
            <span
              key={prompt.id}
              data-prompt-marker={prompt.id}
              className={cn(
                "block h-0.5 rounded-full bg-white/34 transition-[width,background-color] duration-150 motion-reduce:transition-none",
                index % 3 === 0 ? "w-7" : index % 3 === 1 ? "w-5" : "w-6",
                active && "w-8 bg-white/85"
              )}
            />
          );
        })}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.nav
            id={menuId}
            aria-label="Conversation prompts"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 10, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.99 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-1/2 w-[min(25rem,calc(100vw-3rem))] -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#303033] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.46)]"
          >
            <ol className="max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain py-1">
              {prompts.map((prompt, index) => {
                const active = prompt.id === activePromptId;
                const label = promptLabel(prompt.content);
                return (
                  <li key={prompt.id}>
                    <button
                      type="button"
                      aria-current={active ? "location" : undefined}
                      aria-label={`Prompt ${index + 1}: ${label}`}
                      title={label}
                      onClick={() => navigateToPrompt(prompt.id)}
                      className={cn(
                        "block min-h-12 w-full truncate rounded-2xl px-4 py-3 text-left text-[15px] leading-6 text-white/82 outline-none transition-colors duration-150 hover:bg-white/[0.055] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white motion-reduce:transition-none",
                        active && "bg-white/[0.065] text-white"
                      )}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.nav>
        )}
      </AnimatePresence>
    </aside>
  );
}
