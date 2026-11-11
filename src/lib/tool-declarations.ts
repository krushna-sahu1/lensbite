/**
 * Function declarations for the Live agent. Kept apart from the browser-side
 * handlers in tools.ts so the /api/token route can lock them into the
 * ephemeral token (see liveConnectConstraints there).
 */
import { Behavior, Type, type FunctionDeclaration, type Schema } from "@google/genai";
import { MEAL_TYPES } from "./types";

// gemini-3.8-live defaults to NON_BLOCKING (async) tools. We use BLOCKING so the
// model waits for the real result before it says "logged!".
const behavior = Behavior.BLOCKING;

const labelNutrients = (column: string): Schema => ({
  type: Type.OBJECT,
  description: `Values from the label's ${column} column, exactly as printed. Leave out anything the label doesn't print.`,
  properties: {
    calories: { type: Type.NUMBER, description: "Energy in kcal (convert kJ by dividing by 4.184 only if kcal isn't printed)." },
    fat_g: { type: Type.NUMBER },
    saturated_fat_g: { type: Type.NUMBER },
    trans_fat_g: { type: Type.NUMBER },
    carbs_g: { type: Type.NUMBER, description: "Total carbohydrate." },
    sugar_g: { type: Type.NUMBER, description: "Total sugars." },
    added_sugar_g: { type: Type.NUMBER },
    fiber_g: { type: Type.NUMBER },
    protein_g: { type: Type.NUMBER },
    sodium_mg: { type: Type.NUMBER, description: "Sodium in milligrams, if the label lists sodium." },
    salt_g: { type: Type.NUMBER, description: "Salt in grams, if the label lists salt." },
  },
});

const shortList = (description: string): Schema => ({ type: Type.ARRAY, items: { type: Type.STRING }, description });

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "log_meal",
    behavior,
    description:
      "Save a meal or snack to the user's food log. Only call this AFTER the user has confirmed they want it logged. Use single best-estimate numbers (the middle of your range).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Short food name, e.g. 'Chicken burrito bowl'." },
        meal_type: { type: Type.STRING, enum: [...MEAL_TYPES], description: "Which meal this is." },
        calories: { type: Type.NUMBER, description: "Estimated calories (kcal)." },
        protein_g: { type: Type.NUMBER, description: "Estimated protein in grams." },
        carbs_g: { type: Type.NUMBER, description: "Estimated carbohydrates in grams." },
        fat_g: { type: Type.NUMBER, description: "Estimated fat in grams." },
        fiber_g: { type: Type.NUMBER, description: "Estimated fiber in grams." },
        notes: {
          type: Type.STRING,
          description: "Portion size and assumptions, e.g. 'about 1.5 cups, with sour cream; estimate 520-620 kcal'.",
        },
        eaten_at: {
          type: Type.STRING,
          description:
            "When the food was eaten, as local time 'YYYY-MM-DDTHH:MM' (see the local time in CONTEXT). Only set it when the user says they ate it earlier, e.g. 'I had this for breakfast'. Leave it out for food eaten now. At most 7 days ago, never in the future.",
        },
        allow_duplicate: {
          type: Type.BOOLEAN,
          description:
            "Set to true only when the user clearly wants a second, separate entry of something you already logged in the last few minutes.",
        },
      },
      required: ["name", "meal_type", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g"],
    },
  },
  {
    name: "get_today_summary",
    behavior,
    description:
      "Get today's logged meals, totals, daily goals, and what's remaining. Use when the user asks how they're doing today.",
  },
  {
    name: "delete_last_meal",
    behavior,
    description: "Delete the most recently logged meal from today's log (undo).",
  },
  {
    name: "scan_label",
    behavior,
    description:
      "Switch the camera to sharp, high-resolution frames for reading small print. Call this as soon as the user asks you to rate, scan or check a packaged product, or holds up a nutrition label or ingredients list, BEFORE reading any numbers.",
  },
  {
    name: "show_product_rating",
    behavior,
    description:
      "Show your rating of a packaged product as a card on the user's screen (not saved). Call after reading its label, before speaking the verdict. Returns the nutrition normalized per 100 g/ml and per serving.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        product_name: { type: Type.STRING, description: "Product name as on the pack, e.g. 'Chocolate Chip Cookies'." },
        brand: { type: Type.STRING },
        score: { type: Type.NUMBER, description: "Your rating from 0 (avoid) to 10 (excellent). One decimal allowed." },
        verdict: { type: Type.STRING, description: "One short sentence summing up the rating." },
        unit: { type: Type.STRING, enum: ["g", "ml"], description: "'g' for foods, 'ml' for drinks." },
        serving_size: { type: Type.NUMBER, description: "Serving size in g or ml, as printed." },
        serving_description: { type: Type.STRING, description: "Household measure as printed, e.g. '2 cookies'." },
        servings_per_pack: { type: Type.NUMBER },
        per_serving: labelNutrients("per-serving"),
        per_100: labelNutrients("per 100 g / per 100 ml"),
        pros: shortList("Up to 4 short positives, a few words each, e.g. '8 g protein per serving'."),
        cons: shortList(
          "Up to 4 short negatives, a few words each, including misleading claims and unrealistic serving sizes.",
        ),
        ingredient_warnings: shortList(
          "Problem ingredients as named on the pack, with the reason in brackets, e.g. 'Maltodextrin (added sugar)', 'Palm oil', 'Sucralose (sweetener)'. Empty if none.",
        ),
      },
      required: ["product_name", "score", "verdict", "unit", "pros", "cons", "ingredient_warnings"],
    },
  },
];
