// Runs with TZ=America/New_York (see vitest.config.mts).
import { describe, expect, it } from "vitest";
import { sanitizeAnalyzeResult, scaleItem } from "./analyze";
import { formatWeight, maintenanceCalories, planGoals, restingEnergy, toKg, type BodyProfile } from "./energy";
import { isValidBarcode, nutrientsForAmount, parseOffProduct } from "./openfoodfacts";
import { computeTrend, daysBetween, summarizeTrend } from "./weight-trend";

describe("energy", () => {
  const base: BodyProfile = {
    sex: "female",
    age: 30,
    heightCm: 165,
    weightKg: 65,
    activity: "light",
    goal: "maintain",
    weeklyRateKg: 0,
  };

  it("computes Mifflin-St Jeor resting energy", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(restingEnergy(base)).toBeCloseTo(1370.25);
    expect(restingEnergy({ ...base, sex: "male" })).toBeCloseTo(1536.25);
    expect(maintenanceCalories(base)).toBeCloseTo(1370.25 * 1.375);
  });

  it("plans maintenance goals with macros that add up", () => {
    const { goals, maintenance, floored } = planGoals(base);
    expect(maintenance).toBe(1880);
    expect(goals.calories).toBe(1880);
    expect(floored).toBe(false);
    const kcalFromMacros = goals.protein_g * 4 + goals.carbs_g * 4 + goals.fat_g * 9;
    expect(Math.abs(kcalFromMacros - goals.calories)).toBeLessThan(40);
    expect(goals.protein_g).toBe(105); // 65 kg * 1.6
    expect(goals.fiber_g).toBeGreaterThanOrEqual(25);
  });

  it("subtracts the deficit for the weekly rate, but never below the floor", () => {
    const lose = planGoals({ ...base, goal: "lose", weeklyRateKg: -0.5 });
    expect(lose.goals.calories).toBe(1330); // 1884 - 550
    expect(lose.goals.protein_g).toBe(115); // 65 * 1.8 = 117 -> nearest 5
    const tooFast = planGoals({ ...base, goal: "lose", weeklyRateKg: -1, activity: "sedentary" });
    expect(tooFast.goals.calories).toBe(1200);
    expect(tooFast.floored).toBe(true);
  });

  it("caps the protein reference weight for very heavy bodies", () => {
    const { goals } = planGoals({ ...base, weightKg: 150 });
    // BMI-27 weight at 1.65 m is ~73.5 kg -> 73.5 * 1.6 = 117.6 -> 120
    expect(goals.protein_g).toBe(120);
  });

  it("converts units", () => {
    expect(toKg(150, "imperial")).toBeCloseTo(68.04, 2);
    expect(formatWeight(68.0389, "imperial")).toBe("150.0 lb");
    expect(formatWeight(68.04, "metric")).toBe("68.0 kg");
  });
});

describe("weight trend", () => {
  it("starts at the first weigh-in and moves 10% per day toward new ones", () => {
    const points = computeTrend([
      { day: "2026-11-02", kg: 80 },
      { day: "2026-11-01", kg: 80 },
      { day: "2026-11-03", kg: 70 },
    ]);
    expect(points.map((p) => p.day)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(points[0].trend).toBe(80);
    expect(points[2].trend).toBe(79);
  });

  it("catches up faster after a gap", () => {
    const [, gap] = computeTrend([
      { day: "2026-11-01", kg: 80 },
      { day: "2026-11-11", kg: 70 },
    ]);
    // 1 - 0.9^10 = 0.6513 of the way
    expect(gap.trend).toBeCloseTo(73.49, 2);
  });

  it("counts days across DST", () => {
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("summarizes rate over the window, and stays quiet with under a week of data", () => {
    expect(summarizeTrend([])).toBeNull();
    const short = summarizeTrend(computeTrend([{ day: "2026-11-01", kg: 80 }, { day: "2026-11-04", kg: 79 }]));
    expect(short?.weeklyRate).toBeNull();

    const entries = Array.from({ length: 29 }, (_, i) => {
      const d = new Date(2026, 9, 1 + i);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { day, kg: 80 - i * 0.1 };
    });
    const summary = summarizeTrend(computeTrend(entries))!;
    expect(summary.change).toBeLessThan(0);
    expect(summary.weeklyRate).toBeLessThan(0);
    expect(summary.weeklyRate).toBeGreaterThan(-0.7);
  });
});

describe("Open Food Facts", () => {
  // Trimmed from the real response for 3017620422003 (Nutella 400 g).
  const nutella = {
    product_name: "Nutella",
    brands: "Ferrero, Nutella",
    quantity: "400 g",
    nutriscore_grade: "e",
    nova_group: 4,
    nutriments: {
      "energy-kcal_100g": 539,
      "energy-kj_100g": 2252,
      fat_100g: 30.9,
      "saturated-fat_100g": 10.6,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
      "added-sugars_100g": 52.13,
      fiber_100g: 0,
      proteins_100g: 6.3,
      salt_100g: 0.107,
      sodium_100g: 0.0428,
    },
  };

  it("validates barcodes", () => {
    expect(isValidBarcode("3017620422003")).toBe(true);
    expect(isValidBarcode("12345678")).toBe(true);
    expect(isValidBarcode("012345678905")).toBe(true);
    expect(isValidBarcode("123")).toBe(false);
    expect(isValidBarcode("30176204220ab")).toBe(false);
  });

  it("maps nutriments and converts sodium from grams", () => {
    const p = parseOffProduct("3017620422003", nutella)!;
    expect(p).toMatchObject({ name: "Nutella", brand: "Ferrero", unit: "g", nutriscore: "e", nova: 4 });
    expect(p.per100).toMatchObject({ calories: 539, fat_g: 30.9, sugar_g: 56.3, protein_g: 6.3, fiber_g: 0, sodium_mg: 43 });
    expect(p.servingSize).toBeUndefined();
    expect(p.perServing).toEqual({});
    expect(nutrientsForAmount(p, 15)).toMatchObject({ calories: 81, sugar_g: 8.4 });
  });

  it("fills the serving column from the serving size", () => {
    const p = parseOffProduct("1", { ...nutella, serving_quantity: "15", serving_size: "15 g" })!;
    expect(p.servingSize).toBe(15);
    expect(p.perServing.calories).toBe(81);
  });

  it("uses kJ when kcal is missing, detects drinks, and rejects unusable products", () => {
    const drink = parseOffProduct("1", {
      product_name: "Cola",
      quantity: "330 ml",
      nutriments: { "energy-kj_100g": 180, sugars_100g: 10.6 },
    })!;
    expect(drink.unit).toBe("ml");
    expect(drink.per100.calories).toBe(43);
    expect(parseOffProduct("1", { product_name: "Mystery", nutriments: {} })).toBeNull();
    expect(parseOffProduct("1", { nutriments: { "energy-kcal_100g": 100 } })).toBeNull();
    expect(parseOffProduct("1", null)).toBeNull();
  });
});

describe("analyze results", () => {
  it("cleans up model output", () => {
    const result = sanitizeAnalyzeResult({
      items: [
        {
          name: " Scrambled eggs ",
          portion: "2 large eggs",
          calories: 200,
          calories_low: 240, // swapped with high
          calories_high: 170,
          protein_g: 13.04,
          carbs_g: "2",
          fat_g: -5,
          fiber_g: null,
          confidence: "very high",
        },
        { name: "", calories: 100 },
        "junk",
      ],
      question: "  Was it cooked in butter?  ",
    });
    expect(result.question).toBe("Was it cooked in butter?");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: "Scrambled eggs",
      calories: 200,
      caloriesLow: 170,
      caloriesHigh: 240,
      protein_g: 13,
      carbs_g: 2,
      fat_g: 0,
      fiber_g: 0,
      confidence: "medium",
    });
  });

  it("returns an empty list for garbage", () => {
    expect(sanitizeAnalyzeResult("nope")).toEqual({ items: [] });
    expect(sanitizeAnalyzeResult({ items: [], question: "" })).toEqual({ items: [] });
  });

  it("scales a portion", () => {
    const [item] = sanitizeAnalyzeResult({
      items: [{ name: "Rice", calories: 200, calories_low: 180, calories_high: 230, protein_g: 4.3, carbs_g: 44, fat_g: 0.4, fiber_g: 0.6 }],
    }).items;
    expect(scaleItem(item, 1.5)).toMatchObject({ calories: 300, caloriesLow: 270, caloriesHigh: 345, protein_g: 6.5, carbs_g: 66 });
  });
});
