/**
 * Date ranges and per-day aggregation for the Insights screen and the home
 * sparkline. Pure functions (no Supabase, no React), all in the device's local
 * timezone, so they can be unit-tested: see periods.test.ts.
 */
import { localDateKey, sumNutrients } from "./nutrition";
import type { Meal } from "./types";

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
