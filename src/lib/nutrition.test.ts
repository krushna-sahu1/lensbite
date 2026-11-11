// Runs with TZ=America/New_York (see vitest.config.mts).
import { describe, expect, it } from "vitest";
import { mealTypeForTime, parseLocalDateTime, toLocalInputValue } from "./nutrition";

describe("parseLocalDateTime", () => {
  it("reads YYYY-MM-DDTHH:MM as local time", () => {
    const d = parseLocalDateTime("2026-11-11T08:30")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 11, 8, 30]);
    expect(d.toISOString()).toBe("2026-11-11T13:30:00.000Z");
  });

  it("accepts seconds and a space separator", () => {
    expect(parseLocalDateTime("2026-11-11 08:30:15")?.getSeconds()).toBe(15);
  });

  it("honors an explicit timezone", () => {
    expect(parseLocalDateTime("2026-11-11T08:30:00Z")?.toISOString()).toBe("2026-11-11T08:30:00.000Z");
    expect(parseLocalDateTime("2026-11-11T08:30:00+02:00")?.toISOString()).toBe("2026-11-11T06:30:00.000Z");
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(parseLocalDateTime("2026-02-31T12:00")).toBeNull();
    expect(parseLocalDateTime("2026-11-11T24:00")).toBeNull();
    expect(parseLocalDateTime("2026-11-11T12:60")).toBeNull();
  });

  it("rejects things that aren't a date-time", () => {
    for (const bad of ["", "yesterday", "12:30", "2026-11-11", "11/11/2026 12:00"]) {
      expect(parseLocalDateTime(bad)).toBeNull();
    }
  });

  it("accepts a time that falls in the spring-forward gap", () => {
    // 02:30 doesn't exist on 2026-03-08 in New York; the browser moves it to 03:30.
    expect(parseLocalDateTime("2026-03-08T02:30")?.getHours()).toBe(3);
  });
});

describe("toLocalInputValue", () => {
  it("round-trips with parseLocalDateTime", () => {
    const d = new Date(2026, 0, 5, 7, 4);
    expect(toLocalInputValue(d)).toBe("2026-01-05T07:04");
    expect(parseLocalDateTime(toLocalInputValue(d))?.getTime()).toBe(d.getTime());
  });
});

describe("mealTypeForTime", () => {
  it("follows the time of day", () => {
    expect(mealTypeForTime(new Date(2026, 0, 1, 7))).toBe("breakfast");
    expect(mealTypeForTime(new Date(2026, 0, 1, 13))).toBe("lunch");
    expect(mealTypeForTime(new Date(2026, 0, 1, 16, 30))).toBe("snack");
    expect(mealTypeForTime(new Date(2026, 0, 1, 19))).toBe("dinner");
    expect(mealTypeForTime(new Date(2026, 0, 1, 2))).toBe("snack");
  });
});
