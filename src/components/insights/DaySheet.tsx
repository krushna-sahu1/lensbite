"use client";

import { Sheet } from "@/components/Sheet";
import { MEAL_META } from "@/components/meal-meta";
import type { DayTotals } from "@/lib/storage";

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
          <div className="mb-5">
            <div className="flex items-baseline justify-between">
              <span className="label-caps">Calories</span>
              <span className="text-xs font-medium text-muted tabular-nums">
                {day.calories.toLocaleString()} / {goal.toLocaleString()} kcal
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  percent > 100
                    ? "bg-gradient-to-r from-carbs to-fat"
                    : "bg-gradient-to-r from-accent to-accent-ink"
                }`}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
          </div>

          {day.meals.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              Nothing was logged on this day.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {day.meals.map((meal) => {
                const meta = MEAL_META[meal.mealType];
                const Icon = meta.icon;
                return (
                  <li key={meal.id} className="rounded-2xl bg-track/60 p-3.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.badge}`}
                        aria-hidden="true"
                      >
                        <Icon width={18} height={18} strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="label-caps">{meta.label}</span>
                          <span className="text-[11px] font-medium text-muted">
                            {new Date(meal.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="mt-1 font-semibold tracking-tight">{meal.name}</p>
                        <p className="mt-0.5 text-xs text-muted tabular-nums">
                          P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g · Fiber {meal.fiber_g}g
                        </p>
                        {meal.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{meal.notes}</p>}
                      </div>
                      <span className="num-md shrink-0">
                        {meal.calories}
                        <span className="ml-0.5 text-[11px] font-medium text-muted">kcal</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
