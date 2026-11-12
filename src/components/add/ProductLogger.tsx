"use client";

import { useMemo, useState } from "react";
import { BackIcon, CloseIcon } from "@/components/icons";
import { MEAL_META } from "@/components/meal-meta";
import { nutrientLevel, type NutrientLevel } from "@/lib/label";
import { nutrientsForAmount, type BarcodeProduct } from "@/lib/openfoodfacts";
import { mealTypeForTime } from "@/lib/nutrition";
import { addMeal } from "@/lib/storage";
import { MEAL_TYPES, type LabelNutrients, type Meal, type MealType } from "@/lib/types";

const NUTRISCORE_COLORS: Record<string, string> = {
  a: "bg-emerald-600",
  b: "bg-lime-500",
  c: "bg-yellow-400 text-black",
  d: "bg-orange-500",
  e: "bg-red-600",
};

const NOVA_LABEL: Record<number, string> = {
  1: "Unprocessed",
  2: "Culinary ingredient",
  3: "Processed",
  4: "Ultra-processed",
};

const LEVEL_DOT: Record<NutrientLevel, string> = { good: "bg-emerald-400", medium: "bg-amber-400", bad: "bg-red-500" };

const ROWS: { key: keyof LabelNutrients; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "sugar_g", label: "of which sugars", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "saturated_fat_g", label: "of which saturated", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

/** A scanned product: how much you had, what that adds up to, and a Log button. */
export function ProductLogger({
  product,
  onBack,
  onClose,
  onLogged,
}: {
  product: BarcodeProduct;
  onBack: () => void;
  onClose: () => void;
  onLogged: (meals: Meal[]) => void;
}) {
  const hasServing = !!product.servingSize;
  const [mode, setMode] = useState<"servings" | "amount">(hasServing ? "servings" : "amount");
  const [servings, setServings] = useState("1");
  const [amount, setAmount] = useState(String(product.servingSize ?? 100));
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForTime(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grams = mode === "servings" ? (Number(servings) || 0) * (product.servingSize ?? 0) : Number(amount) || 0;
  const n = useMemo(() => nutrientsForAmount(product, grams), [product, grams]);

  async function log() {
    if (grams <= 0) return setError("Enter how much you had.");
    setBusy(true);
    setError(null);
    try {
      const portion =
        mode === "servings"
          ? `${servings} serving${servings === "1" ? "" : "s"} (${Math.round(grams)} ${product.unit})`
          : `${Math.round(grams)} ${product.unit}`;
      const { meal } = await addMeal({
        name: product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ${product.name}` : product.name,
        mealType,
        calories: n.calories ?? 0,
        protein_g: n.protein_g ?? 0,
        carbs_g: n.carbs_g ?? 0,
        fat_g: n.fat_g ?? 0,
        fiber_g: n.fiber_g ?? 0,
        notes: `${portion}, barcode ${product.barcode} (Open Food Facts)`,
      });
      onLogged([meal]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface text-foreground">
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:text-foreground">
          <BackIcon width={16} height={16} />
          Scan another
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-track">
          <CloseIcon />
        </button>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="flex items-start gap-4">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Open Food Facts thumbnail
            <img src={product.imageUrl} alt="" className="size-20 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-line" />
          ) : (
            <div className="size-20 shrink-0 rounded-2xl bg-track" aria-hidden="true" />
          )}
          <div className="min-w-0">
            {product.brand && <p className="label-caps">{product.brand}</p>}
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight">{product.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.nutriscore && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${NUTRISCORE_COLORS[product.nutriscore]}`}>
                  Nutri-Score {product.nutriscore.toUpperCase()}
                </span>
              )}
              {product.nova && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.nova === 4 ? "bg-fat/15 text-fat-ink" : "bg-track text-muted"}`}>
                  {NOVA_LABEL[product.nova]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* How much */}
        <div className="mt-5">
          {hasServing && (
            <div className="mb-2 flex gap-1 rounded-2xl bg-track p-1" role="radiogroup" aria-label="Amount by">
              {(["servings", "amount"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-10 flex-1 rounded-xl text-sm font-semibold transition ${mode === m ? "bg-gradient-to-b from-surface to-surface-2 shadow-sm" : "text-muted"}`}
                >
                  {m === "servings" ? "Servings" : product.unit === "ml" ? "Millilitres" : "Grams"}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium">
              {mode === "servings" ? `Servings${product.servingDescription ? ` of ${product.servingDescription}` : ""}` : `Amount (${product.unit})`}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={mode === "servings" ? 0.5 : 1}
              value={mode === "servings" ? servings : amount}
              onChange={(e) => (mode === "servings" ? setServings(e.target.value) : setAmount(e.target.value))}
              className="h-11 w-28 rounded-xl border border-line bg-background px-3 text-right tabular-nums outline-none focus:border-accent-ink"
            />
          </label>
        </div>

        {/* What that adds up to */}
        <div className="mt-4 rounded-2xl bg-track/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="label-caps">For {Math.round(grams)} {product.unit}</span>
            <span className="text-[11px] text-muted">dot = per 100 {product.unit}</span>
          </div>
          <dl className="mt-2 space-y-1.5">
            {ROWS.map(({ key, label, unit }) => {
              const value = n[key];
              if (value === undefined) return null;
              const level = nutrientLevel(key, product.per100, product.unit);
              return (
                <div key={key} className={`flex items-center justify-between text-sm ${label.startsWith("of which") ? "pl-3 text-muted" : ""}`}>
                  <dt className="flex items-center gap-2">
                    {level && <span className={`size-2 rounded-full ${LEVEL_DOT[level]}`} aria-label={`${level} per 100 ${product.unit}`} />}
                    {label}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {value.toLocaleString()} {unit}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-track p-1" role="radiogroup" aria-label="Meal">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={mealType === type}
              onClick={() => setMealType(type)}
              className={`min-h-10 rounded-xl text-[13px] font-semibold transition ${mealType === type ? "bg-gradient-to-b from-surface to-surface-2 shadow-sm" : "text-muted"}`}
            >
              {MEAL_META[type].label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void log()}
          disabled={busy || grams <= 0}
          className="mt-3 min-h-12 w-full rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Logging…" : `Log ${n.calories ?? 0} kcal`}
        </button>
      </div>
    </div>
  );
}
