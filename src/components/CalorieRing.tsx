"use client";

import { useEffect, useId, useState } from "react";
import { useCountUp } from "@/lib/use-count-up";

/**
 * The big calorie ring at the top of Home. The arc eases from empty to the
 * current progress, the gradient warms up as the day fills, and the whole ring
 * turns amber/rose once the goal is passed.
 */
export function CalorieRing({ value, goal }: { value: number; goal: number }) {
  const uid = useId().replace(/:/g, "");
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  const warming = !over && pct > 0.85;
  const left = Math.round(Math.abs(goal - value));
  const shown = Math.round(useCountUp(left));

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
          <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1">
            {over ? (
              <>
                <stop offset="0%" stopColor="var(--carbs)" />
                <stop offset="100%" stopColor="var(--fat)" />
              </>
            ) : warming ? (
              <>
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--carbs)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-ink)" />
              </>
            )}
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
          stroke={`url(#${uid}-ring)`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={
            over
              ? "drop-shadow-[0_0_7px_rgba(251,113,133,0.45)]"
              : "drop-shadow-[0_0_7px_rgba(74,222,128,0.45)]"
          }
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`label-caps ${over ? "text-fat-ink" : ""}`}>
          {over ? "Over goal by" : "Left to eat"}
        </span>
        <span className={`num-xl mt-1 ${over ? "text-fat-ink" : ""}`}>{shown.toLocaleString()}</span>
        <span className="label-caps mt-1">kcal</span>
      </div>

      {/* The same number, for screen readers. */}
      <span className="sr-only">
        {value.toLocaleString()} of {goal.toLocaleString()} calories eaten, {Math.round(pct * 100)}% of your goal.
      </span>
    </div>
  );
}
