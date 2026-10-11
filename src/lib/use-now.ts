"use client";

import { useMemo, useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE / 4);
  return () => clearInterval(id);
}

const getMinute = () => Math.floor(Date.now() / MINUTE);

/**
 * Current time, refreshed every minute (so "today" rolls over at midnight).
 * Returns null during server rendering, where "now" isn't meaningful for the user.
 */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, getMinute, () => null);
  return useMemo(() => (minute === null ? null : new Date(minute * MINUTE)), [minute]);
}
