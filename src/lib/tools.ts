/**
 * Function-calling tools for the Live agent. Declarations are sent to Gemini in
 * the session config; calls are executed right here in the browser against
 * Supabase (as the signed-in user, so Row Level Security applies), and the
 * result is sent back with session.sendToolResponse().
 */
import {
  Behavior,
  Type,
  type FunctionCall,
  type FunctionDeclaration,
  type FunctionResponse,
  type Schema,
} from "@google/genai";
import { addMeal, deleteLastMealToday, getSnapshot, refresh, type StoreSnapshot } from "./storage";
import { parseProductRating } from "./label";
import { mealsOnDay, remaining, sumNutrients, toNonNegativeNumber } from "./nutrition";
import { MEAL_TYPES, type Meal, type MealType, type ProductRating } from "./types";

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

/** Today's log from a snapshot. Pass a fresh one from refresh() to read straight from Supabase. */
function todaySummary({ meals, goals }: StoreSnapshot = getSnapshot()) {
  const today = mealsOnDay(meals, new Date());
  const totals = sumNutrients(today);
  return {
    meals: today.map((m) => ({
      name: m.name,
      meal_type: m.mealType,
      time: new Date(m.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      fiber_g: m.fiber_g,
    })),
    totals,
    goals,
    remaining: remaining(goals, totals),
  };
}

export interface ToolResult {
  response: FunctionResponse;
  /** Short line for the on-screen transcript, e.g. "Logged Pad Thai · 650 kcal". */
  event?: string;
  /** True when the food log changed. */
  changed?: boolean;
  /** Turn on label mode (sharp frames for reading small print). */
  labelMode?: boolean;
  /** Product card to show on the Live screen. Lives in memory only. */
  product?: ProductRating;
}

/** Executes one function call from the model. Never rejects. */
export async function runTool(call: FunctionCall): Promise<ToolResult> {
  const respond = (response: Record<string, unknown>) => ({ id: call.id, name: call.name, response });
  const args = (call.args ?? {}) as Record<string, unknown>;

  try {
    switch (call.name) {
      case "log_meal": {
        const meal: Meal = await addMeal({
          name: String(args.name ?? "").trim() || "Meal",
          mealType: (MEAL_TYPES as readonly string[]).includes(String(args.meal_type))
            ? (args.meal_type as MealType)
            : "snack",
          calories: toNonNegativeNumber(args.calories),
          protein_g: toNonNegativeNumber(args.protein_g),
          carbs_g: toNonNegativeNumber(args.carbs_g),
          fat_g: toNonNegativeNumber(args.fat_g),
          fiber_g: toNonNegativeNumber(args.fiber_g),
          notes: typeof args.notes === "string" ? args.notes : undefined,
        });
        // addMeal re-read today's log from Supabase, so the snapshot is current.
        const summary = todaySummary();
        return {
          response: respond({
            output: {
              logged: { name: meal.name, meal_type: meal.mealType, calories: meal.calories },
              today_totals: summary.totals,
              remaining: summary.remaining,
            },
          }),
          event: `Logged ${meal.name} · ${meal.calories} kcal`,
          changed: true,
        };
      }

      case "get_today_summary":
        return { response: respond({ output: todaySummary(await refresh()) }) };

      case "delete_last_meal": {
        const removed = await deleteLastMealToday();
        if (!removed) {
          return { response: respond({ output: { deleted: null, message: "No meals logged today." } }) };
        }
        const summary = todaySummary();
        return {
          response: respond({
            output: {
              deleted: { name: removed.name, calories: removed.calories },
              today_totals: summary.totals,
              remaining: summary.remaining,
            },
          }),
          event: `Removed ${removed.name}`,
          changed: true,
        };
      }

      case "scan_label":
        return {
          response: respond({
            output: {
              label_mode: "on",
              tip: "Read only text that is sharp in the frames. If anything is blurry, cut off or unreadable, ask the user to move closer, hold steady or rotate the pack.",
            },
          }),
          labelMode: true,
        };

      case "show_product_rating": {
        const product = parseProductRating(args);
        return {
          response: respond({
            output: {
              shown: true,
              unit: product.unit,
              serving_size: product.servingSize ?? null,
              per_100: product.per100,
              per_serving: product.perServing,
              note: product.servingSize
                ? "Use these normalized numbers for follow-ups and for log_meal."
                : "No serving size, so the missing column couldn't be computed.",
            },
          }),
          event: `Rated ${product.name} · ${product.score}/10`,
          labelMode: true,
          product,
        };
      }

      default:
        return { response: respond({ error: `Unknown function: ${call.name}` }) };
    }
  } catch (err) {
    return { response: respond({ error: err instanceof Error ? err.message : String(err) }) };
  }
}
