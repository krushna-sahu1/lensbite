/**
 * Light/dark theme handling.
 *
 * The choice lives in localStorage (`lensbite:theme`) and is one of
 * "light", "dark" or "system". `layout.tsx` runs `themeScript` before paint so
 * the first frame already has the right theme, and `useTheme()` keeps the
 * `<html data-theme>` attribute in sync when the user changes it.
 */
export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "lensbite:theme";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Runs in <head> before the first paint, so there's no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)})||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})()`;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** The theme actually shown on screen, once "system" is resolved. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
