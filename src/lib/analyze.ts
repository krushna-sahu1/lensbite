/**
 * "Describe it or snap it" logging: the shape /api/analyze returns, the
 * response schema it asks Gemini for, and the sanitizer that turns the model's
 * JSON into safe numbers. Shared by the route and the browser.
 */
import { Type, type Schema } from "@google/genai";
import { round1, toNonNegativeNumber } from "./nutrition";

export type Confidence = "low" | "medium" | "high";

/** One food the model recognized, with a best estimate and a calorie range. */
export interface AnalyzedItem {
  name: string;
  /** Portion the estimate assumes, e.g. "1 cup (about 200 g)". */
  portion: string;
  calories: number;
  caloriesLow: number;
  caloriesHigh: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: Confidence;
}

export interface AnalyzeResult {
  items: AnalyzedItem[];
  /** One short question whose answer would change the estimate a lot, if any. */
  question?: string;
}

/** Limits enforced by the route (and checked early in the browser). */
export const ANALYZE_TEXT_MAX = 1000;
/** Base64 length of the largest photo accepted (~3 MB of JPEG). */
export const ANALYZE_IMAGE_MAX_BASE64 = 4_000_000;
/** Longest edge the browser scales photos to before uploading. */
export const ANALYZE_IMAGE_MAX_EDGE = 1280;

export const ANALYZE_SYSTEM_INSTRUCTION = `You estimate the nutrition of food for a calorie-tracking app. The user describes what they ate, sends a photo of it, or both.

- List each distinct food or drink as its own item (e.g. "2 scrambled eggs", "buttered toast", "latte"). Combine only things that are naturally one dish.
- For each item give the portion you assumed in plain words with an approximate weight or volume, a best-estimate calorie value, a realistic low-high calorie range, and protein, carbs, fat and fiber in grams for that portion.
- Use the user's words for quantities and brands when given. From a photo, judge portion size from the plate, cutlery, hands and packaging.
- People and AI both tend to underestimate. Count cooking oil, butter, dressings, sauces, sugar in drinks, and restaurant-size portions unless the user says otherwise. When unsure, pick the realistic middle, not the low end.
- confidence: "high" for packaged or precisely described food, "medium" for a clear photo or ordinary description, "low" when the portion or contents are guesses.
- If one detail would change the total by more than about 30% (portion size, how it was cooked, a sugary vs diet drink), put one short question for the user in "question". Still give your best estimate.
- If there is no food or drink in the input, return an empty items list and say so in "question".
- Item names: short and specific, in the user's language, without the quantity when the portion field already has it.`;

const number = (description: string): Schema => ({ type: Type.NUMBER, description });

export const ANALYZE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          portion: { type: Type.STRING, description: "Assumed portion, e.g. '1 cup (about 200 g)'." },
          calories: number("Best estimate in kcal."),
          calories_low: number("Low end of a realistic range, kcal."),
          calories_high: number("High end of a realistic range, kcal."),
          protein_g: number("Protein in grams."),
          carbs_g: number("Carbohydrates in grams."),
          fat_g: number("Fat in grams."),
          fiber_g: number("Fiber in grams."),
          confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
        },
        required: ["name", "portion", "calories", "calories_low", "calories_high", "protein_g", "carbs_g", "fat_g", "fiber_g", "confidence"],
        propertyOrdering: ["name", "portion", "calories", "calories_low", "calories_high", "protein_g", "carbs_g", "fat_g", "fiber_g", "confidence"],
      },
    },
    question: { type: Type.STRING, description: "Optional clarifying question. Empty when none is needed." },
  },
  required: ["items"],
  propertyOrdering: ["items", "question"],
};

/** At most this many items are kept from one answer. */
const MAX_ITEMS = 12;

/** Turns the model's JSON (already parsed) into a clean AnalyzeResult. Never throws. */
export function sanitizeAnalyzeResult(raw: unknown): AnalyzeResult {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(r.items) ? r.items : [];
  const items: AnalyzedItem[] = [];
  for (const entry of list.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const name = String(e.name ?? "").trim().slice(0, 200);
    if (!name) continue;
    const calories = Math.round(toNonNegativeNumber(e.calories));
    // Keep the range around the estimate even if the model got the order wrong.
    const a = Math.round(toNonNegativeNumber(e.calories_low));
    const b = Math.round(toNonNegativeNumber(e.calories_high));
    const low = Math.min(a || calories, b || calories, calories);
    const high = Math.max(a, b, calories);
    const confidence = e.confidence === "low" || e.confidence === "high" ? e.confidence : "medium";
    items.push({
      name,
      portion: String(e.portion ?? "").trim().slice(0, 200),
      calories,
      caloriesLow: low,
      caloriesHigh: high,
      protein_g: round1(toNonNegativeNumber(e.protein_g)),
      carbs_g: round1(toNonNegativeNumber(e.carbs_g)),
      fat_g: round1(toNonNegativeNumber(e.fat_g)),
      fiber_g: round1(toNonNegativeNumber(e.fiber_g)),
      confidence,
    });
  }
  const question = typeof r.question === "string" ? r.question.trim().slice(0, 300) : "";
  return question ? { items, question } : { items };
}

/** Scales an item to a different portion (e.g. 1.5x), rounding like the food log does. */
export function scaleItem(item: AnalyzedItem, factor: number): AnalyzedItem {
  return {
    ...item,
    calories: Math.round(item.calories * factor),
    caloriesLow: Math.round(item.caloriesLow * factor),
    caloriesHigh: Math.round(item.caloriesHigh * factor),
    protein_g: round1(item.protein_g * factor),
    carbs_g: round1(item.carbs_g * factor),
    fat_g: round1(item.fat_g * factor),
    fiber_g: round1(item.fiber_g * factor),
  };
}
