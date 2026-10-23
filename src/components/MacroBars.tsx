"use client";

import type { Goals, Nutrients } from "@/lib/types";
import { useCountUp } from "@/lib/use-count-up";

const MACROS: {
  key: keyof Goals;
  label: string;
  dot: string;
  bar: string;
}[] = [
  { key: "protein_g", label: "Protein", dot: "bg-protein", bar: "bg-gradient-to-r from-protein to-protein/55" },
  { key: "carbs_g", label: "Carbs", dot: "bg-carbs", bar: "bg-gradient-to-r from-carbs to-carbs/55" },
  { key: "fat_g", label: "Fat", dot: "bg-fat", bar: "bg-gradient-to-r from-fat to-fat/55" },
  { key: "fiber_g", label: "Fiber", dot: "bg-fiber", bar: "bg-gradient-to-r from-fiber to-fiber/55" },
];

/** Macro progress bars for today, one per nutrient. */
export function MacroBars({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {MACROS.map(({ key, ...macro }) => (
        <MacroBar key={key} {...macro} value={totals[key]} goal={goals[key]} />
      ))}
    </div>
  );
}

function MacroBar({
  label,
  value,
  goal,
  dot,
  bar,
}: {
  label: string;
  value: number;
  goal: number;
  dot: string;
  bar: string;
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const shown = Math.round(useCountUp(value));

  return (
    <div className="rounded-2xl bg-surface/70 p-3 ring-1 ring-line/70">
      <div className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        <span className="label-caps">{label}</span>
      </div>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="num-md">{shown}</span>
        <span className="text-[11px] font-medium text-muted tabular-nums">/ {Math.round(goal)}g</span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={`${label}: ${Math.round(value)} of ${Math.round(goal)} grams`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(goal)}
      >
        <div
          className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
