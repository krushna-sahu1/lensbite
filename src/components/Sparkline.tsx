"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui";
import { compactNumber } from "@/lib/format";
import type { DayTotals } from "@/lib/storage";

/**
 * Seven days of calories as rounded bars. Today is highlighted, every logged
 * day shows its value, and the goal is a soft hairline instead of a red dash.
 */
export function Sparkline({ days, goal }: { days: DayTotals[]; goal: number }) {
  const total = days.reduce((sum, day) => sum + day.calories, 0);
  const max = Math.max(goal, ...days.map((day) => day.calories), 1) * 1.18;
  const goalPct = Math.min(96, (goal / max) * 100);
  const todayIndex = days.length - 1;

  return (
    <Link
      href="/insights"
      className="group block rounded-[1.75rem] bg-gradient-to-b from-surface to-surface-2 p-4 shadow-card ring-1 ring-line transition active:scale-[0.995]"
      aria-label="Last seven days of calories. Open Insights."
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps">Last 7 days</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="num-lg">{total.toLocaleString()}</span>
            <span className="text-xs font-medium text-muted">kcal</span>
          </p>
        </div>
        <span className="mt-1 text-xs font-medium text-muted transition group-hover:text-foreground">
          Insights →
        </span>
      </div>

      {days.length === 0 ? (
        <Skeleton className="mt-4 h-28 rounded-2xl" />
      ) : total === 0 ? (
        <div className="mt-4 flex h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-line/70 bg-surface/40 text-center">
          <p className="text-sm font-semibold">No meals logged yet</p>
          <p className="mt-0.5 text-xs text-muted">Your week will show up here.</p>
        </div>
      ) : (
        <>
          <div className="relative mt-5 h-28">
            <span className="absolute right-0 top-0 text-[9px] font-medium uppercase tracking-[0.12em] text-muted/70">
              Goal
            </span>

            <div className="absolute inset-x-0 bottom-0 top-5 flex items-end gap-1.5">
              {/* Soft goal hairline, aligned to the bars' scale. */}
              <div
                className="pointer-events-none absolute inset-x-0 flex items-center"
                style={{ bottom: `${goalPct}%` }}
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-muted/40 to-transparent" />
              </div>
              {days.map((day, index) => {
                const isToday = index === todayIndex;
                const height = day.logged ? Math.max(6, (day.calories / max) * 100) : 3;
                return (
                  <div key={day.day} className="relative flex h-full flex-1 items-end">
                    {day.logged && (
                      <span
                        className={`absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums ${
                          isToday ? "text-accent-ink" : "text-muted"
                        }`}
                        style={{ bottom: `calc(${height}% + 4px)` }}
                      >
                        {compactNumber(day.calories)}
                      </span>
                    )}
                    <div
                      className={`w-full origin-bottom animate-[bar-grow_700ms_cubic-bezier(0.22,1,0.36,1)] rounded-md ${
                        isToday
                          ? "bg-gradient-to-t from-accent-ink to-accent shadow-[0_0_16px_-2px_var(--accent)]"
                          : day.logged
                            ? "bg-gradient-to-t from-accent/80 to-accent/45"
                            : "bg-track"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {days.map((day, index) => (
              <span
                key={day.day}
                className={`text-center text-[10px] font-medium ${
                  index === todayIndex ? "font-semibold text-accent-ink" : "text-muted"
                }`}
              >
                {day.date.toLocaleDateString([], { weekday: "short" })}
              </span>
            ))}
          </div>
        </>
      )}
    </Link>
  );
}
