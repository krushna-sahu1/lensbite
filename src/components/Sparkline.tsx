"use client";

import Link from "next/link";
import type { DayTotals } from "@/lib/storage";

const WIDTH = 100;
const HEIGHT = 34;

/**
 * A small seven-day calorie sparkline. It links to the Insights screen, where
 * the same week is shown as a full chart.
 */
export function Sparkline({ days, goal }: { days: DayTotals[]; goal: number }) {
  const max = Math.max(goal, ...days.map((day) => day.calories), 1);
  const step = days.length > 1 ? WIDTH / (days.length - 1) : WIDTH;

  const points = days.map((day, index) => {
    const x = index * step;
    const y = HEIGHT - (day.calories / max) * (HEIGHT - 5) - 2.5;
    return { x, y, day };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = days.length
    ? `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`
    : "";
  const goalY = HEIGHT - (goal / max) * (HEIGHT - 5) - 2.5;

  return (
    <Link
      href="/insights"
      className="block rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition hover:brightness-[0.99]"
      aria-label="Last seven days of calories. Open Insights."
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Last 7 days</p>
        <p className="text-xs text-muted">See insights →</p>
      </div>

      {days.length > 0 ? (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="mt-3 h-12 w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#sparkFill)" />
            <line
              x1="0"
              x2={WIDTH}
              y1={goalY}
              y2={goalY}
              stroke="var(--fat)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              opacity="0.7"
            />
            <path
              d={line}
              fill="none"
              stroke="var(--accent-ink)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ul className="mt-1 flex justify-between text-[10px] text-muted">
            {days.map((day) => (
              <li key={day.day}>{day.date.toLocaleDateString([], { weekday: "narrow" })}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-3 h-12 w-full rounded-xl bg-track" />
      )}
    </Link>
  );
}
