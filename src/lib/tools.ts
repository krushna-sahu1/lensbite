/**
 * Function-calling tools for the Live agent. Declarations are sent to Gemini in
 * the session config; calls are executed right here in the browser against
 * Supabase (as the signed-in user, so Row Level Security applies), and the
 * result is sent back with session.sendToolResponse().
 */
import type { FunctionCall, FunctionResponse } from "@google/genai";
import { addMeal, deleteLastMealToday, findRecentDuplicate, getSnapshot, refresh, type StoreSnapshot } from "./storage";
import { parseProductRating } from "./label";
import {
  isLiveMode,
  LIVE_MODE_INFO,
  parseComparison,
  parseMenuPicks,
  parseRecipeIdeas,
  type LiveCard,
  type LiveMode,
} from "./live-cards";
import { mealsOnDay, parseLocalDateTime, remaining, sumNutrients, toNonNegativeNumber } from "./nutrition";
import { MEAL_TYPES, type Meal, type MealType, type ProductRating } from "./types";

export { TOOL_DECLARATIONS } from "./tool-declarations";

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
  /** Card to show on the Live screen (product, menu picks, recipes, comparison). Memory only. */
  card?: LiveCard;
  /** Switch the Live screen to this mode. */
  mode?: LiveMode;
}

/** What the Live session knows that some tools need. */
export interface ToolContext {
  /** Products rated so far this session, oldest first. */
  rated: ProductRating[];
}

/** Executes one function call from the model. Never rejects. */
export async function runTool(call: FunctionCall, context: ToolContext = { rated: [] }): Promise<ToolResult> {
  const respond = (response: Record<string, unknown>) => ({ id: call.id, name: call.name, response });
  const args = (call.args ?? {}) as Record<string, unknown>;

  try {
    switch (call.name) {
      case "log_meal": {
        const eatenAt = resolveEatenAt(args.eaten_at);
        if (typeof eatenAt === "string") return { response: respond({ error: eatenAt }) };

        const input = {
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
        };

        // The model sometimes repeats a log_meal call (after a reconnect, or a
        // second call for the same confirmation). Same food, same calories, a
        // few minutes apart: report the existing entry instead of saving twice.
        if (args.allow_duplicate !== true) {
          const existing = await findRecentDuplicate(input.name, input.calories, eatenAt);
          if (existing) {
            return {
              response: respond({
                output: {
                  already_logged: { name: existing.name, calories: existing.calories, eaten_at: existing.loggedAt },
                  message: "This meal was already logged a moment ago, so nothing new was saved.",
                },
              }),
            };
          }
        }

        // The id is derived from the call id, so a replayed call can't insert a second row.
        const { meal, created }: { meal: Meal; created: boolean } = await addMeal(input, {
          id: call.id ? await uuidFromString(call.id) : undefined,
          loggedAt: eatenAt,
        });
        if (!created) {
          return {
            response: respond({
              output: { already_logged: { name: meal.name, calories: meal.calories }, message: "Already logged." },
            }),
          };
        }
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
          card: { kind: "product", product },
        };
      }

      case "set_mode": {
        const mode = isLiveMode(args.mode) ? args.mode : null;
        if (!mode) return { response: respond({ error: "Unknown mode. Use one of: food, label, menu, fridge, compare." }) };
        return {
          response: respond({ output: { mode, sharp_frames: LIVE_MODE_INFO[mode].sharp } }),
          mode,
        };
      }

      case "show_menu_picks": {
        const menu = parseMenuPicks(args);
        if (!menu.picks.length) return { response: respond({ error: "Give at least one pick with a dish name." }) };
        return {
          response: respond({ output: { shown: true, picks: menu.picks.length } }),
          event: `${menu.picks.length} pick${menu.picks.length === 1 ? "" : "s"}${menu.restaurant ? ` at ${menu.restaurant}` : ""}`,
          card: { kind: "menu", menu },
        };
      }

      case "show_recipe_ideas": {
        const recipes = parseRecipeIdeas(args);
        if (!recipes.ideas.length) return { response: respond({ error: "Give at least one idea with a title." }) };
        return {
          response: respond({ output: { shown: true, ideas: recipes.ideas.length } }),
          event: `${recipes.ideas.length} meal idea${recipes.ideas.length === 1 ? "" : "s"}`,
          card: { kind: "recipes", recipes },
        };
      }

      case "show_comparison": {
        const comparison = parseComparison(args, context.rated);
        if ("error" in comparison) return { response: respond({ error: comparison.error }) };
        return {
          response: respond({
            output: {
              shown: true,
              compared: comparison.products.map((p) => ({ name: p.name, score: p.score, unit: p.unit, per_100: p.per100 })),
              winner: comparison.winnerIndex === null ? null : comparison.products[comparison.winnerIndex].name,
            },
          }),
          event: `Compared ${comparison.products.length} products`,
          labelMode: true,
          card: { kind: "comparison", comparison },
        };
      }

      default:
        return { response: respond({ error: `Unknown function: ${call.name}` }) };
    }
  } catch (err) {
    return { response: respond({ error: err instanceof Error ? err.message : String(err) }) };
  }
}

/** Furthest back log_meal may date a meal. */
const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * log_meal's optional eaten_at: undefined (eaten now), a Date, or an error
 * message for the model when the time can't be used.
 */
function resolveEatenAt(raw: unknown, now = new Date()): Date | undefined | string {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const date = parseLocalDateTime(String(raw));
  if (!date) return `eaten_at "${String(raw)}" isn't a valid time. Use local time as YYYY-MM-DDTHH:MM, or leave it out.`;
  // A minute of slack for clock differences.
  if (date.getTime() > now.getTime() + 60_000) return "eaten_at is in the future. Leave it out for food eaten now.";
  if (now.getTime() - date.getTime() > MAX_BACKDATE_MS) {
    return "eaten_at is more than 7 days ago. Ask the user to add it from the app's food log instead.";
  }
  return date;
}

/** A stable UUID (v4 layout) from any string, so the same tool call always maps to the same row id. */
async function uuidFromString(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
