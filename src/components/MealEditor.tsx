"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { MEAL_META } from "@/components/meal-meta";
import { mealTypeForTime, parseLocalDateTime, toLocalInputValue } from "@/lib/nutrition";
import { addMeal, updateMeal } from "@/lib/storage";
import { MEAL_TYPES, type Meal, type MealType } from "@/lib/types";

/** What the editor is doing: changing a saved meal, or adding a new one (eaten at `at`). */
export type MealEditorTarget = { mode: "edit"; meal: Meal } | { mode: "add"; at: Date };

const NUMBER_FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal", step: "1" },
  { key: "protein_g", label: "Protein", unit: "g", step: "0.1" },
  { key: "carbs_g", label: "Carbs", unit: "g", step: "0.1" },
  { key: "fat_g", label: "Fat", unit: "g", step: "0.1" },
  { key: "fiber_g", label: "Fiber", unit: "g", step: "0.1" },
] as const;

const INPUT =
  "h-11 w-full rounded-xl border border-line bg-background px-3 outline-none transition focus:border-accent-ink";

/**
 * Bottom sheet for adding a meal by hand or fixing one the AI logged: name,
 * meal type, when it was eaten, calories, macros and notes.
 */
export function MealEditor({
  target,
  onClose,
  onSaved,
}: {
  target: MealEditorTarget | null;
  onClose: () => void;
  /** Called after a successful save, with a short message for a toast. */
  onSaved?: (message: string) => void;
}) {
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target?.mode === "edit" ? "Edit meal" : "Add a meal"}
      subtitle={target?.mode === "edit" ? "Fix anything the estimate got wrong." : "Log something without going Live."}
    >
      {/* Keyed so each opening starts from that meal's values. */}
      {target && (
        <MealForm
          key={target.mode === "edit" ? target.meal.id : target.at.getTime()}
          target={target}
          onDone={(message) => {
            onSaved?.(message);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function MealForm({ target, onDone }: { target: MealEditorTarget; onDone: (message: string) => void }) {
  const initial = target.mode === "edit" ? target.meal : null;
  const initialTime = target.mode === "edit" ? new Date(target.meal.loggedAt) : target.at;
  const [mealType, setMealType] = useState<MealType>(initial?.mealType ?? mealTypeForTime(initialTime));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Picking a time in the future makes no sense for a food log.
  const [max] = useState(() => toLocalInputValue(new Date()));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const when = parseLocalDateTime(String(form.get("when") ?? ""));
    if (!name) return setError("Give the meal a name.");
    if (!when) return setError("Pick when you ate it.");
    if (when.getTime() > Date.now() + 60_000) return setError("That time is in the future.");

    const number = (key: string) => Number(form.get(key)) || 0;
    const values = {
      name,
      mealType,
      calories: number("calories"),
      protein_g: number("protein_g"),
      carbs_g: number("carbs_g"),
      fat_g: number("fat_g"),
      fiber_g: number("fiber_g"),
      notes: String(form.get("notes") ?? "").trim() || undefined,
    };

    setBusy(true);
    setError(null);
    try {
      if (target.mode === "edit") {
        await updateMeal(target.meal.id, { ...values, loggedAt: when.toISOString() });
        onDone(`Saved "${name}"`);
      } else {
        await addMeal(values, { loggedAt: when });
        onDone(`Added "${name}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that meal.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={initial?.name ?? ""}
            placeholder="e.g. Chicken burrito bowl"
            autoComplete="off"
            className={`${INPUT} mt-1.5`}
          />
        </label>

        <div>
          <span className="text-sm font-medium" id="meal-type-label">
            Meal
          </span>
          <div role="radiogroup" aria-labelledby="meal-type-label" className="mt-1.5 grid grid-cols-4 gap-1 rounded-2xl bg-track p-1">
            {MEAL_TYPES.map((type) => {
              const active = type === mealType;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMealType(type)}
                  className={`min-h-11 rounded-xl px-1 text-[13px] font-semibold transition ${
                    active ? "bg-gradient-to-b from-surface to-surface-2 text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  {MEAL_META[type].label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">When</span>
          <input
            name="when"
            type="datetime-local"
            required
            max={max}
            defaultValue={toLocalInputValue(initialTime)}
            className={`${INPUT} mt-1.5 tabular-nums`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {NUMBER_FIELDS.map(({ key, label, unit, step }) => (
            <label key={key} className={key === "calories" ? "col-span-2 block" : "block"}>
              <span className="text-sm font-medium">
                {label} <span className="font-normal text-muted">({unit})</span>
              </span>
              <input
                name={key}
                type="number"
                inputMode="decimal"
                min={0}
                step={step}
                defaultValue={initial ? initial[key] : ""}
                placeholder="0"
                className={`${INPUT} mt-1.5 text-right tabular-nums`}
              />
            </label>
          ))}
        </div>

        <label className="block">
          <span className="text-sm font-medium">
            Notes <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea
            name="notes"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.notes ?? ""}
            placeholder="Portion, how it was cooked…"
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none transition focus:border-accent-ink"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="min-h-12 w-full rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Saving…" : target.mode === "edit" ? "Save changes" : "Add meal"}
        </button>
      </fieldset>
    </form>
  );
}
