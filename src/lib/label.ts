/**
 * Packaged-food label helpers: turn what the agent read off a label into a
 * ProductRating, filling in per-100 g / per-serving columns the pack didn't print,
 * and flag nutrients with UK FSA-style traffic-light thresholds for the card.
 */
import { round1 } from "./nutrition";
import type { LabelNutrients, ProductRating } from "./types";

export const LABEL_NUTRIENT_KEYS = [
  "calories",
  "fat_g",
  "saturated_fat_g",
  "trans_fat_g",
  "carbs_g",
  "sugar_g",
  "added_sugar_g",
  "fiber_g",
  "protein_g",
  "sodium_mg",
  "salt_g",
] as const satisfies readonly (keyof LabelNutrients)[];

/** 1 g of salt contains about 400 mg of sodium. */
const SODIUM_MG_PER_SALT_G = 400;

/** Things the user says that mean "I'm showing you a label" (checked on the live transcript). */
export const LABEL_REQUEST_PATTERN = /\b(rate|rating|label|ingredients?|nutrition (facts|table|info)|scan)\b/i;

/** Like toNonNegativeNumber, but keeps "not printed" (undefined) apart from 0. */
function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseNutrients(raw: unknown): LabelNutrients {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: LabelNutrients = {};
  for (const key of LABEL_NUTRIENT_KEYS) {
    const n = optionalNumber(r[key]);
    if (n !== undefined) out[key] = n;
  }
  // Labels print either salt or sodium; derive the other.
  if (out.sodium_mg === undefined && out.salt_g !== undefined) out.sodium_mg = out.salt_g * SODIUM_MG_PER_SALT_G;
  if (out.salt_g === undefined && out.sodium_mg !== undefined) out.salt_g = out.sodium_mg / SODIUM_MG_PER_SALT_G;
  return out;
}

function scale(n: LabelNutrients, factor: number): LabelNutrients {
  const out: LabelNutrients = {};
  for (const key of LABEL_NUTRIENT_KEYS) {
    const v = n[key];
    if (v !== undefined) out[key] = v * factor;
  }
  return out;
}

function roundLabel(n: LabelNutrients): LabelNutrients {
  const out: LabelNutrients = {};
  for (const key of LABEL_NUTRIENT_KEYS) {
    const v = n[key];
    if (v === undefined) continue;
    if (key === "calories" || key === "sodium_mg") out[key] = Math.round(v);
    else if (key === "salt_g") out[key] = Math.round(v * 100) / 100;
    else out[key] = round1(v);
  }
  return out;
}

/**
 * Builds a ProductRating from show_product_rating's arguments. Values the label
 * printed are kept as-is; the missing column is computed from the serving size.
 */
export function parseProductRating(args: Record<string, unknown>): ProductRating {
  const servingSize = optionalNumber(args.serving_size) || undefined;
  const printedServing = parseNutrients(args.per_serving);
  const printed100 = parseNutrients(args.per_100);
  const fromServing = servingSize ? scale(printedServing, 100 / servingSize) : {};
  const from100 = servingSize ? scale(printed100, servingSize / 100) : {};

  const list = (value: unknown) =>
    Array.isArray(value) ? value.map((s) => String(s).trim()).filter(Boolean) : [];

  return {
    ratedAt: Date.now(),
    name: String(args.product_name ?? "").trim() || "This product",
    brand: typeof args.brand === "string" && args.brand.trim() ? args.brand.trim() : undefined,
    score: round1(Math.min(10, optionalNumber(args.score) ?? 0)),
    verdict: String(args.verdict ?? "").trim(),
    unit: args.unit === "ml" ? "ml" : "g",
    servingSize,
    servingDescription:
      typeof args.serving_description === "string" && args.serving_description.trim()
        ? args.serving_description.trim()
        : undefined,
    servingsPerPack: optionalNumber(args.servings_per_pack) || undefined,
    // Printed values win over computed ones.
    per100: roundLabel({ ...fromServing, ...printed100 }),
    perServing: roundLabel({ ...from100, ...printedServing }),
    pros: list(args.pros),
    cons: list(args.cons),
    ingredientWarnings: list(args.ingredient_warnings),
  };
}

export type NutrientLevel = "good" | "medium" | "bad";

/** [low at or below, high above] per 100 g (food) / per 100 ml (drinks). UK FSA front-of-pack criteria. */
const LIMITS: Partial<Record<keyof LabelNutrients, { food: [number, number]; drink: [number, number] }>> = {
  fat_g: { food: [3, 17.5], drink: [1.5, 8.75] },
  saturated_fat_g: { food: [1.5, 5], drink: [0.75, 2.5] },
  sugar_g: { food: [5, 22.5], drink: [2.5, 11.25] },
  sodium_mg: { food: [120, 600], drink: [120, 300] },
};

/** Traffic-light level for one nutrient per 100 g/ml, or undefined when it isn't rated. */
export function nutrientLevel(key: keyof LabelNutrients, per100: LabelNutrients, unit: "g" | "ml"): NutrientLevel | undefined {
  const v = per100[key];
  if (v === undefined) return undefined;
  const limits = LIMITS[key];
  if (limits) {
    const [low, high] = unit === "ml" ? limits.drink : limits.food;
    return v <= low ? "good" : v > high ? "bad" : "medium";
  }
  switch (key) {
    case "trans_fat_g":
      return v > 0 ? "bad" : "good";
    case "added_sugar_g": {
      // Any added sugar is worth noticing; past the total-sugar "high" line it's red.
      const [, high] = unit === "ml" ? LIMITS.sugar_g!.drink : LIMITS.sugar_g!.food;
      return v === 0 ? "good" : v > high ? "bad" : "medium";
    }
    case "fiber_g":
      // EU "source of fiber" is 3 g per 100 g.
      return v >= 3 ? "good" : undefined;
    case "protein_g": {
      // EU "source of protein": at least 12% of energy from protein.
      const kcal = per100.calories;
      return kcal && (v * 4) / kcal >= 0.12 ? "good" : undefined;
    }
    default:
      return undefined;
  }
}

export function scoreLevel(score: number): NutrientLevel {
  return score >= 7 ? "good" : score >= 4 ? "medium" : "bad";
}
