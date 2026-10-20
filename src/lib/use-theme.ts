"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, isTheme, resolveTheme, type Theme } from "./theme";

/**
 * The user's theme choice, kept in localStorage and mirrored onto
 * `<html data-theme>` so the CSS tokens switch. "system" follows the phone's
 * light/dark setting and updates live when the OS setting changes.
 *
 * The stored value is read through `useSyncExternalStore`, so the server and
 * the first client render agree ("system") and the real choice is applied
 * straight after hydration.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Private mode: fall back to the system theme.
    return "system";
  }
}

function getServerSnapshot(): Theme {
  return "system";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-theme", resolveTheme(next));
    listeners.forEach((listener) => listener());
  }, []);

  // While "system" is chosen, follow the phone's light/dark setting.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme };
}
