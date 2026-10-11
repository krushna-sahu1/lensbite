/**
 * Function-calling tools for the Live agent. Declarations are sent to Gemini in
 * the session config; calls are executed right here in the browser against
 * localStorage, and the result is sent back with session.sendToolResponse().
 */
import { Behavior, Type, type FunctionCall, type FunctionDeclaration, type FunctionResponse } from "@google/genai";
import { addMeal, deleteLastMealToday, getSnapshot } from "./storage";
import { mealsOnDay, remaining, sumNutrients, toNonNegativeNumber } from "./nutrition";
import { MEAL_TYPES, type Meal, type MealType } from "./types";

// gemini-3.8-live defaults to NON_BLOCKING (async) tools. We use BLOCKING so the
// model waits for the real result before it says "logged!".
const behavior = Behavior.BLOCKING;

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
];

function todaySummary() {
  const { meals, goals } = getSnapshot();
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
}

/** Executes one function call from the model. Never throws. */
export function runTool(call: FunctionCall): ToolResult {
  const respond = (response: Record<string, unknown>) => ({ id: call.id, name: call.name, response });
  const args = (call.args ?? {}) as Record<string, unknown>;

  try {
    switch (call.name) {
      case "log_meal": {
        const meal: Meal = addMeal({
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
        return { response: respond({ output: todaySummary() }) };

      case "delete_last_meal": {
        const removed = deleteLastMealToday();
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

      default:
        return { response: respond({ error: `Unknown function: ${call.name}` }) };
    }
  } catch (err) {
    return { response: respond({ error: err instanceof Error ? err.message : String(err) }) };
  }
}
