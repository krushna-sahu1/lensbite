export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** The nutrient fields we track. Same shape for meals, totals and goals. */
export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface Meal extends Nutrients {
  id: string;
  /** ISO timestamp of when the meal was logged. */
  loggedAt: string;
  name: string;
  mealType: MealType;
  notes?: string;
}

export type Goals = Nutrients;

/**
 * Nutrition facts as printed on a package label. Everything is optional because
 * labels differ by country (e.g. EU labels list salt, US labels list sodium).
 */
export interface LabelNutrients {
  calories?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  trans_fat_g?: number;
  carbs_g?: number;
  sugar_g?: number;
  added_sugar_g?: number;
  fiber_g?: number;
  protein_g?: number;
  sodium_mg?: number;
  salt_g?: number;
}

/** A rated packaged product, shown on the Live screen. Never saved. */
export interface ProductRating {
  /** When it was rated; doubles as a React key so each new scan gets a fresh card. */
  ratedAt: number;
  name: string;
  brand?: string;
  /** 0–10. */
  score: number;
  verdict: string;
  /** "g" for foods, "ml" for drinks. Decides whether per100 means 100 g or 100 ml. */
  unit: "g" | "ml";
  servingSize?: number;
  servingDescription?: string;
  servingsPerPack?: number;
  per100: LabelNutrients;
  perServing: LabelNutrients;
  pros: string[];
  cons: string[];
  ingredientWarnings: string[];
}

/** Shape of the JSON file produced by "Export". */
export interface ExportFile {
  app: "lensbite";
  version: 1;
  exportedAt: string;
  goals: Goals;
  meals: Meal[];
}
