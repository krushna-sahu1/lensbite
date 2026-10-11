/**
 * Tiny localStorage-backed store for meals and goals.
 *
 * React components read it through `useStore()` (useSyncExternalStore), so the
 * home screen updates instantly when the voice agent logs or deletes a meal.
 * Plain functions (addMeal, setGoals, ...) can be called from anywhere,
 * including the Live session's tool handlers.
 */
import { useSyncExternalStore } from "react";
import { MEAL_TYPES, type ExportFile, type Goals, type Meal, type MealType } from "./types";
import { localDateKey, NUTRIENT_KEYS, roundNutrients, toNonNegativeNumber } from "./nutrition";

const MEALS_KEY = "lensbite:meals:v1";
const GOALS_KEY = "lensbite:goals:v1";
const ACCESS_CODE_KEY = "lensbite:access-code";

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein_g: 120,
  carbs_g: 220,
  fat_g: 65,
  fiber_g: 30,
};

export interface StoreSnapshot {
  meals: Meal[];
  goals: Goals;
}

// ---------------------------------------------------------------------------
// Low-level read/write
// ---------------------------------------------------------------------------

const SERVER_SNAPSHOT: StoreSnapshot = { meals: [], goals: DEFAULT_GOALS };
let cache: StoreSnapshot | null = null;
const listeners = new Set<() => void>();

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getSnapshot(): StoreSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (!cache) {
    const meals = readJSON<unknown[]>(MEALS_KEY, []);
    cache = {
      meals: Array.isArray(meals) ? meals.map(normalizeMeal).filter((m): m is Meal => !!m) : [],
      goals: normalizeGoals(readJSON<Partial<Goals>>(GOALS_KEY, {})),
    };
  }
  return cache;
}

function write(next: StoreSnapshot) {
  cache = next;
  try {
    localStorage.setItem(MEALS_KEY, JSON.stringify(next.meals));
    localStorage.setItem(GOALS_KEY, JSON.stringify(next.goals));
  } catch (err) {
    console.error("Could not save to localStorage", err);
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep multiple open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("lensbite:")) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** React hook: current meals + goals. Returns defaults during server rendering. */
export function useStore(): StoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

// ---------------------------------------------------------------------------
// Validation helpers (used for tool input and JSON import)
// ---------------------------------------------------------------------------

function normalizeMealType(value: unknown): MealType {
  const v = String(value ?? "").toLowerCase();
  return (MEAL_TYPES as readonly string[]).includes(v) ? (v as MealType) : "snack";
}

function normalizeMeal(raw: unknown): Meal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = String(r.name ?? "").trim();
  const loggedAt = new Date(String(r.loggedAt ?? ""));
  if (!name || Number.isNaN(loggedAt.getTime())) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    loggedAt: loggedAt.toISOString(),
    name,
    mealType: normalizeMealType(r.mealType),
    notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim() : undefined,
    ...roundNutrients({
      calories: toNonNegativeNumber(r.calories),
      protein_g: toNonNegativeNumber(r.protein_g),
      carbs_g: toNonNegativeNumber(r.carbs_g),
      fat_g: toNonNegativeNumber(r.fat_g),
      fiber_g: toNonNegativeNumber(r.fiber_g),
    }),
  };
}

function normalizeGoals(raw: Partial<Record<keyof Goals, unknown>>): Goals {
  const goals = { ...DEFAULT_GOALS };
  for (const key of NUTRIENT_KEYS) {
    const n = toNonNegativeNumber(raw?.[key]);
    if (n > 0) goals[key] = n;
  }
  return roundNutrients(goals);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type NewMeal = Omit<Meal, "id" | "loggedAt">;

export function addMeal(input: NewMeal): Meal {
  const meal = normalizeMeal({ ...input, id: crypto.randomUUID(), loggedAt: new Date().toISOString() });
  if (!meal) throw new Error("Meal needs a name");
  const snap = getSnapshot();
  write({ ...snap, meals: [...snap.meals, meal] });
  return meal;
}

export function deleteMeal(id: string) {
  const snap = getSnapshot();
  write({ ...snap, meals: snap.meals.filter((m) => m.id !== id) });
}

/** Removes the most recently logged meal from *today*. Returns it, or null if none. */
export function deleteLastMealToday(): Meal | null {
  const snap = getSnapshot();
  const today = localDateKey(new Date());
  const last = snap.meals
    .filter((m) => localDateKey(new Date(m.loggedAt)) === today)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    .at(-1);
  if (!last) return null;
  deleteMeal(last.id);
  return last;
}

export function setGoals(goals: Partial<Goals>) {
  const snap = getSnapshot();
  write({ ...snap, goals: normalizeGoals({ ...snap.goals, ...goals }) });
}

export function exportData(): string {
  const snap = getSnapshot();
  const file: ExportFile = {
    app: "lensbite",
    version: 1,
    exportedAt: new Date().toISOString(),
    goals: snap.goals,
    meals: snap.meals,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Imports a previously exported file. Meals are merged by id (existing ones are
 * kept), and goals are replaced if the file contains them.
 */
export function importData(json: string): { added: number; duplicates: number; invalid: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const file = parsed as Partial<ExportFile>;
  if (!file || typeof file !== "object" || !Array.isArray(file.meals)) {
    throw new Error("That doesn't look like a LensBite export (no meals array).");
  }
  const snap = getSnapshot();
  const existing = new Set(snap.meals.map((m) => m.id));
  const incoming = file.meals.map(normalizeMeal).filter((m): m is Meal => !!m);
  const fresh = incoming.filter((m) => !existing.has(m.id));
  write({
    goals: file.goals ? normalizeGoals(file.goals) : snap.goals,
    meals: [...snap.meals, ...fresh],
  });
  return {
    added: fresh.length,
    duplicates: incoming.length - fresh.length,
    invalid: file.meals.length - incoming.length,
  };
}

export function clearAllData() {
  write({ meals: [], goals: DEFAULT_GOALS });
}

// The optional access code is a per-device setting, not part of the export.
export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    if (code) localStorage.setItem(ACCESS_CODE_KEY, code);
    else localStorage.removeItem(ACCESS_CODE_KEY);
  } catch {
    /* ignore */
  }
}
