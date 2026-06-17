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
        { id: "1.1", title: "Querying stock prices & fundamentals", status: "pending", tools: ["get_stock_info"] },
        { id: "1.2", title: "Scanning market indices", status: "pending", tools: ["research_market"] },
        { id: "1.3", title: "Searching recent news", status: "pending", tools: ["search_financial_news"] },
      ],
    },
    {
      id: "2",
      title: "Running analysis tools",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Sentiment analysis via FinBERT", status: "pending", tools: ["analyze_sentiment"] },
        { id: "2.2", title: "ML direction prediction", status: "pending", tools: ["predict_stock_price"] },
      ],
    },
    {
      id: "3",
      title: "Composing response",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Synthesizing findings", status: "pending", tools: [] },
        { id: "3.2", title: "Formatting final answer", status: "pending", tools: [] },
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
        { id: "1.1", title: "Gathering fundamental metrics", status: "pending", tools: ["get_stock_info"] },
        { id: "1.2", title: "Searching financial news", status: "pending", tools: ["search_financial_news"] },
      ],
    },
    {
      id: "2",
      title: "Quant Analyst",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Running technical indicators", status: "pending", tools: ["predict_stock_price"] },
        { id: "2.2", title: "Identifying price patterns", status: "pending", tools: ["predict_stock_price"] },
      ],
    },
    {
      id: "3",
      title: "Financial Data Scientist",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Training ML prediction model", status: "pending", tools: ["predict_stock_price"] },
        { id: "3.2", title: "Running sentiment analysis", status: "pending", tools: ["analyze_sentiment"] },
      ],
    },
    {
      id: "4",
      title: "Risk Analyst",
      status: "pending",
      subtasks: [
        { id: "4.1", title: "Evaluating downside scenarios", status: "pending", tools: ["optimize_portfolio_tool"] },
        { id: "4.2", title: "Checking volatility metrics", status: "pending", tools: ["get_stock_info"] },
      ],
    },
    {
      id: "5",
      title: "Portfolio Strategist",
      status: "pending",
      subtasks: [
        { id: "5.1", title: "Optimizing allocation weights", status: "pending", tools: ["optimize_portfolio_tool"] },
        { id: "5.2", title: "Building consensus verdict", status: "pending", tools: [] },
      ],
    },
  ];
}

// ─── Live progress engine ───────────────────────────────────────────

function useLiveProgress(
  mode: string,
  isActive: boolean,
  activeTool: string | null,
  completedTools: string[],
): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() =>
    mode === "consensus" ? getConsensusTasks() : getSingleAgentTasks()
  );
  const [syntheticStep, setSyntheticStep] = useState(0);
  const modeRef = useRef(mode);
  const totalSubtasks = useMemo(
    () => (mode === "consensus" ? getConsensusTasks() : getSingleAgentTasks())
      .reduce((sum, task) => sum + task.subtasks.length, 0),
    [mode]
  );
  const useSyntheticProgress = isActive && !activeTool && completedTools.length === 0;

  // Reset only when mode actually changes
  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      setTasks(mode === "consensus" ? getConsensusTasks() : getSingleAgentTasks());
      setSyntheticStep(0);
    }
  }, [mode]);

  useEffect(() => {
    if (!isActive) return;
    setSyntheticStep(0);
  }, [isActive, mode]);

  useEffect(() => {
    if (!useSyntheticProgress) return;
    const interval = setInterval(() => {
      setSyntheticStep((current) => Math.min(current + 1, Math.max(totalSubtasks - 1, 0)));
    }, mode === "consensus" ? 2200 : 1800);
    return () => clearInterval(interval);
  }, [mode, totalSubtasks, useSyntheticProgress]);

  useEffect(() => {
    let subtaskIndex = 0;
    setTasks((prev) =>
      prev.map((task) => {
        const subtasks = task.subtasks.map((sub) => {
          const currentIndex = subtaskIndex++;
          if (useSyntheticProgress) {
            if (currentIndex < syntheticStep) return { ...sub, status: "completed" as const };
            if (currentIndex === syntheticStep) return { ...sub, status: "in-progress" as const };
            return { ...sub, status: "pending" as const };
          }
          // When agent finishes, mark everything completed
          if (!isActive && completedTools.length > 0) {
            return { ...sub, status: "completed" as const };
          }
          // Tool currently running
          if (activeTool && sub.tools && sub.tools.length > 0 && sub.tools.includes(activeTool)) {
            return { ...sub, status: "in-progress" as const };
          }
          // Tool already finished
          if (sub.tools && sub.tools.length > 0 && sub.tools.some((t) => completedTools.includes(t))) {
            return { ...sub, status: "completed" as const };
          }
          return sub;
        });

        const allCompleted = subtasks.length > 0 && subtasks.every((s) => s.status === "completed");
        const someActive = subtasks.some((s) => s.status === "in-progress" || s.status === "completed");
        let taskStatus: Task["status"] = "pending";
        if (!isActive && completedTools.length > 0) taskStatus = "completed";
        else if (allCompleted) taskStatus = "completed";
        else if (someActive) taskStatus = "in-progress";

        return { ...task, status: taskStatus, subtasks };
      })
    );
  }, [isActive, activeTool, completedTools, syntheticStep, useSyntheticProgress]);

  return tasks;
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
  activeTool?: string | null;
  completedTools?: string[];
}

export default function Plan({ mode = "single", isActive = true, activeTool = null, completedTools = [] }: PlanProps) {
  const tasks = useLiveProgress(mode, isActive, activeTool, completedTools);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const lastActiveTaskRef = useRef<string | null>(null);

  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - (startTimeRef.current ?? Date.now())) / 1000);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Auto-expand the currently in-progress task
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

  const completedSubtasks = tasks.flatMap((t) => t.subtasks).filter((s) => s.status === "completed").length;
  const totalSubtasks = tasks.flatMap((t) => t.subtasks).length;

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
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-medium text-white/25">
            {elapsed.toFixed(1)}s
          </span>
          <span className="text-[10px] font-medium text-white/30">
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-white/[0.04]">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
          initial={{ width: "0%" }}
          animate={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
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
                              {sub.tools && sub.tools.length > 0 && sub.status === "in-progress" && (
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
