/**
 * Quick-logging sources: foods eaten recently, starred (saved) foods, and
 * yesterday's meals. Most people eat the same few dozen things, so these make
 * logging a repeat meal one tap.
 */
import { useEffect, useState } from "react";
import { localDayRange } from "./nutrition";
import { fetchMealsInRange, useStore } from "./storage";
import { createClient } from "./supabase/client";
import type { SavedFoodRow } from "./supabase/database.types";
import { MEAL_TYPES, type Meal, type MealType, type Nutrients } from "./types";

/** A food that can be logged again as is. */
export interface QuickFood extends Nutrients {
  /** Stable key for lists: the saved food id, or the name for recents. */
  key: string;
  name: string;
  mealType?: MealType;
  notes?: string;
  /** Saved food id when this one is starred. */
  savedId?: string;
}

/** How far back "recent" looks. */
const RECENT_DAYS = 45;
const RECENT_LIMIT = 30;

const nameKey = (name: string) => name.trim().toLowerCase();

// Saved-food changes don't touch the meal log, so they have their own tiny signal.
const libraryListeners = new Set<() => void>();
function notifyLibraryChanged() {
  libraryListeners.forEach((l) => l());
}
function subscribeLibrary(listener: () => void) {
  libraryListeners.add(listener);
  return () => {
    libraryListeners.delete(listener);
  };
}

/** The latest entry of each distinct food name, newest first. Pure; see library tests. */
export function dedupeRecent(meals: Meal[], limit = RECENT_LIMIT): QuickFood[] {
  const seen = new Map<string, QuickFood & { count: number; last: string }>();
  for (const meal of meals) {
    const key = nameKey(meal.name);
    const existing = seen.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    seen.set(key, {
      key,
      name: meal.name,
      mealType: meal.mealType,
      notes: meal.notes,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      fiber_g: meal.fiber_g,
      count: 1,
      last: meal.loggedAt,
    });
  }
  return [...seen.values()]
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((entry): QuickFood => {
      const food: QuickFood & { count?: number; last?: string } = { ...entry };
      delete food.count;
      delete food.last;
      return food;
    });
}

function fromSavedRow(row: SavedFoodRow): QuickFood {
  return {
    key: row.id,
    savedId: row.id,
    name: row.name,
    mealType: (MEAL_TYPES as readonly string[]).includes(row.meal_type ?? "") ? (row.meal_type as MealType) : undefined,
    notes: row.notes ?? undefined,
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g),
  };
}

export interface Library {
  recent: QuickFood[];
  saved: QuickFood[];
  yesterday: Meal[];
  loading: boolean;
  error?: string;
  /** False when the saved_foods table isn't there yet (migration not applied). */
  savedAvailable: boolean;
}

const EMPTY: Library = { recent: [], saved: [], yesterday: [], loading: true, savedAvailable: true };

/** Loads the three quick-log lists while `active` is true; reloads after any log or star change. */
export function useLibrary(active: boolean): Library {
  const [state, setState] = useState<Library>(EMPTY);
  const [version, setVersion] = useState(0);
  // Logging, editing or deleting a meal bumps this, so "recent" and "yesterday" stay current.
  const { revision } = useStore();

  useEffect(() => subscribeLibrary(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - RECENT_DAYS);
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const today = localDayRange(now);
        const [recentMeals, saved] = await Promise.all([
          fetchMealsInRange(since.toISOString(), today.to),
          createClient().from("saved_foods").select("*").order("created_at", { ascending: false }).limit(100),
        ]);
        if (cancelled) return;
        const y = localDayRange(yesterday);
        const savedAvailable = !saved.error;
        if (saved.error) console.warn("[library] saved foods unavailable:", saved.error.message);
        setState({
          recent: dedupeRecent([...recentMeals].reverse()),
          saved: (saved.data ?? []).map(fromSavedRow),
          yesterday: recentMeals.filter((m) => m.loggedAt >= y.from && m.loggedAt < y.to),
          loading: false,
          savedAvailable,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, version, revision]);

  return state;
}

/** Stars a food for one-tap logging. Returns the saved id. */
export async function saveFood(food: Omit<QuickFood, "key" | "savedId">): Promise<string> {
  const { data, error } = await createClient()
    .from("saved_foods")
    .insert({
      name: food.name.trim().slice(0, 200),
      meal_type: food.mealType ?? null,
      calories: Math.round(food.calories),
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
      notes: food.notes?.slice(0, 2000) ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't save that food: ${error.message}`);
  notifyLibraryChanged();
  return data.id;
}

export async function unsaveFood(id: string): Promise<void> {
  const { error } = await createClient().from("saved_foods").delete().eq("id", id);
  if (error) throw new Error(`Couldn't remove that food: ${error.message}`);
  notifyLibraryChanged();
}

/** The saved food with this name, if any (names are compared case-insensitively). */
export function findSaved(saved: QuickFood[], name: string): QuickFood | undefined {
  const key = nameKey(name);
  return saved.find((f) => nameKey(f.name) === key);
}
