"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BookIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

export type SourcesProps = ComponentProps<"div">;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn("not-prose text-xs text-[var(--text-secondary)]", className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn("flex min-h-9 items-center gap-2 rounded-lg px-2 text-left transition-colors duration-150 hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50 motion-reduce:transition-none", className)}
    {...props}
  >
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-2 flex w-full flex-col gap-1 border-t border-[var(--theme-border)] pt-2",
      "outline-none motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:slide-out-to-top-2 motion-safe:data-[state=open]:slide-in-from-top-2 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type SourceProps = Omit<ComponentProps<"a">, "href"> & { href?: string };

export const Source = ({ href, title, children, className, ...props }: SourceProps) => {
  let safeHref: string | undefined;
  try {
    const parsed = href ? new URL(href) : null;
    safeHref = parsed && (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.toString() : undefined;
  } catch {
    safeHref = undefined;
  }
  const content = children ?? <><BookIcon className="size-3.5 shrink-0" /><span className="min-w-0 truncate font-medium">{title}</span></>;
  const sharedClassName = cn("flex min-h-9 items-center gap-2 rounded-lg px-2 text-[var(--text-secondary)]", safeHref && "hover:bg-[var(--surface-card-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-primary/50", className);
  return safeHref ? <a className={sharedClassName} href={safeHref} rel="noopener noreferrer" target="_blank" {...props}>{content}</a> : <div className={sharedClassName}>{content}</div>;
};
