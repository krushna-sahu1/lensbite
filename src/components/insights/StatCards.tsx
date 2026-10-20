"use client";

import type { ReactNode } from "react";
import type { PeriodStats } from "@/lib/storage";
import { FlameIcon, SparkIcon } from "../icons";

/**
 * The headline numbers for the selected period: average, best day, days on
 * target, the current streak and how the period compares with the one before.
 */
export function StatCards({
  stats,
  goal,
  days,
  previousLabel,
}: {
  stats: PeriodStats;
  goal: number;
  /** Number of days in the period. */
  days: number;
  /** How the previous period is named, e.g. "last week". */
  previousLabel: string;
}) {
  const best = stats.bestDay;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="Daily average"
        value={stats.averageCalories.toLocaleString()}
        unit="kcal"
        hint={`Goal ${goal.toLocaleString()}`}
        icon={<FlameIcon width={16} height={16} />}
      />
      <StatCard
        label="Best day"
        value={best ? best.date.toLocaleDateString([], { day: "numeric", month: "short" }) : "—"}
        hint={best ? `${best.calories.toLocaleString()} kcal` : "Nothing logged yet"}
        icon={<SparkIcon width={16} height={16} />}
      />
      <StatCard
        label="Days on target"
        value={String(stats.daysOnTarget)}
        unit={stats.daysOnTarget === 1 ? "day" : "days"}
        hint={`of ${days} in this period`}
      />
      <StatCard
        label="Streak"
        value={String(stats.streak)}
        unit={stats.streak === 1 ? "day" : "days"}
        hint="on target in a row"
      />

      <div className="col-span-2 rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Compared with {previousLabel}</p>
        {stats.changePercent === null ? (
          <p className="mt-1 text-lg font-semibold">No comparison yet</p>
        ) : (
          <p className="mt-1 flex items-baseline gap-2 text-lg font-semibold">
            <span className="tabular-nums">
              {stats.changePercent > 0 ? "+" : ""}
              {stats.changePercent}%
            </span>
            <span className="text-sm font-normal text-muted">
              {stats.changePercent > 0 ? "more calories" : stats.changePercent < 0 ? "fewer calories" : "the same"}
            </span>
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted">{stats.totalCalories.toLocaleString()} kcal in this period</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted">{icon}</span>}
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {unit && <span className="text-xs font-normal text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}
