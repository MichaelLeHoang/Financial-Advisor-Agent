import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type HorizontalScrollProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
};

export function HorizontalScroll({ as: Component = "div", className, children, ...props }: HorizontalScrollProps) {
  return (
    <Component
      className={cn(
        "overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/14 [&::-webkit-scrollbar-track]:bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
