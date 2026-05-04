import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 resize-none rounded-3xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-base text-white transition-[color,box-shadow,background-color,border-color] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] placeholder:text-white/28 focus-visible:border-indigo-primary/50 focus-visible:ring-3 focus-visible:ring-indigo-primary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
