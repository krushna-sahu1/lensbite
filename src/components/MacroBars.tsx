"use client";

import type { Goals, Nutrients } from "@/lib/types";

const MACROS: { key: keyof Goals; label: string; color: string }[] = [
  { key: "protein_g", label: "Protein", color: "bg-protein" },
  { key: "carbs_g", label: "Carbs", color: "bg-carbs" },
  { key: "fat_g", label: "Fat", color: "bg-fat" },
  { key: "fiber_g", label: "Fiber", color: "bg-fiber" },
];

/** Macro progress bars for today, one per nutrient. */
export function MacroBars({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
      {MACROS.map(({ key, label, color }) => (
        <MacroBar key={key} label={label} value={totals[key]} goal={goals[key]} color={color} />
      ))}
    </div>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value)}
          <span className="text-xs">/{Math.round(goal)}g</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={`${label}: ${Math.round(value)} of ${Math.round(goal)} grams`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(goal)}
      >
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
