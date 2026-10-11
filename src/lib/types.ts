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

/** Shape of the JSON file produced by "Export". */
export interface ExportFile {
  app: "lensbite";
  version: 1;
  exportedAt: string;
  goals: Goals;
  meals: Meal[];
}
