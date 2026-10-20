"use client";

import { useState } from "react";
import { nutrientLevel, scoreLevel, type NutrientLevel } from "@/lib/label";
import type { LabelNutrients, ProductRating } from "@/lib/types";
import { ChevronDownIcon, CloseIcon } from "./icons";

const LEVEL_TEXT: Record<NutrientLevel, string> = {
  good: "text-accent",
  medium: "text-carbs",
  bad: "text-fat",
};

const LEVEL_DOT: Record<NutrientLevel, string> = {
  good: "bg-accent",
  medium: "bg-carbs",
  bad: "bg-fat",
};

const LEVEL_SCORE: Record<NutrientLevel, string> = {
  good: "bg-accent text-black",
  medium: "bg-carbs text-black",
  bad: "bg-fat text-black",
};

/** Rows of the key-numbers table, in label order. Rows the label didn't print are hidden. */
const ROWS: { key: keyof LabelNutrients; label: string; unit: string; indent?: boolean }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "saturated_fat_g", label: "Saturated", unit: "g", indent: true },
  { key: "trans_fat_g", label: "Trans", unit: "g", indent: true },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "sugar_g", label: "Sugars", unit: "g", indent: true },
  { key: "added_sugar_g", label: "Added sugars", unit: "g", indent: true },
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

/** Overlay card for the product the agent just rated. Tap the header to collapse it. */
export function ProductCard({ product, onClose }: { product: ProductRating; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const { per100, perServing, unit } = product;
  const rows = ROWS.filter((r) => per100[r.key] !== undefined || perServing[r.key] !== undefined);
  const serving = [
    product.servingSize !== undefined && `${product.servingSize} ${unit}`,
    product.servingDescription,
    product.servingsPerPack !== undefined && `${product.servingsPerPack} per pack`,
  ]
    .filter(Boolean)
    .join(" · ");
  const level = scoreLevel(product.score);

  return (
    <section
      className="overflow-hidden rounded-3xl bg-white/12 text-white ring-1 ring-white/20 shadow-2xl backdrop-blur-2xl"
      aria-label={`Rating for ${product.name}`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={open}
        >
          <span
            className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl shadow-lg ${LEVEL_SCORE[level]}`}
          >
            <span className="text-3xl font-bold leading-none tabular-nums">{product.score}</span>
            <span className="text-[10px] font-semibold opacity-70">/ 10</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-base font-semibold leading-snug">{product.name}</span>
            {product.brand && <span className="mt-0.5 block truncate text-xs text-white/60">{product.brand}</span>}
            {product.verdict && (
              <span className={`mt-1.5 text-sm leading-snug text-white/85 ${open ? "block" : "line-clamp-1"}`}>
                {product.verdict}
              </span>
            )}
          </span>
          <ChevronDownIcon
            width={18}
            height={18}
            className={`mt-1 shrink-0 text-white/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
          aria-label="Close product card"
        >
          <CloseIcon width={18} height={18} />
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-white/15 px-4 pb-4 pt-4 text-sm">
          {serving && <p className="text-xs text-white/60">Serving: {serving}</p>}

          {rows.length > 0 && (
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-white/50">
                  <th className="pb-1 text-left font-medium">Per</th>
                  <th className="pb-1 text-right font-medium">100 {unit}</th>
                  <th className="pb-1 pl-3 text-right font-medium">Serving</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, label, unit: u, indent }) => {
                  const nutrient = nutrientLevel(key, per100, unit);
                  return (
                    <tr key={key} className="border-t border-white/10">
                      <td className={`py-1.5 ${indent ? "pl-3 text-white/70" : ""}`}>
                        <span className="inline-flex items-center gap-1.5">
                          {nutrient && (
                            <span className={`size-1.5 rounded-full ${LEVEL_DOT[nutrient]}`} aria-hidden="true" />
                          )}
                          {label}
                        </span>
                      </td>
                      <td className={`py-1.5 text-right ${nutrient ? `font-semibold ${LEVEL_TEXT[nutrient]}` : ""}`}>
                        {formatValue(per100[key], u)}
                      </td>
                      <td className="py-1.5 pl-3 text-right text-white/85">{formatValue(perServing[key], u)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {(product.pros.length > 0 || product.cons.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <PointList title="Good" items={product.pros} mark="✓" color="text-accent" />
              <PointList title="Not so good" items={product.cons} mark="✕" color="text-fat" />
            </div>
          )}

          {product.ingredientWarnings.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">Ingredient warnings</p>
              <ul className="flex flex-wrap gap-1.5">
                {product.ingredientWarnings.map((warning) => (
                  <li key={warning} className="rounded-full bg-carbs/20 px-2.5 py-1 text-xs text-carbs">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PointList({ title, items, mark, color }: { title: string; items: string[]; mark: string; color: string }) {
  if (items.length === 0) return <div />;
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/50">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 leading-snug">
            <span className={`shrink-0 font-bold ${color}`} aria-hidden="true">
              {mark}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatValue(value: number | undefined, unit: string): string {
  return value === undefined ? "—" : `${value.toLocaleString()} ${unit}`;
}
