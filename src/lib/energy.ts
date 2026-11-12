/**
 * Starting goals from a body profile: resting energy (Mifflin-St Jeor), times
 * an activity factor, adjusted for the weekly weight change the user wants,
 * then split into protein, fat, carbs and fiber. Pure functions; see
 * energy.test.ts. These are estimates to start from, not medical advice.
 */
import type { Goals } from "./types";

export type Sex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type WeightGoal = "lose" | "maintain" | "gain";
export type Units = "metric" | "imperial";

export interface BodyProfile {
  sex: Sex;
  /** Whole years. */
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: WeightGoal;
  /** kg per week: negative to lose, positive to gain, 0 to maintain. */
  weeklyRateKg: number;
}

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise", factor: 1.2 },
  { value: "light", label: "Lightly active", hint: "Walks, exercise 1–3 days a week", factor: 1.375 },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3–5 days a week", factor: 1.55 },
  { value: "active", label: "Very active", hint: "Hard exercise 6–7 days a week", factor: 1.725 },
  { value: "very_active", label: "Athlete", hint: "Physical job or training twice a day", factor: 1.9 },
];

/** Weekly rates offered for losing and gaining, in kg per week. */
export const LOSE_RATES = [0.25, 0.5, 0.75, 1] as const;
export const GAIN_RATES = [0.1, 0.25, 0.5] as const;

/** Energy in a kilogram of body weight change, roughly (fat tissue). */
const KCAL_PER_KG = 7700;
/** Floors below which the app won't set a calorie goal on its own. */
const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

/** Resting energy expenditure, kcal/day (Mifflin-St Jeor). */
export function restingEnergy({ sex, age, heightCm, weightKg }: Pick<BodyProfile, "sex" | "age" | "heightCm" | "weightKg">) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** Estimated total daily energy expenditure, kcal/day. */
export function maintenanceCalories(profile: Pick<BodyProfile, "sex" | "age" | "heightCm" | "weightKg" | "activity">) {
  const factor = ACTIVITY_LEVELS.find((a) => a.value === profile.activity)?.factor ?? 1.2;
  return restingEnergy(profile) * factor;
}

export interface GoalPlan {
  goals: Goals;
  /** Estimated maintenance calories, rounded. */
  maintenance: number;
  /** True when the calorie goal was raised to the safety floor. */
  floored: boolean;
}

/** Calorie and macro goals for a profile. */
export function planGoals(profile: BodyProfile): GoalPlan {
  const maintenance = maintenanceCalories(profile);
  const rate = profile.goal === "maintain" ? 0 : profile.weeklyRateKg;
  const target = maintenance + (rate * KCAL_PER_KG) / 7;
  const floor = MIN_CALORIES[profile.sex];
  const calories = roundTo(Math.max(target, floor), 10);

  // Protein per kg of a reference weight (capped at a BMI of 27, so very
  // heavy bodies don't get an absurd target): more while losing, to keep muscle.
  const heightM = profile.heightCm / 100;
  const referenceKg = Math.min(profile.weightKg, 27 * heightM * heightM);
  const proteinPerKg = profile.goal === "lose" ? 1.8 : 1.6;
  const protein = roundTo(referenceKg * proteinPerKg, 5);
  const fat = roundTo((calories * 0.28) / 9, 5);
  const carbs = Math.max(50, roundTo((calories - protein * 4 - fat * 9) / 4, 5));
  // About 14 g of fiber per 1000 kcal, at least 25 g.
  const fiber = Math.max(25, roundTo((calories / 1000) * 14, 1));

  return {
    goals: { calories, protein_g: protein, carbs_g: carbs, fat_g: fat, fiber_g: fiber },
    maintenance: roundTo(maintenance, 10),
    floored: target < floor,
  };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

/** Display helpers for the units preference. */
export function formatWeight(kg: number, units: Units, digits = 1): string {
  return units === "imperial" ? `${(kg / KG_PER_LB).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`;
}

/** A weight typed in the user's units, converted to kg. */
export function toKg(value: number, units: Units): number {
  return units === "imperial" ? value * KG_PER_LB : value;
}

/** kg in the user's units (number only). */
export function fromKg(kg: number, units: Units): number {
  return units === "imperial" ? kg / KG_PER_LB : kg;
}
