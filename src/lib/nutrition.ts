import type { Meal, Nutrients } from "./types";

export const NUTRIENT_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;

export const EMPTY_NUTRIENTS: Nutrients = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
};

/** Local calendar day as "YYYY-MM-DD" (so "today" follows the phone's timezone). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Start and end of the local calendar day as ISO timestamps, for querying `eaten_at`. */
export function localDayRange(date: Date): { from: string; to: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function mealsOnDay(meals: Meal[], day: Date): Meal[] {
  const key = localDateKey(day);
  return meals
    .filter((m) => localDateKey(new Date(m.loggedAt)) === key)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

export function sumNutrients(meals: Meal[]): Nutrients {
  const total = { ...EMPTY_NUTRIENTS };
  for (const meal of meals) {
    for (const key of NUTRIENT_KEYS) total[key] += meal[key] || 0;
  }
  return roundNutrients(total);
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    calories: Math.round(n.calories),
    protein_g: round1(n.protein_g),
    carbs_g: round1(n.carbs_g),
    fat_g: round1(n.fat_g),
    fiber_g: round1(n.fiber_g),
  };
}

export function remaining(goals: Nutrients, totals: Nutrients): Nutrients {
  const out = { ...EMPTY_NUTRIENTS };
  for (const key of NUTRIENT_KEYS) out[key] = goals[key] - totals[key];
  return roundNutrients(out);
}

/** Coerce model/tool or imported input into a sane non-negative number. */
export function toNonNegativeNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Suggest a meal type from the time of day. */
export function mealTypeForTime(date: Date) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "breakfast" as const;
  if (h >= 11 && h < 16) return "lunch" as const;
  if (h >= 17 && h < 22) return "dinner" as const;
  return "snack" as const;
}
