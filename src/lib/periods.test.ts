// Runs with TZ=America/New_York (see vitest.config.mts): DST starts 2026-03-08, ends 2026-11-01.
import { describe, expect, it } from "vitest";
import {
  aggregateByDay,
  dayKeysInRange,
  dayRange,
  isOnTarget,
  monthRange,
  previousRange,
  shiftRange,
  summarize,
  trailingRange,
  weekRange,
  type DayTotals,
} from "./periods";
import type { Meal } from "./types";

/** Local date (month is 1-based here, unlike Date). */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

let nextId = 0;
function meal(at: Date, calories: number, extra: Partial<Meal> = {}): Meal {
  return {
    id: `m${nextId++}`,
    loggedAt: at.toISOString(),
    name: "Food",
    mealType: "lunch",
    calories,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 2,
    ...extra,
  };
}

describe("ranges", () => {
  it("sanity: the tests run in a timezone with daylight saving", () => {
    expect(local(2026, 1, 15).getTimezoneOffset()).toBe(300);
    expect(local(2026, 7, 15).getTimezoneOffset()).toBe(240);
  });

  it("dayRange covers one local day, as UTC instants", () => {
    const r = dayRange(local(2026, 1, 15, 23, 30));
    expect(r).toMatchObject({ start: "2026-01-15", end: "2026-01-15", days: 1 });
    expect(r.from).toBe("2026-01-15T05:00:00.000Z");
    expect(r.to).toBe("2026-01-16T05:00:00.000Z");
  });

  it("dayRange is 23 hours on the spring-forward day and 25 on the fall-back day", () => {
    const spring = dayRange(local(2026, 3, 8));
    expect(Date.parse(spring.to) - Date.parse(spring.from)).toBe(23 * 3600_000);
    expect(spring.days).toBe(1);
    const fall = dayRange(local(2026, 11, 1));
    expect(Date.parse(fall.to) - Date.parse(fall.from)).toBe(25 * 3600_000);
  });

  it("weekRange runs Monday to Sunday, including when given a Sunday", () => {
    expect(weekRange(local(2026, 11, 11))).toMatchObject({ start: "2026-11-09", end: "2026-11-15", days: 7 });
    expect(weekRange(local(2026, 11, 15))).toMatchObject({ start: "2026-11-09", end: "2026-11-15" });
    expect(weekRange(local(2026, 11, 9, 0, 0))).toMatchObject({ start: "2026-11-09" });
  });

  it("weekRange spans a DST change and a year boundary", () => {
    expect(weekRange(local(2026, 3, 8))).toMatchObject({ start: "2026-03-02", end: "2026-03-08", days: 7 });
    expect(weekRange(local(2027, 1, 1))).toMatchObject({ start: "2026-12-28", end: "2027-01-03", days: 7 });
  });

  it("monthRange knows month lengths and leap years", () => {
    expect(monthRange(local(2026, 2, 10))).toMatchObject({ start: "2026-02-01", end: "2026-02-28", days: 28 });
    expect(monthRange(local(2028, 2, 10))).toMatchObject({ start: "2028-02-01", end: "2028-02-29", days: 29 });
    expect(monthRange(local(2026, 3, 31))).toMatchObject({ start: "2026-03-01", end: "2026-03-31", days: 31 });
  });

  it("trailingRange ends on the given day", () => {
    expect(trailingRange(local(2026, 3, 10), 7)).toMatchObject({ start: "2026-03-04", end: "2026-03-10", days: 7 });
  });

  it("previousRange is the same number of days right before", () => {
    expect(previousRange(weekRange(local(2026, 11, 11)))).toMatchObject({ start: "2026-11-02", end: "2026-11-08" });
    // A month compares against the same number of days before it, not the calendar month:
    // March (31 days) is compared with Jan 29 - Feb 28.
    expect(previousRange(monthRange(local(2026, 3, 5)))).toMatchObject({
      start: "2026-01-29",
      end: "2026-02-28",
      days: 31,
    });
  });

  it("shiftRange moves whole periods", () => {
    const week = weekRange(local(2026, 11, 11));
    expect(shiftRange(week, "week", -1)).toMatchObject({ start: "2026-11-02", end: "2026-11-08" });
    expect(shiftRange(week, "week", 1)).toMatchObject({ start: "2026-11-16" });
    const jan = monthRange(local(2026, 1, 31));
    expect(shiftRange(jan, "month", 1)).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(shiftRange(jan, "month", -1)).toMatchObject({ start: "2025-12-01", end: "2025-12-31" });
    expect(shiftRange(dayRange(local(2026, 3, 8)), "day", 1)).toMatchObject({ start: "2026-03-09" });
  });

  it("dayKeysInRange lists every day once across DST", () => {
    const keys = dayKeysInRange(monthRange(local(2026, 11, 1)));
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-11-01");
    expect(keys[1]).toBe("2026-11-02");
    expect(keys.at(-1)).toBe("2026-11-30");
    expect(new Set(keys).size).toBe(30);
  });
});

describe("aggregateByDay", () => {
  it("buckets meals by local day, fills empty days with zeros, and sorts meals", () => {
    const range = weekRange(local(2026, 11, 11));
    const late = meal(local(2026, 11, 10, 23, 45), 300); // 04:45 UTC on the 11th, still the 10th locally
    const early = meal(local(2026, 11, 10, 8), 500);
    const days = aggregateByDay([late, early, meal(local(2026, 11, 12), 700)], range);

    expect(days).toHaveLength(7);
    const tue = days.find((d) => d.day === "2026-11-10")!;
    expect(tue.calories).toBe(800);
    expect(tue.meals.map((m) => m.id)).toEqual([early.id, late.id]);
    expect(tue.logged).toBe(true);
    const mon = days.find((d) => d.day === "2026-11-09")!;
    expect(mon).toMatchObject({ calories: 0, protein_g: 0, logged: false, meals: [] });
  });

  it("ignores meals outside the range", () => {
    const days = aggregateByDay([meal(local(2026, 11, 20), 900)], weekRange(local(2026, 11, 11)));
    expect(days.every((d) => !d.logged)).toBe(true);
  });
});

describe("summarize", () => {
  const GOAL = 2000;
  /** One day per entry: a number is the calories eaten, null is "nothing logged". */
  function week(...calories: (number | null)[]): DayTotals[] {
    const range = trailingRange(local(2026, 11, 15), calories.length);
    const meals = calories.flatMap((c, i) => {
      if (c === null) return [];
      const date = new Date(range.start + "T12:00:00");
      date.setDate(date.getDate() + i);
      return [meal(date, c)];
    });
    return aggregateByDay(meals, range);
  }

  it("averages over every day in the period, including empty ones", () => {
    const stats = summarize(week(1000, null, 2000, null), GOAL);
    expect(stats.totalCalories).toBe(3000);
    expect(stats.averageCalories).toBe(750);
    expect(stats.bestDay?.calories).toBe(2000);
  });

  it("on target means logged and at or under the goal", () => {
    const [under, over, empty, exact] = week(1500, 2500, null, 2000);
    expect(isOnTarget(under, GOAL)).toBe(true);
    expect(isOnTarget(over, GOAL)).toBe(false);
    expect(isOnTarget(empty, GOAL)).toBe(false);
    expect(isOnTarget(exact, GOAL)).toBe(true);
    expect(isOnTarget(under, 0)).toBe(false);
  });

  it("streak counts back from the end, skipping empty days and stopping at a miss", () => {
    expect(summarize(week(1500, 2500, 1800, null, 1900, null), GOAL).streak).toBe(2);
    expect(summarize(week(1500, 1500, 2600), GOAL).streak).toBe(0);
    expect(summarize(week(null, null), GOAL).streak).toBe(0);
  });

  it("compares the total with the previous period", () => {
    expect(summarize(week(1000, 1000), GOAL, week(500, 500)).changePercent).toBe(100);
    expect(summarize(week(500), GOAL, week(1000)).changePercent).toBe(-50);
    expect(summarize(week(500), GOAL, week(null)).changePercent).toBeNull();
    expect(summarize(week(500), GOAL).changePercent).toBeNull();
  });

  it("has no best day when nothing was logged", () => {
    const stats = summarize(week(null, null, null), GOAL);
    expect(stats.bestDay).toBeUndefined();
    expect(stats.averageCalories).toBe(0);
    expect(stats.daysOnTarget).toBe(0);
  });
});
