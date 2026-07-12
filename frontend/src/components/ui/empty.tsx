import * as React from "react"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--surface-card)] p-8 text-center",
        className
      )}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-title" className={cn("text-base font-semibold text-[var(--text-primary)]", className)} {...props} />
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="empty-description" className={cn("mt-1 text-sm text-[var(--text-subtle)]", className)} {...props} />
}

export { Empty, EmptyTitle, EmptyDescription }
