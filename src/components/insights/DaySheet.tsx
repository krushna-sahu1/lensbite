"use client";

import { Sheet } from "@/components/Sheet";
import type { DayTotals } from "@/lib/storage";
import type { Meal } from "@/lib/types";

const TYPE_STYLES: Record<Meal["mealType"], string> = {
  breakfast: "bg-carbs/15 text-carbs-ink",
  lunch: "bg-accent/15 text-accent-ink",
  dinner: "bg-protein/15 text-protein-ink",
  snack: "bg-fat/15 text-fat-ink",
};

/** Bottom sheet with everything logged on one day. */
export function DaySheet({
  day,
  goal,
  onClose,
}: {
  day: DayTotals | null;
  goal: number;
  onClose: () => void;
}) {
  const open = day !== null;
  const percent = day && goal > 0 ? Math.round((day.calories / goal) * 100) : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={day ? day.date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : ""}
      subtitle={
        day
          ? `${day.calories.toLocaleString()} kcal · ${percent}% of your ${goal.toLocaleString()} kcal goal`
          : undefined
      }
    >
      {day && (
        <div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-track">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${percent > 100 ? "bg-fat" : "bg-accent"}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>

          {day.meals.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              Nothing was logged on this day.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {day.meals.map((meal) => (
                <li key={meal.id} className="rounded-2xl bg-track/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_STYLES[meal.mealType]}`}>
                          {meal.mealType}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(meal.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium">{meal.name}</p>
                      <p className="mt-0.5 text-xs text-muted tabular-nums">
                        P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g · Fiber {meal.fiber_g}g
                      </p>
                      {meal.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{meal.notes}</p>}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {meal.calories}
                      <span className="ml-0.5 text-xs font-normal text-muted">kcal</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
