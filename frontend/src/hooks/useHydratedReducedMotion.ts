"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const subscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydratedReducedMotion() {
  const prefersReducedMotion = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return hydrated && Boolean(prefersReducedMotion);
}
