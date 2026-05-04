import * as React from "react"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.025] p-8 text-center",
        className
      )}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-title" className={cn("text-base font-semibold text-white", className)} {...props} />
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="empty-description" className={cn("mt-1 text-sm text-white/42", className)} {...props} />
}

export { Empty, EmptyTitle, EmptyDescription }
