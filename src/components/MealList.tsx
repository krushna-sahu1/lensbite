"use client";

import { deleteMeal } from "@/lib/storage";
import type { Meal } from "@/lib/types";
import { TrashIcon } from "./icons";

const TYPE_STYLES: Record<Meal["mealType"], string> = {
  breakfast: "bg-carbs/15 text-carbs-ink",
  lunch: "bg-accent/15 text-accent-ink",
  dinner: "bg-protein/15 text-protein-ink",
  snack: "bg-fat/15 text-fat-ink",
};

async function confirmDelete(meal: Meal) {
  if (!confirm(`Delete "${meal.name}"?`)) return;
  try {
    await deleteMeal(meal.id);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Couldn't delete that meal.");
  }
}

export function MealList({ meals }: { meals: Meal[] }) {
  if (meals.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-medium">No meals logged today</p>
        <p className="mt-1 text-sm text-muted">
          Tap <span className="font-medium text-foreground">Go Live</span>, point your camera at your food and ask
          &ldquo;How many calories is this?&rdquo;
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {[...meals].reverse().map((meal) => (
        <li key={meal.id} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TYPE_STYLES[meal.mealType]}`}
                >
                  {meal.mealType}
                </span>
                <span className="text-xs text-muted">
                  {new Date(meal.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <p className="mt-1.5 truncate font-medium">{meal.name}</p>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g · Fiber {meal.fiber_g}g
              </p>
              {meal.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{meal.notes}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="font-semibold tabular-nums">
                {meal.calories}
                <span className="ml-0.5 text-xs font-normal text-muted">kcal</span>
              </span>
              <button
                type="button"
                onClick={() => void confirmDelete(meal)}
                className="-mr-1.5 rounded-full p-1.5 text-muted transition hover:bg-track hover:text-foreground"
                aria-label={`Delete ${meal.name}`}
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
