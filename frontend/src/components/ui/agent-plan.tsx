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
      title: "Gather Context",
      status: "pending",
      subtasks: [
        { id: "1.1", title: "Identify market scope", status: "pending", tools: ["single_scope"] },
        { id: "1.2", title: "Fetch prices and fundamentals", status: "pending", tools: ["get_stock_info", "research_market"] },
        { id: "1.3", title: "Collect recent news", status: "pending", tools: ["search_financial_news"] },
      ],
    },
    {
      id: "2",
      title: "Run Analysis",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Evaluate sentiment and catalysts", status: "pending", tools: ["analyze_sentiment"] },
        { id: "2.2", title: "Check forecasts or portfolio impact", status: "pending", tools: ["predict_stock_price", "optimize_portfolio_tool"] },
      ],
    },
    {
      id: "3",
      title: "Compose Answer",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Synthesize findings", status: "pending", tools: ["single_synthesis"] },
        { id: "3.2", title: "Format final response", status: "pending", tools: ["single_final"] },
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
        { id: "1.1", title: "Gather price, fundamentals, sentiment, and catalysts", status: "pending", tools: ["quant_researcher"] },
      ],
    },
    {
      id: "2",
      title: "Quant Analyst",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Rank momentum, trend, and strategy signals", status: "pending", tools: ["quant_analyst"] },
      ],
    },
    {
      id: "3",
      title: "Financial Data Scientist",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Run prediction and statistical risk checks", status: "pending", tools: ["data_scientist"] },
      ],
    },
    {
      id: "4",
      title: "Risk Analyst",
      status: "pending",
      subtasks: [
        { id: "4.1", title: "Assess downside, volatility, concentration, and correlation", status: "pending", tools: ["risk_analyst"] },
      ],
    },
    {
      id: "5",
      title: "Portfolio Analytics",
      status: "pending",
      subtasks: [
        { id: "5.1", title: "Optimize allocation and portfolio impact", status: "pending", tools: ["portfolio_analytics"] },
      ],
    },
    {
      id: "6",
      title: "Consensus Synthesis",
      status: "pending",
      subtasks: [
        { id: "6.1", title: "Build weighted consensus verdict", status: "pending", tools: ["consensus_synthesis"] },
      ],
    },
  ];
}

function getResearchDeskTasks(): Task[] {
  return [
    {
      id: "1",
      title: "Snapshot",
      status: "pending",
      subtasks: [
        { id: "1.1", title: "Collecting price, fundamentals, and news", status: "pending", tools: ["equity_snapshot"] },
      ],
    },
    {
      id: "2",
      title: "Analyst Team",
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Market Analyst", status: "pending", tools: ["market"] },
        { id: "2.2", title: "Social Media Analyst", status: "pending", tools: ["social"] },
        { id: "2.3", title: "News Analyst", status: "pending", tools: ["news"] },
        { id: "2.4", title: "Fundamentals Analyst", status: "pending", tools: ["fundamentals"] },
      ],
    },
    {
      id: "3",
      title: "Thesis Review",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Bull Researcher", status: "pending", tools: ["bull"] },
        { id: "3.2", title: "Bear Researcher", status: "pending", tools: ["bear"] },
        { id: "3.3", title: "Research Evaluator", status: "pending", tools: ["evaluator"] },
      ],
    },
    {
      id: "4",
      title: "Trade and Risk Review",
      status: "pending",
      subtasks: [
        { id: "4.1", title: "Trader", status: "pending", tools: ["trader"] },
        { id: "4.2", title: "Risky Analyst", status: "pending", tools: ["risky"] },
        { id: "4.3", title: "Neutral Analyst", status: "pending", tools: ["neutral"] },
        { id: "4.4", title: "Safe Analyst", status: "pending", tools: ["safe"] },
        { id: "4.5", title: "Portfolio Manager", status: "pending", tools: ["pm"] },
      ],
    },
  ];
}

function tasksForMode(mode: PlanMode) {
  if (mode === "consensus") return getConsensusTasks();
  if (mode === "research") return getResearchDeskTasks();
  return getSingleAgentTasks();
}

// ─── Live progress engine ───────────────────────────────────────────

function syntheticStepFor(mode: PlanMode, totalSubtasks: number, runStartedAt: number | null | undefined) {
  if (!runStartedAt) return 0;
  const stepMs = mode === "consensus" ? 1500 : 900;
  return Math.min(
    Math.floor((Date.now() - runStartedAt) / stepMs),
    Math.max(totalSubtasks - 1, 0)
  );
}

function useLiveProgress(
  mode: PlanMode,
  isActive: boolean,
  activeTool: string | null,
  completedTools: string[],
  runState: PlanRunState,
  runStartedAt: number | null | undefined,
  useSyntheticFallback: boolean,
): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => tasksForMode(mode));
  const [syntheticStep, setSyntheticStep] = useState(0);
  const modeRef = useRef(mode);
  const totalSubtasks = useMemo(
    () => tasksForMode(mode).reduce((sum, task) => sum + task.subtasks.length, 0),
    [mode]
  );
  const hasCompletedTools = completedTools.length > 0;
  const useSyntheticProgress = useSyntheticFallback && isActive && runState === "running" && !activeTool && mode !== "research" && !hasCompletedTools;

  // Reset only when mode actually changes
  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      setTasks(tasksForMode(mode));
      setSyntheticStep(0);
    }
  }, [mode]);

  useEffect(() => {
    if (!isActive) return;
    setSyntheticStep(syntheticStepFor(mode, totalSubtasks, runStartedAt));
  }, [isActive, mode, runStartedAt, totalSubtasks]);

  useEffect(() => {
    if (!useSyntheticProgress) return;
    const updateSyntheticStep = () => {
      setSyntheticStep(syntheticStepFor(mode, totalSubtasks, runStartedAt));
    };
    updateSyntheticStep();
    const interval = setInterval(() => {
      updateSyntheticStep();
    }, 350);
    return () => clearInterval(interval);
  }, [mode, runStartedAt, totalSubtasks, useSyntheticProgress]);

  useEffect(() => {
    let subtaskIndex = 0;
    setTasks((prev) =>
      prev.map((task) => {
        const subtasks = task.subtasks.map((sub) => {
          const currentIndex = subtaskIndex++;
          const isCompleted = sub.tools && sub.tools.length > 0 && sub.tools.some((t) => completedTools.includes(t));
          const isActiveTool = activeTool && sub.tools && sub.tools.length > 0 && sub.tools.includes(activeTool);

          if (runState === "queued") {
            if (isCompleted) return { ...sub, status: "completed" as const };
            if (isActiveTool) return { ...sub, status: "in-progress" as const };
            return { ...sub, status: "pending" as const };
          }
          if (useSyntheticProgress) {
            if (currentIndex < syntheticStep) return { ...sub, status: "completed" as const };
            if (currentIndex === syntheticStep) return { ...sub, status: "in-progress" as const };
            return { ...sub, status: "pending" as const };
          }

          // When agent finishes, mark everything completed
          if (!isActive && completedTools.length > 0) {
            return { ...sub, status: "completed" as const };
          }
          // Tool already finished
          if (isCompleted) {
            return { ...sub, status: "completed" as const };
          }
          // Tool currently running
          if (isActiveTool) {
            return { ...sub, status: "in-progress" as const };
          }
          return { ...sub, status: "pending" as const };
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
  }, [isActive, activeTool, completedTools, runState, syntheticStep, useSyntheticProgress]);

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

type PlanMode = "single" | "consensus" | "research";
type PlanRunState = "queued" | "running";

interface PlanProps {
  mode?: PlanMode;
  isActive?: boolean;
  activeTool?: string | null;
  completedTools?: string[];
  runState?: PlanRunState;
  runStartedAt?: number | null;
  useSyntheticFallback?: boolean;
}

export default function Plan({ mode = "single", isActive = true, activeTool = null, completedTools = [], runState = "running", runStartedAt = null, useSyntheticFallback = true }: PlanProps) {
  const tasks = useLiveProgress(mode, isActive, activeTool, completedTools, runState, runStartedAt, useSyntheticFallback);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const lastActiveTaskRef = useRef<string | null>(null);

  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      if (runStartedAt) startTimeRef.current = runStartedAt;
      else if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - (startTimeRef.current ?? Date.now())) / 1000);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, runStartedAt]);

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

  const allSubtasks = tasks.flatMap((t) => t.subtasks);
  const completedSubtasks = allSubtasks.filter((s) => s.status === "completed").length;
  const inProgressSubtasks = allSubtasks.filter((s) => s.status === "in-progress").length;
  const totalSubtasks = tasks.flatMap((t) => t.subtasks).length;
  const visualProgress = totalSubtasks > 0
    ? ((completedSubtasks + (inProgressSubtasks > 0 ? 0.45 : 0)) / totalSubtasks) * 100
    : 0;

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
            {mode === "consensus" ? "Quanfora 2.0 — Consensus Analysis" : mode === "research" ? "Quanfora 2.1 — Equity Research Desk" : "Quanfora 1.0 — Agent Execution"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && runState === "queued" && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/30">Queued</span>
          )}
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
          animate={{ width: `${visualProgress}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
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
