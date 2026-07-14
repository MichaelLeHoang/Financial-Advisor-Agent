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
            "max-h-[min(34rem,calc(100dvh-1rem))] w-80 scale-100 overflow-y-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--surface-popover-strong)] p-2 text-[var(--text-primary)] opacity-100 shadow-[var(--shadow-popover)] outline-none transition-[opacity,scale] duration-150 ease-out data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none",
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
        "theme-menu-item flex h-11 w-full cursor-default select-none items-center gap-3 rounded-xl px-3 text-sm text-[var(--text-secondary)] outline-none transition-colors duration-150 hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-card-hover)] data-[highlighted]:text-[var(--text-primary)] motion-reduce:transition-none",
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
      className={cn("my-2 h-px bg-[var(--theme-border)]", className)}
      {...props}
    />
  )
}

function DropdownMenuSubmenu(props: React.ComponentProps<typeof MenuPrimitive.SubmenuRoot>) {
  return <MenuPrimitive.SubmenuRoot {...props} />
}

function DropdownMenuSubmenuTrigger({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.SubmenuTrigger>) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-submenu-trigger"
      className={cn(
        "theme-menu-item flex h-9 w-full cursor-default select-none items-center gap-2.5 rounded-xl px-2 text-sm text-[var(--text-secondary)] outline-none transition-colors duration-150 hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] data-[highlighted]:bg-[var(--surface-card-hover)] data-[highlighted]:text-[var(--text-primary)] data-[popup-open]:bg-[var(--surface-card-hover)] motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSubmenuContent({
  className,
  side = "right",
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> &
  Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "side" | "align" | "sideOffset">) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-[190]">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-submenu-content"
          className={cn(
            "w-56 rounded-2xl border border-[var(--theme-border-strong)] bg-[var(--surface-popover-strong)] p-2 text-[var(--text-primary)] shadow-[var(--shadow-popover)] outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuContent,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
}
