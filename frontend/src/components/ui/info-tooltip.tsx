"use client"

import * as React from "react"
import { Tooltip } from "@base-ui/react/tooltip"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

type InfoTooltipProps = {
  label: string
  children: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}

function InfoTooltip({ label, children, className, side = "top" }: InfoTooltipProps) {
  return (
    <Tooltip.Provider delay={250} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={label}
          delay={250}
          closeDelay={80}
          className="grid size-5 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50"
        >
          <Info className="size-4" aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side={side} sideOffset={8} collisionPadding={12} className="z-[280]">
            <Tooltip.Popup
              className={cn(
                "max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] px-3 py-2.5 text-xs leading-5 text-[var(--text-primary)] shadow-[var(--shadow-tooltip)] outline-none transition-[opacity,transform] duration-100 data-[ending-style]:translate-y-0.5 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-0.5 data-[starting-style]:opacity-0 motion-reduce:transition-none",
                className,
              )}
            >
              {children}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

function MetricLabel({ label, description, className }: { label: string; description: React.ReactNode; className?: string }) {
  return (
    <Tooltip.Provider delay={250} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={250}
          closeDelay={80}
          className={cn("rounded-sm border-b border-dotted border-[var(--text-subtle)] text-left text-[11px] text-[var(--text-muted)] outline-none transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-primary/50", className)}
        >
          {label}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={12} className="z-[280]">
            <Tooltip.Popup className="max-w-[min(17rem,calc(100vw-1.5rem))] rounded-lg border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] px-3 py-2.5 text-xs leading-5 text-[var(--text-primary)] shadow-[var(--shadow-tooltip)] outline-none transition-opacity duration-100 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
              <strong>{label}</strong>
              <span className="mt-1 block text-[var(--text-muted)]">{description}</span>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export { InfoTooltip, MetricLabel }
