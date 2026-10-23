"use client";

import type { ReactNode } from "react";
import { FlameIcon, SparkIcon, TargetIcon } from "@/components/icons";
import { useCountUp } from "@/lib/use-count-up";
import type { PeriodStats } from "@/lib/storage";

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
        numeric={stats.averageCalories}
        unit="kcal"
        hint={`Goal ${goal.toLocaleString()}`}
        icon={<FlameIcon width={16} height={16} />}
        tone="bg-carbs/15 text-carbs-ink"
      />
      <StatCard
        label="Best day"
        value={best ? best.date.toLocaleDateString([], { day: "numeric", month: "short" }) : "—"}
        hint={best ? `${best.calories.toLocaleString()} kcal` : "Nothing logged yet"}
        icon={<SparkIcon width={16} height={16} />}
        tone="bg-accent/15 text-accent-ink"
      />
      <StatCard
        label="Days on target"
        value={String(stats.daysOnTarget)}
        numeric={stats.daysOnTarget}
        unit={stats.daysOnTarget === 1 ? "day" : "days"}
        hint={`of ${days} in this period`}
        icon={<TargetIcon width={16} height={16} />}
        tone="bg-protein/15 text-protein-ink"
      />
      <StatCard
        label="Streak"
        value={String(stats.streak)}
        numeric={stats.streak}
        unit={stats.streak === 1 ? "day" : "days"}
        hint="on target in a row"
        icon={<FlameIcon width={16} height={16} />}
        tone="bg-fat/15 text-fat-ink"
      />

      <div className="col-span-2 rounded-[1.5rem] bg-gradient-to-br from-accent-soft via-surface to-surface-2 p-4 shadow-card ring-1 ring-accent/15">
        <p className="label-caps">Compared with {previousLabel}</p>
        {stats.changePercent === null ? (
          <p className="mt-1 text-lg font-semibold">No comparison yet</p>
        ) : (
          <p className="mt-1 flex items-baseline gap-2">
            <span className="num-lg">
              {stats.changePercent > 0 ? "+" : ""}
              {stats.changePercent}%
            </span>
            <span className="text-sm text-muted">
              {stats.changePercent > 0 ? "more calories" : stats.changePercent < 0 ? "fewer calories" : "the same"}
            </span>
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted tabular-nums">
          {stats.totalCalories.toLocaleString()} kcal in this period
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  numeric,
  unit,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  numeric?: number;
  unit?: string;
  hint?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-gradient-to-b from-surface to-surface-2 p-4 shadow-card ring-1 ring-line">
      <div className="flex items-center gap-2">
        <span className={`flex size-8 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">
          {icon}
        </span>
        <p className="label-caps">{label}</p>
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="num-lg">{numeric !== undefined ? <CountUp value={numeric} /> : value}</span>
        {unit && <span className="text-[11px] font-medium text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  return <>{Math.round(useCountUp(value)).toLocaleString()}</>;
}
