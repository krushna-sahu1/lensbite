"use client";

import { useSyncExternalStore } from "react";

/**
 * True when the phone asks for reduced motion. CSS animations are handled by
 * the global rule in globals.css; JavaScript-driven ones (the charts) check
 * this hook.
 */
let query: MediaQueryList | null = null;

function media(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (!query) query = window.matchMedia("(prefers-reduced-motion: reduce)");
  return query;
}

function subscribe(onChange: () => void) {
  const mql = media();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return media()?.matches ?? false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
