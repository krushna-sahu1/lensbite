import { CalorieRing } from "@/components/CalorieRing";
import { MacroBars } from "@/components/MacroBars";
import type { Goals, Nutrients } from "@/lib/types";

/** The calorie ring + macro bars at the top of the Home screen. */
export function DailySummary({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <CalorieRing value={totals.calories} goal={goals.calories} />
      <p className="mt-3 text-center text-sm text-muted tabular-nums">
        {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal eaten
      </p>
      <div className="mt-6">
        <MacroBars totals={totals} goals={goals} />
      </div>
    </section>
  );
}
