/**
 * Live modes and the on-screen cards they produce:
 *
 *  - food:    point at a plate, talk about it (the original mode)
 *  - label:   read a pack's nutrition table and rate it (ProductRating card)
 *  - menu:    read a restaurant menu and pick dishes that fit what's left today
 *  - fridge:  look at what's in the fridge/pantry and suggest meals
 *  - compare: rate two or more products and show them side by side
 *
 * The parsers turn tool-call arguments from the model into safe card data.
 * Pure; see live-cards.test.ts.
 */
import { round1, toNonNegativeNumber } from "./nutrition";
import type { ProductRating } from "./types";

export const LIVE_MODES = ["food", "label", "menu", "fridge", "compare"] as const;
export type LiveMode = (typeof LIVE_MODES)[number];

export const LIVE_MODE_INFO: Record<LiveMode, { label: string; hint: string; sharp: boolean }> = {
  food: { label: "Food", hint: "Point at your food and ask, “How many calories is this?”", sharp: false },
  label: { label: "Label", hint: "Show the back of a pack and say “Rate this.”", sharp: true },
  menu: { label: "Menu", hint: "Hold up the menu and ask, “What should I order?”", sharp: true },
  fridge: { label: "Fridge", hint: "Show what you've got and ask, “What can I make?”", sharp: false },
  compare: { label: "Compare", hint: "Show one label, then the other: “Which is better?”", sharp: true },
};

export function isLiveMode(value: unknown): value is LiveMode {
  return typeof value === "string" && (LIVE_MODES as readonly string[]).includes(value);
}

export interface MenuPick {
  dish: string;
  why: string;
  calories: number;
  protein_g?: number;
  /** An order tweak, e.g. "dressing on the side". */
  tip?: string;
}

export interface MenuPicks {
  createdAt: number;
  restaurant?: string;
  picks: MenuPick[];
  avoid: { dish: string; why: string }[];
}

export interface RecipeIdea {
  title: string;
  /** Ingredients seen in the fridge that it uses. */
  uses: string[];
  /** Things it needs that weren't seen (pantry staples aside). */
  missing: string[];
  minutes?: number;
  calories: number;
  protein_g?: number;
  steps: string[];
}

export interface RecipeIdeas {
  createdAt: number;
  ideas: RecipeIdea[];
}

export interface ProductComparison {
  createdAt: number;
  products: ProductRating[];
  /** Index into products, or null for "it depends / a tie". */
  winnerIndex: number | null;
  verdict: string;
}

export type LiveCard =
  | { kind: "product"; product: ProductRating }
  | { kind: "menu"; menu: MenuPicks }
  | { kind: "recipes"; recipes: RecipeIdeas }
  | { kind: "comparison"; comparison: ProductComparison };

/** A React key for whichever card is showing. */
export function cardKey(card: LiveCard): string {
  switch (card.kind) {
    case "product":
      return `p${card.product.ratedAt}`;
    case "menu":
      return `m${card.menu.createdAt}`;
    case "recipes":
      return `r${card.recipes.createdAt}`;
    case "comparison":
      return `c${card.comparison.createdAt}`;
  }
}

// ---------------------------------------------------------------------------
// Parsers for tool arguments
// ---------------------------------------------------------------------------

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, maxItems = 8, maxLen = 120) =>
  Array.isArray(v) ? v.map((s) => str(s, maxLen)).filter(Boolean).slice(0, maxItems) : [];
const objects = (v: unknown, maxItems: number) =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, maxItems) : [];
const optionalNumber = (v: unknown) => {
  const n = toNonNegativeNumber(v);
  return n > 0 ? round1(n) : undefined;
};

export function parseMenuPicks(args: Record<string, unknown>, now = Date.now()): MenuPicks {
  return {
    createdAt: now,
    restaurant: str(args.restaurant) || undefined,
    picks: objects(args.picks, 4)
      .map((p) => ({
        dish: str(p.dish),
        why: str(p.why, 240),
        calories: Math.round(toNonNegativeNumber(p.calories)),
        protein_g: optionalNumber(p.protein_g),
        tip: str(p.tip, 160) || undefined,
      }))
      .filter((p) => p.dish),
    avoid: objects(args.avoid, 4)
      .map((a) => ({ dish: str(a.dish), why: str(a.why, 200) }))
      .filter((a) => a.dish),
  };
}

export function parseRecipeIdeas(args: Record<string, unknown>, now = Date.now()): RecipeIdeas {
  return {
    createdAt: now,
    ideas: objects(args.ideas, 3)
      .map((r) => ({
        title: str(r.title),
        uses: strList(r.uses, 10),
        missing: strList(r.missing, 6),
        minutes: optionalNumber(r.minutes),
        calories: Math.round(toNonNegativeNumber(r.calories)),
        protein_g: optionalNumber(r.protein_g),
        steps: strList(r.steps, 6, 240),
      }))
      .filter((r) => r.title),
  };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Picks the rated products the model means by name (fuzzy: either name
 * contains the other), falling back to the most recent ones. Returns them in
 * the order the model named them, without duplicates.
 */
export function resolveCompared(rated: ProductRating[], names: string[], count = 2): ProductRating[] {
  const chosen: ProductRating[] = [];
  for (const name of names.map(normalize).filter(Boolean)) {
    // Newest first, so a re-scan of the same product wins.
    const match = [...rated].reverse().find((p) => {
      const n = normalize(`${p.brand ?? ""} ${p.name}`);
      const plain = normalize(p.name);
      return !chosen.includes(p) && (n.includes(name) || name.includes(plain));
    });
    if (match) chosen.push(match);
  }
  if (chosen.length < Math.max(2, Math.min(count, names.length))) {
    for (const p of [...rated].reverse()) {
      if (chosen.length >= Math.max(2, names.length || count)) break;
      if (!chosen.includes(p)) chosen.push(p);
    }
  }
  return chosen.slice(0, 4);
}

export function parseComparison(
  args: Record<string, unknown>,
  rated: ProductRating[],
  now = Date.now(),
): ProductComparison | { error: string } {
  const names = strList(args.product_names, 4);
  const products = resolveCompared(rated, names);
  if (products.length < 2) {
    return {
      error:
        "Fewer than two products have been rated in this session. Rate each one with show_product_rating first, then compare.",
    };
  }
  const winnerName = normalize(str(args.winner));
  const winnerIndex = winnerName
    ? products.findIndex((p) => {
        const n = normalize(`${p.brand ?? ""} ${p.name}`);
        return n.includes(winnerName) || winnerName.includes(normalize(p.name));
      })
    : -1;
  return {
    createdAt: now,
    products,
    winnerIndex: winnerIndex >= 0 ? winnerIndex : null,
    verdict: str(args.verdict, 300),
  };
}
