"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" modal={false} {...props} />
}

function DropdownMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Portal>) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuContent({
  className,
  side = "right",
  align = "end",
  sideOffset = 12,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> &
  Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "side" | "align" | "sideOffset">) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-[180]">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "max-h-[min(34rem,calc(100dvh-1rem))] w-80 overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#050506] p-2 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.025),0_24px_70px_rgba(0,0,0,0.72),0_0_60px_rgba(99,102,241,0.12)] outline-none",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex h-11 w-full cursor-default select-none items-center gap-3 rounded-xl px-3 text-sm text-white/82 outline-none transition-colors hover:bg-white/[0.055] data-[highlighted]:bg-white/[0.055] data-[highlighted]:text-white",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("my-2 h-px bg-white/[0.08]", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
