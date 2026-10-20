/**
 * Supabase-backed store for meals and goals.
 *
 * The cache holds today's meals, the goals and the total meal count. React
 * components read it through `useStore()` (useSyncExternalStore), so the home
 * screen updates as soon as the voice agent logs or deletes a meal. Plain async
 * functions (addMeal, setGoals, ...) can be called from anywhere, including
 * the Live session's tool handlers. Every change is written to Supabase first
 * and then re-read, so the cache always matches the database.
 *
 * Queries run as the signed-in user, and Row Level Security limits them to that
 * user's rows.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import type { MealInsert, MealRow, SettingsRow } from "./supabase/database.types";
import { MEAL_TYPES, type ExportFile, type Goals, type Meal, type MealType } from "./types";
import {
  localDateKey,
  localDayRange,
  NUTRIENT_KEYS,
  roundNutrients,
  sumNutrients,
  toNonNegativeNumber,
} from "./nutrition";

// Keys used by the old localStorage-only version. Only read to move that data into Supabase.
const LEGACY_MEALS_KEY = "lensbite:meals:v1";
const LEGACY_GOALS_KEY = "lensbite:goals:v1";
const LEGACY_ACCESS_CODE_KEY = "lensbite:access-code";

const MEAL_COLUMNS = "id, eaten_at, meal_type, name, calories, protein_g, carbs_g, fat_g, fiber_g, notes";
const SETTINGS_COLUMNS = "calorie_goal, protein_goal, carbs_goal, fat_goal, fiber_goal";
/** PostgREST returns at most 1000 rows per request by default. */
const PAGE_SIZE = 1000;

export const SIGNED_OUT_MESSAGE = "You're signed out. Sign in again to see your food log.";

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein_g: 120,
  carbs_g: 220,
  fat_g: 65,
  fiber_g: 30,
};

export interface StoreSnapshot {
  /** Today's meals (the local day `day`), oldest first. */
  meals: Meal[];
  goals: Goals;
  /** Number of meals saved in the account, all days. */
  mealCount: number;
  /** Local date ("YYYY-MM-DD") that `meals` belongs to. */
  day: string;
  /** Email of the signed-in user. */
  email?: string;
  /** False until the first load from Supabase finishes. */
  loaded: boolean;
  /** Why the last load failed. Cleared by the next successful load. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Cache + loading
// ---------------------------------------------------------------------------

const SERVER_SNAPSHOT: StoreSnapshot = { meals: [], goals: DEFAULT_GOALS, mealCount: 0, day: "", loaded: false };
let cache: StoreSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let started = false;
/** Bumped on every load, so an older load that finishes late can't overwrite a newer one. */
let loadSeq = 0;

function set(next: StoreSnapshot) {
  cache = next;
  notify();
}

function notify() {
  listeners.forEach((l) => l());
}

export function getSnapshot(): StoreSnapshot {
  return cache;
}

type Db = ReturnType<typeof createClient>;

function dbError(error: { message: string; code?: string }): Error {
  // 42501: RLS refused the row. PGRST301: missing or expired JWT. Both mean no valid session.
  if (error.code === "42501" || error.code === "PGRST301") return new Error(SIGNED_OUT_MESSAGE);
  return new Error(`Couldn't reach your food log: ${error.message}`);
}

async function currentUser(db: Db) {
  const { data } = await db.auth.getSession();
  if (!data.session) throw new Error(SIGNED_OUT_MESSAGE);
  return data.session.user;
}

async function load(now: Date): Promise<StoreSnapshot> {
  const db = createClient();
  // Without a session RLS just returns no rows, which would look like an empty log.
  const user = await currentUser(db);
  const { from, to } = localDayRange(now);
  const [meals, settings, count] = await Promise.all([
    db.from("meals").select(MEAL_COLUMNS).gte("eaten_at", from).lt("eaten_at", to).order("eaten_at"),
    db.from("settings").select(SETTINGS_COLUMNS).maybeSingle(),
    db.from("meals").select("id", { count: "exact", head: true }),
  ]);
  for (const { error } of [meals, settings, count]) if (error) throw dbError(error);
  return {
    meals: (meals.data ?? []).map(fromRow),
    goals: goalsFromRow(settings.data),
    mealCount: count.count ?? 0,
    day: localDateKey(now),
    email: user.email,
    loaded: true,
  };
}

/**
 * Re-reads today's meals, the goals and the meal count from Supabase and
 * returns them. If that fails, the cache keeps its data, records the error,
 * and the error is thrown.
 */
export async function refresh(): Promise<StoreSnapshot> {
  const seq = ++loadSeq;
  try {
    const next = await load(new Date());
    if (seq === loadSeq) set(next);
    return next;
  } catch (err) {
    if (seq === loadSeq) set({ ...cache, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Re-read after a successful write. The write already happened, so a failed re-read isn't its error. */
async function reload() {
  await refresh().catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void refresh().catch(() => {});
    // Pick up changes from another tab or device when the app comes back into view.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

/** React hook: today's meals + goals. Starts loading on first use; empty during server rendering. */
export function useStore(): StoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

// ---------------------------------------------------------------------------
// Row mapping + validation (used for tool input, JSON import and DB rows)
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeMealType(value: unknown): MealType {
  const v = String(value ?? "").toLowerCase();
  return (MEAL_TYPES as readonly string[]).includes(v) ? (v as MealType) : "snack";
}

function normalizeMeal(raw: unknown): Meal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // Same limits as the check constraints on public.meals.
  const name = String(r.name ?? "").trim().slice(0, 200);
  const loggedAt = new Date(String(r.loggedAt ?? ""));
  if (!name || Number.isNaN(loggedAt.getTime())) return null;
  return {
    id: typeof r.id === "string" && UUID_PATTERN.test(r.id) ? r.id : crypto.randomUUID(),
    loggedAt: loggedAt.toISOString(),
    name,
    mealType: normalizeMealType(r.mealType),
    notes: typeof r.notes === "string" && r.notes.trim() ? r.notes.trim().slice(0, 2000) : undefined,
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

function fromRow(row: Omit<MealRow, "user_id">): Meal {
  return normalizeMeal({ ...row, loggedAt: row.eaten_at, mealType: row.meal_type, notes: row.notes ?? undefined })!;
}

/** user_id is left out: the database fills it in from the session (and RLS checks it). */
function toRow(meal: Meal): MealInsert {
  return {
    id: meal.id,
    eaten_at: meal.loggedAt,
    meal_type: meal.mealType,
    name: meal.name,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    fiber_g: meal.fiber_g,
    notes: meal.notes ?? null,
  };
}

function goalsFromRow(row: Omit<SettingsRow, "user_id"> | null): Goals {
  if (!row) return DEFAULT_GOALS;
  return normalizeGoals({
    calories: row.calorie_goal,
    protein_g: row.protein_goal,
    carbs_g: row.carbs_goal,
    fat_g: row.fat_goal,
    fiber_g: row.fiber_goal,
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type NewMeal = Omit<Meal, "id" | "loggedAt">;

export async function addMeal(input: NewMeal): Promise<Meal> {
  const meal = normalizeMeal({ ...input, loggedAt: new Date().toISOString() });
  if (!meal) throw new Error("Meal needs a name");
  const { error } = await createClient().from("meals").insert(toRow(meal));
  if (error) throw dbError(error);
  await reload();
  return meal;
}

export async function deleteMeal(id: string) {
  const { error } = await createClient().from("meals").delete().eq("id", id);
  if (error) throw dbError(error);
  await reload();
}

/**
 * Puts a deleted meal back, keeping its original id, so a delete can be undone.
 */
export async function restoreMeal(meal: Meal): Promise<void> {
  const { error } = await createClient().from("meals").upsert(toRow(meal), { onConflict: "id" });
  if (error) throw dbError(error);
  await reload();
}

/** Removes the most recently eaten meal from *today*. Returns it, or null if none. */
export async function deleteLastMealToday(): Promise<Meal | null> {
  const db = createClient();
  const { from, to } = localDayRange(new Date());
  const { data, error } = await db
    .from("meals")
    .select(MEAL_COLUMNS)
    .gte("eaten_at", from)
    .lt("eaten_at", to)
    .order("eaten_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) return null;
  await deleteMeal(data.id);
  return fromRow(data);
}

export async function setGoals(goals: Partial<Goals>) {
  const db = createClient();
  const next = normalizeGoals({ ...cache.goals, ...goals });
  const { error } = await db.from("settings").upsert({
    user_id: (await currentUser(db)).id,
    calorie_goal: next.calories,
    protein_goal: next.protein_g,
    carbs_goal: next.carbs_g,
    fat_goal: next.fat_g,
    fiber_goal: next.fiber_g,
  });
  if (error) throw dbError(error);
  await reload();
}

async function fetchAllMeals(db: Db): Promise<Meal[]> {
  const meals: Meal[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("meals")
      .select(MEAL_COLUMNS)
      .order("eaten_at")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw dbError(error);
    meals.push(...data.map(fromRow));
    if (data.length < PAGE_SIZE) return meals;
  }
}

export async function exportData(): Promise<string> {
  const db = createClient();
  const [meals, { goals }] = await Promise.all([fetchAllMeals(db), refresh()]);
  const file: ExportFile = {
    app: "lensbite",
    version: 1,
    exportedAt: new Date().toISOString(),
    goals,
    meals,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Imports a previously exported file. Meals are merged by id (existing ones are
 * kept), and goals are replaced if the file contains them.
 */
export async function importData(json: string): Promise<{ added: number; duplicates: number; invalid: number }> {
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
  const incoming = file.meals.map(normalizeMeal).filter((m): m is Meal => !!m);

  const db = createClient();
  let added = 0;
  for (let i = 0; i < incoming.length; i += PAGE_SIZE) {
    const { data, error } = await db
      .from("meals")
      .upsert(incoming.slice(i, i + PAGE_SIZE).map(toRow), { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw dbError(error);
    added += data.length; // only rows that were actually inserted come back
  }
  if (file.goals) await setGoals(normalizeGoals(file.goals));
  else await reload();

  return {
    added,
    duplicates: incoming.length - added,
    invalid: file.meals.length - incoming.length,
  };
}

/** Deletes every meal and the goals of the signed-in user. */
export async function clearAllData() {
  const db = createClient();
  const userId = (await currentUser(db)).id;
  const results = await Promise.all([
    db.from("meals").delete().eq("user_id", userId),
    db.from("settings").delete().eq("user_id", userId),
  ]);
  for (const { error } of results) if (error) throw dbError(error);
  await reload();
}

// ---------------------------------------------------------------------------
// Date ranges and aggregation (the Insights screen)
// ---------------------------------------------------------------------------

/** The periods the Insights screen can show. */
export type Period = "day" | "week" | "month";

export interface DateRange {
  /** Local date key ("YYYY-MM-DD") of the first day in the range. */
  start: string;
  /** Local date key of the last day in the range (inclusive). */
  end: string;
  /** ISO timestamp of the first moment of the range. */
  from: string;
  /** ISO timestamp of the first moment *after* the range (exclusive). */
  to: string;
  /** Number of calendar days in the range. */
  days: number;
}

/** Parses a local date key back into a local Date (never a UTC one). */
export function localDateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Days between two local dates, ignoring daylight saving changes. */
function dayCount(start: Date, end: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(end) - utc(start)) / 86_400_000) + 1;
}

/** Builds a range from two local date keys. */
function rangeFromKeys(start: string, end: string): DateRange {
  const startDate = localDateFromKey(start);
  const endDate = localDateFromKey(end);
  const dayAfter = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
  return {
    start,
    end,
    from: startDate.toISOString(),
    to: dayAfter.toISOString(),
    days: dayCount(startDate, endDate),
  };
}

/** The local calendar day that contains `date`. */
export function dayRange(date: Date): DateRange {
  const key = localDateKey(date);
  return rangeFromKeys(key, key);
}

/** The local week (Monday to Sunday) that contains `date`. */
export function weekRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is 0 for Sunday; shift so Monday is the first day of the week.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return rangeFromKeys(localDateKey(start), localDateKey(end));
}

/** The local month (1st to the last day of the month) that contains `date`. */
export function monthRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return rangeFromKeys(localDateKey(start), localDateKey(end));
}

/** The range of a period, anchored on `date`. */
export function rangeFor(period: Period, date: Date): DateRange {
  if (period === "day") return dayRange(date);
  if (period === "week") return weekRange(date);
  return monthRange(date);
}

/** The last `count` days, ending with the day that contains `date`. */
export function trailingRange(date: Date, count: number): DateRange {
  const end = localDateFromKey(localDateKey(date));
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (count - 1));
  return rangeFromKeys(localDateKey(start), localDateKey(end));
}

/** The range right before `range`, with the same number of days. */
export function previousRange(range: DateRange): DateRange {
  const start = localDateFromKey(range.start);
  const previousEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const previousStart = new Date(
    previousEnd.getFullYear(),
    previousEnd.getMonth(),
    previousEnd.getDate() - (range.days - 1),
  );
  return rangeFromKeys(localDateKey(previousStart), localDateKey(previousEnd));
}

/** Moves a range one period forwards or backwards. */
export function shiftRange(range: DateRange, period: Period, direction: 1 | -1): DateRange {
  const anchor = localDateFromKey(range.start);
  const shifted = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (period === "week") shifted.setDate(shifted.getDate() + 7 * direction);
  else if (period === "month") shifted.setMonth(shifted.getMonth() + direction);
  else shifted.setDate(shifted.getDate() + direction);
  return rangeFor(period, shifted);
}

/** Every local date key in the range, in order. */
export function dayKeysInRange(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = localDateFromKey(range.start);
  for (let i = 0; i < range.days; i++) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export interface DayTotals {
  /** Local date key ("YYYY-MM-DD"). */
  day: string;
  /** The local date, for weekday labels. */
  date: Date;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** The meals logged that day, oldest first. */
  meals: Meal[];
  /** True when at least one meal was logged. */
  logged: boolean;
}

/**
 * Groups meals by local day inside the range. Days without any meal are kept
 * and filled with zeros, so charts always show the full period.
 */
export function aggregateByDay(meals: Meal[], range: DateRange): DayTotals[] {
  const byDay = new Map<string, Meal[]>();
  for (const meal of meals) {
    const key = localDateKey(new Date(meal.loggedAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(meal);
    else byDay.set(key, [meal]);
  }

  const days: DayTotals[] = [];
  const cursor = localDateFromKey(range.start);
  for (let i = 0; i < range.days; i++) {
    const key = localDateKey(cursor);
    const dayMeals = (byDay.get(key) ?? []).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    days.push({
      day: key,
      date: new Date(cursor),
      ...sumNutrients(dayMeals),
      meals: dayMeals,
      logged: dayMeals.length > 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** A day counts as "on target" when it has meals and stays within the goal. */
export function isOnTarget(day: DayTotals, calorieGoal: number): boolean {
  return day.logged && calorieGoal > 0 && day.calories > 0 && day.calories <= calorieGoal;
}

export interface PeriodStats {
  /** Mean calories per day across the whole range (days without meals count as 0). */
  averageCalories: number;
  /** Total calories in the range. */
  totalCalories: number;
  /** The day with the most calories, if anything was logged. */
  bestDay?: DayTotals;
  /** Days that hit the calorie goal without going over it. */
  daysOnTarget: number;
  /** Consecutive on-target days ending at the last day with meals in the range. */
  streak: number;
  /** Percent change of the total vs. the previous period (null when there is nothing to compare). */
  changePercent: number | null;
}

/** Rolls a period up into the numbers shown on the Insights screen. */
export function summarize(days: DayTotals[], calorieGoal: number, previous?: DayTotals[]): PeriodStats {
  const totalCalories = days.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = days.length ? Math.round(totalCalories / days.length) : 0;
  const daysOnTarget = days.filter((day) => isOnTarget(day, calorieGoal)).length;

  let bestDay: DayTotals | undefined;
  for (const day of days) {
    if (day.calories > 0 && (!bestDay || day.calories > bestDay.calories)) bestDay = day;
  }

  // The streak walks back from the end of the range. Days without any meals
  // haven't happened yet, so they don't break it; a day that missed the goal does.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (!day.logged) continue;
    if (!isOnTarget(day, calorieGoal)) break;
    streak++;
  }

  let changePercent: number | null = null;
  if (previous) {
    const previousTotal = previous.reduce((sum, day) => sum + day.calories, 0);
    if (previousTotal > 0) changePercent = Math.round(((totalCalories - previousTotal) / previousTotal) * 100);
  }

  return { averageCalories, totalCalories, bestDay, daysOnTarget, streak, changePercent };
}

/** Every meal inside a local date range, oldest first. */
export async function fetchMealsInRange(from: string, to: string): Promise<Meal[]> {
  const db = createClient();
  const meals: Meal[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("meals")
      .select(MEAL_COLUMNS)
      .gte("eaten_at", from)
      .lt("eaten_at", to)
      .order("eaten_at")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw dbError(error);
    meals.push(...data.map(fromRow));
    if (data.length < PAGE_SIZE) return meals;
  }
}

export interface RangeMeals {
  meals: Meal[];
  /** True while the range is being read. */
  loading: boolean;
  /** Why the last read failed. */
  error?: string;
}

/**
 * Reads the meals in a local date range. `revision` changes whenever the food
 * log changes, so the range is re-read after a meal is logged or deleted.
 */
export function useMealsInRange(from: string, to: string, revision = 0): RangeMeals {
  const key = `${from}|${to}|${revision}`;
  const [state, setState] = useState<{ key: string; meals: Meal[]; error?: string }>({ key: "", meals: [] });

  useEffect(() => {
    // An empty range means "not ready yet" - don't read the whole table.
    if (!from || !to) return;
    let cancelled = false;
    fetchMealsInRange(from, to)
      .then((meals) => {
        if (!cancelled) setState({ key, meals });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          key,
          meals: [],
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, key]);

  // The data belongs to a range that is no longer on screen.
  if (state.key !== key) return { meals: [], loading: true };
  return { meals: state.meals, loading: false, error: state.error };
}

// ---------------------------------------------------------------------------
// Data from the old localStorage-only version
// ---------------------------------------------------------------------------

function readLegacy<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function legacyMealCount(): number {
  const meals = readLegacy<unknown>(LEGACY_MEALS_KEY, []);
  return Array.isArray(meals) ? meals.length : 0;
}

/** React hook: how many meals the old version left in this browser's localStorage. */
export function useLegacyMealCount(): number {
  return useSyncExternalStore(subscribe, legacyMealCount, () => 0);
}

/** Copies meals and goals from this browser's localStorage into Supabase, then removes them locally. */
export async function importLegacyData() {
  const result = await importData(
    JSON.stringify({
      meals: readLegacy<unknown[]>(LEGACY_MEALS_KEY, []),
      goals: readLegacy<Goals | undefined>(LEGACY_GOALS_KEY, undefined),
    }),
  );
  try {
    [LEGACY_MEALS_KEY, LEGACY_GOALS_KEY, LEGACY_ACCESS_CODE_KEY].forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
  notify();
  return result;
}
