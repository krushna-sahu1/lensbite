/**
 * Barcode lookups in Open Food Facts (https://world.openfoodfacts.org), the
 * free, open database of packaged foods. The /api/product route fetches the
 * product server-side and returns it in this shape; parseOffProduct is pure so
 * it can be tested (openfoodfacts.test.ts).
 */
import { parseNutrients, roundLabel, scaleNutrients } from "./label";
import type { LabelNutrients } from "./types";

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  /** "g" for foods, "ml" for drinks. */
  unit: "g" | "ml";
  /** Serving size in g/ml, when the product lists one. */
  servingSize?: number;
  /** Serving as printed, e.g. "2 biscuits (25 g)". */
  servingDescription?: string;
  per100: LabelNutrients;
  perServing: LabelNutrients;
  /** Nutri-Score grade "a".."e", when known. */
  nutriscore?: string;
  /** NOVA processing group 1-4, when known. */
  nova?: number;
  imageUrl?: string;
}

/** Fields requested from the API; keeps responses small. */
export const OFF_FIELDS = [
  "code",
  "product_name",
  "generic_name",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "product_quantity_unit",
  "quantity",
  "nutriscore_grade",
  "nova_group",
  "image_front_small_url",
].join(",");

/** Only real retail barcodes: EAN-8, UPC-A (12), EAN-13, GTIN-14. */
export function isValidBarcode(code: string): boolean {
  return /^(\d{8}|\d{12,14})$/.test(code);
}

const KJ_PER_KCAL = 4.184;

/** One column ("_100g" or "_serving") of Open Food Facts nutriments, in LensBite's units. */
function column(nutriments: Record<string, unknown>, suffix: "_100g" | "_serving"): LabelNutrients {
  const get = (key: string) => nutriments[`${key}${suffix}`];
  const kcal = get("energy-kcal") ?? (typeof get("energy-kj") === "number" ? (get("energy-kj") as number) / KJ_PER_KCAL : undefined);
  // Open Food Facts stores sodium in grams.
  const sodiumG = get("sodium");
  return parseNutrients({
    calories: kcal,
    fat_g: get("fat"),
    saturated_fat_g: get("saturated-fat"),
    trans_fat_g: get("trans-fat"),
    carbs_g: get("carbohydrates"),
    sugar_g: get("sugars"),
    added_sugar_g: get("added-sugars"),
    fiber_g: get("fiber"),
    protein_g: get("proteins"),
    sodium_mg: typeof sodiumG === "number" ? sodiumG * 1000 : undefined,
    salt_g: get("salt"),
  });
}

const hasAny = (n: LabelNutrients) => Object.keys(n).length > 0;

/**
 * Converts an Open Food Facts `product` object. Returns null when it has no
 * usable name or energy value, since it couldn't be logged.
 */
export function parseOffProduct(barcode: string, raw: unknown): BarcodeProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const nutriments = (p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {}) as Record<string, unknown>;

  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const name = text(p.product_name) ?? text(p.generic_name);
  const unit: "g" | "ml" =
    p.serving_quantity_unit === "ml" ||
    p.product_quantity_unit === "ml" ||
    /\b\d+(?:[.,]\d+)?\s*(ml|cl|l)\b/i.test(String(p.quantity ?? ""))
      ? "ml"
      : "g";
  const servingRaw = Number(p.serving_quantity);
  const servingSize = Number.isFinite(servingRaw) && servingRaw > 0 ? servingRaw : undefined;

  const printed100 = column(nutriments, "_100g");
  const printedServing = column(nutriments, "_serving");
  // Fill whichever column is missing from the other, like the label scanner does.
  const per100 = roundLabel({
    ...(servingSize && hasAny(printedServing) ? scaleNutrients(printedServing, 100 / servingSize) : {}),
    ...printed100,
  });
  const perServing = roundLabel({
    ...(servingSize ? scaleNutrients(printed100, servingSize / 100) : {}),
    ...printedServing,
  });

  if (!name || per100.calories === undefined) return null;

  const grade = text(p.nutriscore_grade)?.toLowerCase();
  const nova = Number(p.nova_group);
  return {
    barcode,
    name: name.slice(0, 200),
    brand: text(p.brands)?.split(",")[0]?.trim(),
    unit,
    servingSize,
    servingDescription: text(p.serving_size),
    per100,
    perServing,
    nutriscore: grade && /^[a-e]$/.test(grade) ? grade : undefined,
    nova: Number.isInteger(nova) && nova >= 1 && nova <= 4 ? nova : undefined,
    imageUrl: text(p.image_front_small_url)?.startsWith("https://") ? text(p.image_front_small_url) : undefined,
  };
}

/** Nutrients for an amount in g/ml, from the per-100 column. */
export function nutrientsForAmount(product: BarcodeProduct, amount: number): LabelNutrients {
  return roundLabel(scaleNutrients(product.per100, amount / 100));
}
