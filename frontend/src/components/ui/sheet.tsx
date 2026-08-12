"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react"

import { cn } from "@/lib/utils"

type SheetSide = "top" | "right" | "bottom" | "left"

const sideStyles: Record<SheetSide, string> = {
  top: "inset-x-0 top-0 max-h-dvh w-full border-x-0 border-t-0",
  right: "inset-y-0 right-0 h-dvh w-full max-w-[480px] border-y-0 border-r-0 sm:w-[min(480px,100vw)]",
  bottom: "inset-x-0 bottom-0 max-h-dvh w-full border-x-0 border-b-0",
  left: "inset-y-0 left-0 h-dvh w-full max-w-[480px] border-y-0 border-l-0 sm:w-[min(480px,100vw)]",
}

type SheetContextValue = { open: boolean }

const SheetContext = React.createContext<SheetContextValue | null>(null)

function useSheet() {
  const context = React.useContext(SheetContext)
  if (!context) throw new Error("Sheet components must be rendered inside Sheet")
  return context
}

function Sheet({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const controlled = open !== undefined
  const currentOpen = controlled ? open : uncontrolledOpen

  const handleOpenChange = React.useCallback<NonNullable<React.ComponentProps<typeof DialogPrimitive.Root>["onOpenChange"]>>(
    (nextOpen, details) => {
      if (!controlled) setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen, details)
    },
    [controlled, onOpenChange],
  )

  return (
    <SheetContext.Provider value={{ open: currentOpen }}>
      <DialogPrimitive.Root {...props} open={currentOpen} onOpenChange={handleOpenChange} />
    </SheetContext.Provider>
  )
}

function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const { open } = useSheet()

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal key="sheet-portal" data-slot="sheet-portal" {...props} keepMounted />
      )}
    </AnimatePresence>
  )
}

function SheetClose({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="sheet-close"
      className={cn(
        "group inline-flex size-9 items-center justify-center rounded-xl border border-transparent bg-transparent text-[var(--text-subtle)] transition-colors duration-150 hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  transition = { type: "spring", stiffness: 150, damping: 22 },
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Popup>, "render"> & {
  side?: SheetSide
  showCloseButton?: boolean
  transition?: Transition
}) {
  const reduceMotion = useReducedMotion()
  const axis = side === "left" || side === "right" ? "x" : "y"
  const offscreen = {
    right: { x: "100%", opacity: 0 },
    left: { x: "-100%", opacity: 0 },
    top: { y: "-100%", opacity: 0 },
    bottom: { y: "100%", opacity: 0 },
  } satisfies Record<SheetSide, { x?: string; y?: string; opacity: number }>

  return (
    <SheetPortal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-backdrop"
        className="fixed inset-0 z-[220] bg-[var(--surface-backdrop)]"
        render={
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
          />
        }
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-[230] flex flex-col overflow-hidden border border-[var(--theme-border)] bg-[var(--surface-dialog)] text-[var(--text-primary)] shadow-[var(--shadow-dialog)] outline-none",
          sideStyles[side],
          className,
        )}
        render={
          <motion.div
            initial={reduceMotion ? false : offscreen[side]}
            animate={{ [axis]: 0, opacity: 1 }}
            exit={reduceMotion ? { [axis]: 0, opacity: 1 } : offscreen[side]}
            transition={reduceMotion ? { duration: 0 } : transition}
          />
        }
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClose className="absolute right-4 top-4">
            <img
              src="/close-svgrepo-com.svg"
              alt=""
              aria-hidden="true"
              data-icon="inline-start"
              className="size-5 opacity-65 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
            />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 px-6 pt-6 text-left", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-xl font-semibold text-[var(--text-primary)]", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-[var(--text-subtle)]", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-6", className)} {...props} />
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  useSheet,
}
