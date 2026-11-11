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

/**
 * Parses "YYYY-MM-DDTHH:MM" (seconds optional) as *local* time, which is how
 * the agent and the meal editor express times. A full ISO string with a
 * timezone ("...Z" or "+02:00") is honored as written. Returns null when invalid.
 */
export function parseLocalDateTime(value: string): Date | null {
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (m) {
    const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0));
    const date = new Date(y, mo - 1, d, h, mi, s);
    // Reject overflow such as 2026-02-31 or 25:00, which Date would silently roll over.
    // (The hour isn't compared: in a daylight-saving gap, 02:30 legitimately becomes 03:30.)
    const same =
      date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
    return same && h < 24 && mi < 60 && s < 60 ? date : null;
  }
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) {
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** A Date as the "YYYY-MM-DDTHH:MM" value of an <input type="datetime-local">, in local time. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
