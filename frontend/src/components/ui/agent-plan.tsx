"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDotDashed,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

// ─── Type definitions ───────────────────────────────────────────────
interface Subtask {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed";
  tools?: string[];
}

interface Task {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed";
  subtasks: Subtask[];
}

// ─── Mode-based task presets ────────────────────────────────────────

function getSingleAgentTasks(): Task[] {
  return [
    {
      id: "1",
      title: "Fetching market data",
      status: "pending",
      subtasks: [
        { id: "1.1", title: "Querying stock prices & fundamentals", status: "pending", tools: ["yfinance"] },
        { id: "1.2", title: "Loading recent news context", status: "pending", tools: ["news-search"] },
      ],
    },
    {
      id: "2",
      title: "Running analysis tools",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Sentiment analysis via FinBERT", status: "pending", tools: ["finbert"] },
        { id: "2.2", title: "ML direction prediction", status: "pending", tools: ["random-forest"] },
      ],
    },
    {
      id: "3",
      title: "Composing response",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Synthesizing findings", status: "pending", tools: ["llm"] },
        { id: "3.2", title: "Formatting final answer", status: "pending", tools: ["llm"] },
      ],
    },
  ];
}

function getConsensusTasks(): Task[] {
  return [
    {
      id: "1",
      title: "Quant Researcher",
      status: "pending",
      subtasks: [
        { id: "1.1", title: "Gathering fundamental metrics", status: "pending", tools: ["yfinance", "sec-filings"] },
        { id: "1.2", title: "Evaluating valuation models", status: "pending", tools: ["dcf-model"] },
      ],
    },
    {
      id: "2",
      title: "Quant Analyst",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Running technical indicators", status: "pending", tools: ["ta-lib", "rsi"] },
        { id: "2.2", title: "Identifying price patterns", status: "pending", tools: ["pattern-detector"] },
      ],
    },
    {
      id: "3",
      title: "Financial Data Scientist",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Training ML prediction model", status: "pending", tools: ["random-forest", "lstm"] },
        { id: "3.2", title: "Running sentiment analysis", status: "pending", tools: ["finbert"] },
      ],
    },
    {
      id: "4",
      title: "Risk Analyst",
      status: "pending",
      subtasks: [
        { id: "4.1", title: "Evaluating downside scenarios", status: "pending", tools: ["var-model"] },
        { id: "4.2", title: "Checking volatility metrics", status: "pending", tools: ["yfinance"] },
      ],
    },
    {
      id: "5",
      title: "Portfolio Strategist",
      status: "pending",
      subtasks: [
        { id: "5.1", title: "Optimizing allocation weights", status: "pending", tools: ["markowitz", "qaoa"] },
        { id: "5.2", title: "Building consensus verdict", status: "pending", tools: ["consensus-engine"] },
      ],
    },
  ];
}

// ─── Simulated progress engine ──────────────────────────────────────

function useSimulatedProgress(mode: string, isActive: boolean): Task[] {
  const [liveTasks, setLiveTasks] = useState<Task[]>(() =>
    mode === "consensus" ? getConsensusTasks() : getSingleAgentTasks()
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef(mode);

  // Reset only when mode actually changes
  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      setLiveTasks(mode === "consensus" ? getConsensusTasks() : getSingleAgentTasks());
    }
  }, [mode]);

  useEffect(() => {
    if (!isActive) {
      // Mark everything completed when agent finishes
      setLiveTasks((prev) =>
        prev.map((t) => ({
          ...t,
          status: "completed" as const,
          subtasks: t.subtasks.map((s) => ({ ...s, status: "completed" as const })),
        }))
      );
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Advance one subtask every ~800ms
    intervalRef.current = setInterval(() => {
      setLiveTasks((prev) => {
        const next = prev.map((t) => ({ ...t, subtasks: [...t.subtasks] }));

        // Find the first non-completed subtask
        for (const task of next) {
          for (let i = 0; i < task.subtasks.length; i++) {
            const sub = task.subtasks[i];
            if (sub.status === "pending") {
              task.subtasks[i] = { ...sub, status: "in-progress" };
              task.status = "in-progress";
              return next;
            }
            if (sub.status === "in-progress") {
              task.subtasks[i] = { ...sub, status: "completed" };
              const allDone = task.subtasks.every((s) => s.status === "completed");
              if (allDone) task.status = "completed";
              return next;
            }
          }
        }
        // All done — clear interval
        if (intervalRef.current) clearInterval(intervalRef.current);
        return next;
      });
    }, 800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  return liveTasks;
}

// ─── Status icon helper ─────────────────────────────────────────────

function StatusIcon({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
        transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      >
        {status === "completed" ? (
          <CheckCircle2 className={`${cls} text-emerald-400`} />
        ) : status === "in-progress" ? (
          <CircleDotDashed className={`${cls} text-indigo-400 animate-spin`} style={{ animationDuration: "2s" }} />
        ) : (
          <Circle className={`${cls} text-white/20`} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Plan component ────────────────────────────────────────────

interface PlanProps {
  mode?: "single" | "consensus";
  isActive?: boolean;
}

export default function Plan({ mode = "single", isActive = true }: PlanProps) {
  const tasks = useSimulatedProgress(mode, isActive);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const lastActiveTaskRef = useRef<string | null>(null);

  // Auto-expand the currently in-progress task (ref-guarded to prevent loops)
  const activeTask = tasks.find((t) => t.status === "in-progress");
  const activeTaskId = activeTask?.id ?? null;

  useEffect(() => {
    if (activeTaskId && activeTaskId !== lastActiveTaskRef.current) {
      lastActiveTaskRef.current = activeTaskId;
      setExpandedTasks((prev) =>
        prev.includes(activeTaskId) ? prev : [...prev, activeTaskId]
      );
    }
  }, [activeTaskId]);

  const toggleExpansion = (id: string) => {
    setExpandedTasks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2.5">
          {isActive ? (
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </div>
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
          <span className="text-xs font-semibold text-white/70">
            {mode === "consensus" ? "QuanAd 2.0 — Consensus Analysis" : "Agent Execution"}
          </span>
        </div>
        <span className="text-[10px] font-medium text-white/30">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-white/[0.04]">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
          initial={{ width: "0%" }}
          animate={{ width: `${(completedCount / totalCount) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Task list */}
      <LayoutGroup>
        <div className="px-3 py-2">
          <ul className="space-y-0.5">
            {tasks.map((task) => {
              const isExpanded = expandedTasks.includes(task.id);

              return (
                <motion.li key={task.id} layout>
                  {/* Task row */}
                  <motion.div
                    className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                    onClick={() => toggleExpansion(task.id)}
                    layout
                  >
                    <StatusIcon status={task.status} size="md" />
                    <span
                      className={`text-[13px] font-medium transition-colors ${
                        task.status === "completed"
                          ? "text-white/35 line-through"
                          : task.status === "in-progress"
                            ? "text-white/90"
                            : "text-white/50"
                      }`}
                    >
                      {task.title}
                    </span>
                  </motion.div>

                  {/* Subtasks */}
                  <AnimatePresence mode="wait">
                    {isExpanded && task.subtasks.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                        className="overflow-hidden"
                        layout
                      >
                        <ul className="ml-4 space-y-0.5 border-l border-dashed border-white/[0.08] pl-3 pb-1">
                          {task.subtasks.map((sub) => (
                            <motion.li
                              key={sub.id}
                              className="flex items-center gap-2 py-0.5"
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <StatusIcon status={sub.status} />
                              <span
                                className={`text-xs transition-colors ${
                                  sub.status === "completed"
                                    ? "text-white/25 line-through"
                                    : sub.status === "in-progress"
                                      ? "text-white/75"
                                      : "text-white/35"
                                }`}
                              >
                                {sub.title}
                              </span>
                              {sub.tools && sub.status === "in-progress" && (
                                <div className="flex gap-1">
                                  {sub.tools.map((tool) => (
                                    <span
                                      key={tool}
                                      className="rounded bg-indigo-500/15 px-1 py-px text-[9px] font-medium text-indigo-300/70"
                                    >
                                      {tool}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </LayoutGroup>
    </div>
  );
}
