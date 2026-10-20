"use client";

import { useEffect, useState } from "react";

/**
 * The big calorie ring on the Home screen. It fills up from empty when it
 * mounts, and turns red once the goal is passed.
 */
export function CalorieRing({ value, goal }: { value: number; goal: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const left = Math.round(Math.abs(goal - value));

  // Animate the arc from empty to its value once we're on the client.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setProgress(Math.min(pct, 1)));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div className="relative mx-auto size-44 sm:size-52">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="ringFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-ink)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} strokeWidth="9" fill="none" className="stroke-track" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          stroke={over ? "var(--fat)" : "url(#ringFill)"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {over ? "Over goal by" : "Left to eat"}
        </span>
        <span className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
          {left.toLocaleString()}
        </span>
        <span className="text-xs text-muted">kcal</span>
      </div>

      {/* The same number, for screen readers. */}
      <span className="sr-only">
        {value.toLocaleString()} of {goal.toLocaleString()} calories eaten, {Math.round(pct * 100)}% of your goal.
      </span>
    </div>
  );
}
