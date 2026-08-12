"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type FocusEvent,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

type HighlightMode = "children" | "parent";
type InteractionSource = "pointer" | "keyboard" | "click";
type Bounds = { top: number; right: number; bottom: number; left: number };
type MeasuredBounds = { x: number; y: number; width: number; height: number };

type HighlightContextValue = {
  activeValue: string | null;
  activate: (value: string | null, source: InteractionSource) => void;
  click: boolean;
  disabled: boolean;
  highlightClassName?: string;
  highlightStyle?: CSSProperties;
  hover: boolean;
  itemClassName?: string;
  layoutId: string;
  mode: HighlightMode;
  registerItem: (value: string, element: HTMLElement | null) => void;
  transition: Transition;
};

const HighlightContext = createContext<HighlightContextValue | null>(null);
const DEFAULT_TRANSITION: Transition = { type: "spring", stiffness: 350, damping: 35 };

export type HighlightProps = {
  as?: ElementType;
  boundsOffset?: Partial<Bounds>;
  children: ReactNode;
  className?: string;
  click?: boolean;
  containerClassName?: string;
  controlledItems?: boolean;
  defaultValue?: string | null;
  disabled?: boolean;
  enabled?: boolean;
  exitDelay?: number;
  forceUpdateBounds?: boolean;
  hover?: boolean;
  itemsClassName?: string;
  mode?: HighlightMode;
  onValueChange?: (value: string | null) => void;
  style?: CSSProperties;
  transition?: Transition;
  value?: string | null;
};

export function Highlight({
  as: Component = "div",
  boundsOffset,
  children,
  className,
  click = true,
  containerClassName,
  controlledItems = false,
  defaultValue = null,
  disabled = false,
  enabled = true,
  exitDelay = 0.2,
  forceUpdateBounds = false,
  hover = false,
  itemsClassName,
  mode = "children",
  onValueChange,
  style,
  transition = DEFAULT_TRANSITION,
  value,
}: HighlightProps) {
  const generatedLayoutId = useId();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement | null>(null);
  const itemElementsRef = useRef(new Map<string, HTMLElement>());
  const exitTimerRef = useRef<number | null>(null);
  const [internalValue, setInternalValue] = useState<string | null>(defaultValue);
  const [renderedValue, setRenderedValue] = useState<string | null>(value !== undefined ? value : internalValue);
  const [interactionSource, setInteractionSource] = useState<InteractionSource>("pointer");
  const [measuredBounds, setMeasuredBounds] = useState<MeasuredBounds | null>(null);
  const controlled = value !== undefined;
  const resolvedValue = enabled && !disabled ? (controlled ? value : internalValue) : null;

  const activate = useCallback((nextValue: string | null, source: InteractionSource) => {
    if (!enabled || disabled) return;
    setInteractionSource(source);
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }, [controlled, disabled, enabled, onValueChange]);

  useEffect(() => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (resolvedValue !== null) {
      setRenderedValue(resolvedValue);
      return;
    }
    exitTimerRef.current = window.setTimeout(() => setRenderedValue(null), exitDelay * 1000);
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, [exitDelay, resolvedValue]);

  const registerItem = useCallback((itemValue: string, element: HTMLElement | null) => {
    if (element) itemElementsRef.current.set(itemValue, element);
    else itemElementsRef.current.delete(itemValue);
  }, []);

  const measureActiveItem = useCallback(() => {
    if (mode !== "parent" || !renderedValue) {
      setMeasuredBounds(null);
      return;
    }
    const root = rootRef.current;
    const item = itemElementsRef.current.get(renderedValue);
    if (!root || !item) return;
    const rootBounds = root.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    const nextBounds = {
      x: itemBounds.left - rootBounds.left - (boundsOffset?.left ?? 0),
      y: itemBounds.top - rootBounds.top - (boundsOffset?.top ?? 0),
      width: itemBounds.width + (boundsOffset?.left ?? 0) + (boundsOffset?.right ?? 0),
      height: itemBounds.height + (boundsOffset?.top ?? 0) + (boundsOffset?.bottom ?? 0),
    };
    setMeasuredBounds((current) => (
      current
      && current.x === nextBounds.x
      && current.y === nextBounds.y
      && current.width === nextBounds.width
      && current.height === nextBounds.height
        ? current
        : nextBounds
    ));
  }, [boundsOffset?.bottom, boundsOffset?.left, boundsOffset?.right, boundsOffset?.top, mode, renderedValue]);

  useLayoutEffect(() => {
    measureActiveItem();
    if (mode !== "parent") return;
    const root = rootRef.current;
    const item = renderedValue ? itemElementsRef.current.get(renderedValue) : null;
    const resizeObserver = new ResizeObserver(measureActiveItem);
    if (root) resizeObserver.observe(root);
    if (item) resizeObserver.observe(item);
    window.addEventListener("resize", measureActiveItem);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureActiveItem);
    };
  }, [measureActiveItem, mode, renderedValue]);

  useLayoutEffect(() => {
    if (forceUpdateBounds) measureActiveItem();
  });

  const effectiveTransition = reduceMotion || interactionSource === "keyboard"
    ? { duration: 0 }
    : transition;

  const context = useMemo<HighlightContextValue>(() => ({
    activeValue: renderedValue,
    activate,
    click,
    disabled: disabled || !enabled,
    highlightClassName: className,
    highlightStyle: style,
    hover,
    itemClassName: itemsClassName,
    layoutId: `highlight-${generatedLayoutId}`,
    mode,
    registerItem,
    transition: effectiveTransition,
  }), [activate, className, click, disabled, effectiveTransition, enabled, generatedLayoutId, hover, itemsClassName, mode, registerItem, renderedValue, style]);

  const renderedChildren = controlledItems
    ? children
    : Children.map(children, (child, index) => (
        isValidElement(child)
          ? <HighlightItem value={String(child.key ?? index)}>{child}</HighlightItem>
          : child
      ));

  const handlePointerLeave = () => {
    if (!hover) return;
    const focusedItem = rootRef.current?.querySelector<HTMLElement>("[data-highlight-item-value]:focus-visible");
    activate(focusedItem?.dataset.highlightItemValue ?? null, focusedItem ? "keyboard" : "pointer");
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return;
    if (hover && event.currentTarget.matches(":hover")) return;
    activate(null, "keyboard");
  };

  return (
    <HighlightContext.Provider value={context}>
      <Component
        ref={rootRef}
        data-highlight-value={renderedValue ?? undefined}
        data-slot="highlight-root"
        className={cn("relative", mode === "parent" && containerClassName)}
        onBlur={handleBlur}
        onPointerLeave={handlePointerLeave}
      >
        {mode === "parent" && measuredBounds ? (
          <motion.span
            aria-hidden="true"
            data-highlight-value={renderedValue ?? undefined}
            data-slot="highlight"
            initial={false}
            animate={{
              x: measuredBounds.x,
              y: measuredBounds.y,
              width: measuredBounds.width,
              height: measuredBounds.height,
              opacity: renderedValue ? 1 : 0,
            }}
            className={cn("pointer-events-none absolute left-0 top-0", className)}
            style={style}
            transition={effectiveTransition}
          />
        ) : null}
        {renderedChildren}
      </Component>
    </HighlightContext.Provider>
  );
}

type InteractiveChildProps = HTMLAttributes<HTMLElement> & {
  "data-highlight-item-value"?: string;
  ref?: Ref<HTMLElement>;
};

export type HighlightItemProps = {
  activeClassName?: string;
  as?: ElementType;
  asChild?: boolean;
  children: ReactElement;
  className?: string;
  disabled?: boolean;
  exitDelay?: number;
  forceUpdateBounds?: boolean;
  id?: string;
  style?: CSSProperties;
  transition?: Transition;
  value?: string;
};

export function HighlightItem({
  activeClassName,
  as: Component = "div",
  asChild = false,
  children,
  className,
  disabled = false,
  id,
  style,
  transition,
  value,
}: HighlightItemProps) {
  const context = useContext(HighlightContext);
  const generatedValue = useId();
  if (!context) throw new Error("HighlightItem must be used inside Highlight.");
  const itemValue = value ?? id ?? generatedValue;
  const active = context.activeValue === itemValue;
  const itemRef = useRef<HTMLElement | null>(null);

  const setItemRef = useCallback((element: HTMLElement | null) => {
    itemRef.current = element;
    context.registerItem(itemValue, element);
  }, [context, itemValue]);

  const activateFromPointer = () => {
    if (context.hover && !disabled && !context.disabled) context.activate(itemValue, "pointer");
  };
  const activateFromFocus = (event: FocusEvent<HTMLElement>) => {
    if (disabled || context.disabled) return;
    context.activate(itemValue, event.currentTarget.matches(":focus-visible") ? "keyboard" : "pointer");
  };
  const activateFromClick = () => {
    if (context.click && !disabled && !context.disabled) context.activate(itemValue, "click");
  };

  const childHighlight = context.mode === "children" && active ? (
    <motion.span
      aria-hidden="true"
      data-highlight-value={itemValue}
      data-slot="highlight"
      layoutId={context.layoutId}
      className={cn("pointer-events-none absolute inset-0", context.highlightClassName)}
      style={context.highlightStyle}
      transition={transition ?? context.transition}
    />
  ) : null;

  if (asChild) {
    const childElement = children as ReactElement<InteractiveChildProps>;
    const child = cloneElement(childElement, {
      ref: mergeRefs(childElement.props.ref, setItemRef),
      "data-highlight-item-value": itemValue,
      className: cn(childElement.props.className, "relative", context.itemClassName, className, active && activeClassName),
      onClick: mergeHandlers(childElement.props.onClick, activateFromClick),
      onFocus: mergeHandlers(childElement.props.onFocus, activateFromFocus),
      onPointerEnter: mergeHandlers(childElement.props.onPointerEnter, activateFromPointer),
      style: { ...childElement.props.style, ...style },
      ...(context.mode === "children"
        ? {
            children: (
              <>
                {childHighlight}
                <span className="relative z-[1]">{childElement.props.children}</span>
              </>
            ),
          }
        : {}),
    });
    return child;
  }

  return (
    <Component
      ref={setItemRef}
      data-highlight-item-value={itemValue}
      className={cn("relative", context.itemClassName, className, active && activeClassName)}
      style={style}
      onClick={activateFromClick}
      onFocus={activateFromFocus}
      onPointerEnter={activateFromPointer}
    >
      {childHighlight}
      <span className="relative z-[1]">{children}</span>
    </Component>
  );
}

function mergeHandlers<EventType extends { defaultPrevented: boolean }>(
  existing: ((event: EventType) => void) | undefined,
  added: (event: EventType) => void,
) {
  return (event: EventType) => {
    existing?.(event);
    if (!event.defaultPrevented) added(event);
  };
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") ref(value);
      else if (ref) ref.current = value;
    });
  };
}
