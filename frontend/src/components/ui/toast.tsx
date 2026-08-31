"use client";

import { forwardRef, type ComponentType, useImperativeHandle } from "react";
import { motion } from "motion/react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "error" | "warning";
type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

export interface ToasterProps {
  title?: string;
  message: string;
  variant?: Variant;
  duration?: number;
  position?: Position;
  actions?: ActionButton;
  onDismiss?: () => void;
  highlightTitle?: boolean;
}

export interface ToasterRef {
  show: (props: ToasterProps) => void;
}

const variantStyles: Record<Variant, string> = {
  default: "border-[var(--theme-border)] bg-[var(--surface-panel)] text-[var(--text-primary)]",
  success: "border-green-500/40 bg-[var(--surface-panel)] text-[var(--text-primary)]",
  error: "border-red-negative/45 bg-[var(--surface-panel)] text-[var(--text-primary)]",
  warning: "border-amber-warning/45 bg-[var(--surface-panel)] text-[var(--text-primary)]",
};

const titleColor: Record<Variant, string> = {
  default: "text-[var(--text-primary)]",
  success: "text-green-positive",
  error: "text-red-negative",
  warning: "text-amber-warning",
};

const iconColor: Record<Variant, string> = {
  default: "text-[var(--text-muted)]",
  success: "text-green-positive",
  error: "text-red-negative",
  warning: "text-amber-warning",
};

const variantIcons: Record<Variant, ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const actionStyles: Record<Variant, string> = {
  default: "border-[var(--theme-border)] text-[var(--text-primary)] hover:bg-white/[0.08]",
  success: "border-green-500/45 text-green-positive hover:bg-green-positive/10",
  error: "border-red-negative/45 text-red-negative hover:bg-red-negative/10",
  warning: "border-amber-warning/45 text-amber-warning hover:bg-amber-warning/10",
};

const toastAnimation = {
  initial: { opacity: 0, y: 18, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 18, scale: 0.96 },
};

export function showToast({
  title,
  message,
  variant = "default",
  duration = 4000,
  position,
  actions,
  onDismiss,
  highlightTitle,
}: ToasterProps) {
  const Icon = variantIcons[variant];

  sonnerToast.custom(
    (toastId) => (
      <motion.div
        variants={toastAnimation}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "flex w-full max-w-sm items-start justify-between gap-3 rounded-xl border p-3 shadow-[var(--shadow-popover)]",
          variantStyles[variant]
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor[variant])} />
          <div className="min-w-0 space-y-1">
            {title && (
              <h3
                className={cn(
                  "text-xs font-semibold leading-none",
                  titleColor[variant],
                  highlightTitle && titleColor.success
                )}
              >
                {title}
              </h3>
            )}
            <p className="text-xs leading-5 text-[var(--text-muted)]">{message}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions?.label && (
            <Button
              variant={actions.variant || "outline"}
              size="xs"
              onClick={() => {
                actions.onClick();
                sonnerToast.dismiss(toastId);
              }}
              className={cn("rounded-lg", actionStyles[variant])}
            >
              {actions.label}
            </Button>
          )}

          <button
            type="button"
            onClick={() => {
              sonnerToast.dismiss(toastId);
              onDismiss?.();
            }}
            className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </motion.div>
    ),
    { duration, position }
  );
}

const Toaster = forwardRef<ToasterRef, { defaultPosition?: Position }>(
  ({ defaultPosition = "bottom-right" }, ref) => {
    useImperativeHandle(ref, () => ({
      show: showToast,
    }));

    return (
      <SonnerToaster
        position={defaultPosition}
        toastOptions={{ unstyled: true, className: "flex justify-end" }}
      />
    );
  }
);

Toaster.displayName = "Toaster";

export default Toaster;
