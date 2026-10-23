"use client";

import { useEffect, useState } from "react";

/**
 * Chart colours, read from the CSS custom properties in globals.css so the
 * charts follow the light/dark theme. Recharts needs real colour values (it
 * draws to SVG), so it can't use Tailwind classes like the rest of the app.
 */
const CHART_VARS = {
  accent: "--accent",
  accentInk: "--accent-ink",
  protein: "--protein",
  carbs: "--carbs",
  fat: "--fat",
  fiber: "--fiber",
  foreground: "--foreground",
  muted: "--muted",
  line: "--line",
  track: "--track",
  surface: "--surface",
} as const;

export type ChartColorName = keyof typeof CHART_VARS;
export type ChartColors = Partial<Record<ChartColorName, string>>;

function readColors(): ChartColors {
  const styles = getComputedStyle(document.documentElement);
  const colors: ChartColors = {};
  for (const [name, variable] of Object.entries(CHART_VARS)) {
    colors[name as ChartColorName] = styles.getPropertyValue(variable).trim();
  }
  return colors;
}

/** The current theme's chart colours, re-read whenever the theme changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>({});

  useEffect(() => {
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
