import { describe, expect, it } from "vitest";
import { dedupeRecent } from "./library";
import { cardKey, isLiveMode, parseComparison, parseMenuPicks, parseRecipeIdeas, resolveCompared } from "./live-cards";
import type { Meal, ProductRating } from "./types";

function product(name: string, ratedAt: number, extra: Partial<ProductRating> = {}): ProductRating {
  return {
    ratedAt,
    name,
    score: 5,
    verdict: "",
    unit: "g",
    per100: { calories: 400, sugar_g: 20 },
    perServing: {},
    pros: [],
    cons: [],
    ingredientWarnings: [],
    ...extra,
  };
}

describe("live modes", () => {
  it("recognizes modes", () => {
    expect(isLiveMode("menu")).toBe(true);
    expect(isLiveMode("kitchen")).toBe(false);
    expect(isLiveMode(undefined)).toBe(false);
  });
});

describe("menu picks", () => {
  it("keeps valid picks and drops junk", () => {
    const menu = parseMenuPicks(
      {
        restaurant: " Nando's ",
        picks: [
          { dish: "Grilled chicken salad", why: "40 g protein", calories: "520", protein_g: 40, tip: "Dressing on the side" },
          { dish: "", why: "no name" },
          "junk",
          { dish: "Bean wrap", why: "Fiber", calories: -10 },
        ],
        avoid: [{ dish: "Caesar salad", why: "Creamy dressing, ~800 kcal" }, { why: "missing dish" }],
      },
      1,
    );
    expect(menu.restaurant).toBe("Nando's");
    expect(menu.picks).toEqual([
      { dish: "Grilled chicken salad", why: "40 g protein", calories: 520, protein_g: 40, tip: "Dressing on the side" },
      { dish: "Bean wrap", why: "Fiber", calories: 0, protein_g: undefined, tip: undefined },
    ]);
    expect(menu.avoid).toHaveLength(1);
    expect(cardKey({ kind: "menu", menu })).toBe("m1");
  });
});

describe("recipe ideas", () => {
  it("caps lists and parses numbers", () => {
    const r = parseRecipeIdeas({
      ideas: [
        { title: "Veggie omelette", uses: ["eggs", "spinach", ""], missing: [], minutes: "10", calories: 380, protein_g: 26, steps: ["Whisk", "Cook"] },
        { title: "", calories: 100 },
        { title: "A" },
        { title: "B" },
        { title: "C" },
      ],
    });
    expect(r.ideas.map((i) => i.title)).toEqual(["Veggie omelette", "A"]);
    expect(r.ideas[0]).toMatchObject({ uses: ["eggs", "spinach"], minutes: 10, calories: 380, protein_g: 26 });
    expect(r.ideas[1]).toMatchObject({ calories: 0, steps: [], uses: [] });
  });
});

describe("comparison", () => {
  const rated = [
    product("Choco Crunch Cereal", 1, { brand: "Brand A" }),
    product("Oat Bran Flakes", 2),
    product("Granola Bar", 3),
  ];

  it("finds products by fuzzy name, in the order named", () => {
    const picked = resolveCompared(rated, ["oat bran", "Brand A Choco Crunch Cereal"]);
    expect(picked.map((p) => p.name)).toEqual(["Oat Bran Flakes", "Choco Crunch Cereal"]);
  });

  it("falls back to the two most recent ratings", () => {
    expect(resolveCompared(rated, ["something else"]).map((p) => p.name)).toEqual(["Granola Bar", "Oat Bran Flakes"]);
    expect(resolveCompared(rated, []).map((p) => p.name)).toEqual(["Granola Bar", "Oat Bran Flakes"]);
  });

  it("prefers the newest rating of a re-scanned product", () => {
    const again = [...rated, product("Oat Bran Flakes", 9, { score: 8 })];
    expect(resolveCompared(again, ["Oat Bran Flakes", "Granola Bar"])[0].ratedAt).toBe(9);
  });

  it("marks the winner and needs two ratings", () => {
    const c = parseComparison({ product_names: ["Choco Crunch", "Oat Bran Flakes"], winner: "oat bran flakes", verdict: "Less sugar" }, rated, 5);
    expect("error" in c).toBe(false);
    if ("error" in c) return;
    expect(c.winnerIndex).toBe(1);
    expect(c.verdict).toBe("Less sugar");
    expect(parseComparison({ product_names: ["x"], verdict: "" }, [rated[0]])).toHaveProperty("error");
    const tie = parseComparison({ product_names: [], verdict: "Depends" }, rated);
    expect("error" in tie ? null : tie.winnerIndex).toBeNull();
  });
});

describe("recent foods", () => {
  const meal = (name: string, at: string, calories = 100): Meal => ({
    id: at,
    name,
    loggedAt: at,
    mealType: "lunch",
    calories,
    protein_g: 1,
    carbs_g: 1,
    fat_g: 1,
    fiber_g: 0,
  });

  it("keeps the newest entry of each name, case-insensitively, newest first", () => {
    const foods = dedupeRecent([
      meal("Oatmeal", "2026-11-12T08:00:00Z", 300),
      meal("oatmeal ", "2026-11-10T08:00:00Z", 250),
      meal("Chicken wrap", "2026-11-11T12:00:00Z"),
    ]);
    expect(foods.map((f) => [f.name, f.calories])).toEqual([
      ["Oatmeal", 300],
      ["Chicken wrap", 100],
    ]);
  });

  it("limits the list", () => {
    const many = Array.from({ length: 50 }, (_, i) => meal(`Food ${i}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`));
    expect(dedupeRecent(many, 10)).toHaveLength(10);
  });
});
