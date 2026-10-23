import type { MealType } from "@/lib/types";
import { AppleIcon, BowlIcon, CoffeeIcon, DinnerIcon } from "./icons";

type MealMeta = {
  /** Group heading, plural where it reads better. */
  label: string;
  icon: typeof CoffeeIcon;
  /** Coloured rounded badge behind the icon. */
  badge: string;
  /** Solid colour used for dots and small accents. */
  dot: string;
};

/** Shared meal-type icons, labels and colours for the food log. */
export const MEAL_META: Record<MealType, MealMeta> = {
  breakfast: {
    label: "Breakfast",
    icon: CoffeeIcon,
    badge: "bg-carbs/15 text-carbs-ink ring-carbs/20",
    dot: "bg-carbs",
  },
  lunch: {
    label: "Lunch",
    icon: BowlIcon,
    badge: "bg-accent/15 text-accent-ink ring-accent/20",
    dot: "bg-accent",
  },
  dinner: {
    label: "Dinner",
    icon: DinnerIcon,
    badge: "bg-protein/15 text-protein-ink ring-protein/20",
    dot: "bg-protein",
  },
  snack: {
    label: "Snacks",
    icon: AppleIcon,
    badge: "bg-fat/15 text-fat-ink ring-fat/20",
    dot: "bg-fat",
  },
};
