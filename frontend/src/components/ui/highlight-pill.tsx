"use client";

import { motion } from "motion/react";

export function HighlightPill({
  layoutId,
  className,
}: {
  layoutId: string;
  className?: string;
}) {
  return (
    <motion.span
      layoutId={layoutId}
      className={className ?? "absolute inset-0 rounded-full bg-white/[0.08]"}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}
