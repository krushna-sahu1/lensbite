"use client";

import { useState } from "react";
import { PlusIcon, StarIcon } from "@/components/icons";
import { MEAL_META } from "@/components/meal-meta";
import { findSaved, saveFood, unsaveFood, type Library, type QuickFood } from "@/lib/library";
import { MEAL_TYPES, type Meal } from "@/lib/types";

type Tab = "recent" | "saved" | "yesterday";

const TABS: { value: Tab; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "saved", label: "Saved" },
  { value: "yesterday", label: "Yesterday" },
];

const toQuick = (meal: Meal): QuickFood => ({
  key: meal.id,
  name: meal.name,
  mealType: meal.mealType,
  notes: meal.notes,
  calories: meal.calories,
  protein_g: meal.protein_g,
  carbs_g: meal.carbs_g,
  fat_g: meal.fat_g,
  fiber_g: meal.fiber_g,
});

/**
 * Recent, saved and yesterday's foods, each with a one-tap "log it again"
 * button and a star to save it for later.
 */
export function QuickFoodList({
  library,
  onLog,
  onError,
}: {
  library: Library;
  /** Log these foods now. `keepType` keeps each food's own meal type (copying yesterday). */
  onLog: (foods: QuickFood[], keepType?: boolean) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusyKey(key);
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  function toggleStar(food: QuickFood) {
    const saved = food.savedId ? food : findSaved(library.saved, food.name);
    void run(`star:${food.key}`, () => (saved?.savedId ? unsaveFood(saved.savedId) : saveFood(food)));
  }

  const row = (food: QuickFood, keepType = false) => {
    const starred = !!(food.savedId || findSaved(library.saved, food.name));
    return (
      <li key={food.key} className="flex items-center gap-2 rounded-2xl bg-track/60 py-2 pl-3.5 pr-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">{food.name}</p>
          <p className="text-xs text-muted tabular-nums">
            {food.calories} kcal · P {food.protein_g}g · C {food.carbs_g}g · F {food.fat_g}g
          </p>
        </div>
        {library.savedAvailable && (
          <button
            type="button"
            onClick={() => toggleStar(food)}
            disabled={busyKey !== null}
            aria-label={starred ? `Remove ${food.name} from saved` : `Save ${food.name}`}
            aria-pressed={starred}
            className={`flex size-11 items-center justify-center rounded-full transition hover:bg-track ${
              starred ? "text-carbs" : "text-muted"
            }`}
          >
            <StarIcon width={18} height={18} filled={starred} />
          </button>
        )}
        <button
          type="button"
          onClick={() => void run(`log:${food.key}`, () => onLog([food], keepType))}
          disabled={busyKey !== null}
          aria-label={`Log ${food.name}`}
          className="flex size-11 items-center justify-center rounded-full bg-foreground text-background transition active:scale-90 disabled:opacity-50"
        >
          {busyKey === `log:${food.key}` ? <span className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background" /> : <PlusIcon width={18} height={18} />}
        </button>
      </li>
    );
  };

  const empty = (text: string) => (
    <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{text}</p>
  );

  return (
    <div>
      <div role="tablist" aria-label="Quick add" className="flex gap-1 rounded-2xl bg-track p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`min-h-10 flex-1 rounded-xl text-sm font-semibold transition ${
              tab === t.value ? "bg-gradient-to-b from-surface to-surface-2 shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3" role="tabpanel">
        {library.loading ? (
          <div className="space-y-2" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-track" />
            ))}
          </div>
        ) : library.error ? (
          empty(library.error)
        ) : tab === "recent" ? (
          library.recent.length ? <ul className="space-y-2">{library.recent.map((f) => row(f))}</ul> : empty("Foods you log show up here, ready to log again.")
        ) : tab === "saved" ? (
          !library.savedAvailable ? (
            empty("Saved foods need a database update. Ask the app's owner to apply the latest migration.")
          ) : library.saved.length ? (
            <ul className="space-y-2">{library.saved.map((f) => row(f))}</ul>
          ) : (
            empty("Tap the star on a recent food to save it here.")
          )
        ) : library.yesterday.length ? (
          <div className="space-y-4">
            {MEAL_TYPES.map((type) => {
              const meals = library.yesterday.filter((m) => m.mealType === type);
              if (!meals.length) return null;
              return (
                <section key={type}>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <h3 className="label-caps">{MEAL_META[type].label}</h3>
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() => void run(`copy:${type}`, () => onLog(meals.map(toQuick), true))}
                      className="min-h-9 rounded-full px-3 text-xs font-semibold text-accent-ink transition hover:bg-accent-soft disabled:opacity-50"
                    >
                      {busyKey === `copy:${type}` ? "Copying…" : meals.length > 1 ? `Copy all ${meals.length}` : "Copy"}
                    </button>
                  </div>
                  <ul className="space-y-2">{meals.map((m) => row(toQuick(m), true))}</ul>
                </section>
              );
            })}
          </div>
        ) : (
          empty("Nothing was logged yesterday.")
        )}
      </div>
    </div>
  );
}
