import type { Goals, Nutrients } from "@/lib/types";

/** Big calorie ring + macro progress bars for today. */
export function DailySummary({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  const left = goals.calories - totals.calories;
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-5">
        <CalorieRing value={totals.calories} goal={goals.calories} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{left >= 0 ? "Remaining" : "Over goal"}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {Math.abs(left).toLocaleString()}
            <span className="ml-1 text-base font-normal text-muted">kcal</span>
          </p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} eaten
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
        <MacroBar label="Protein" value={totals.protein_g} goal={goals.protein_g} color="bg-protein" />
        <MacroBar label="Carbs" value={totals.carbs_g} goal={goals.carbs_g} color="bg-carbs" />
        <MacroBar label="Fat" value={totals.fat_g} goal={goals.fat_g} color="bg-fat" />
        <MacroBar label="Fiber" value={totals.fiber_g} goal={goals.fiber_g} color="bg-fiber" />
      </div>
    </section>
  );
}

function CalorieRing({ value, goal }: { value: number; goal: number }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = goal > 0 ? value / goal : 0;
  const over = pct > 1;
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} strokeWidth="10" fill="none" className="stroke-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-700 ${over ? "stroke-fat" : "stroke-accent"}`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(pct, 1))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
        <span className="text-[11px] uppercase tracking-wide text-muted">of goal</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value)}
          <span className="text-xs">/{Math.round(goal)}g</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-track">
        <div className={`h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
