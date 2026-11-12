"use client";

import { useState } from "react";
import { BackIcon, CheckIcon } from "@/components/icons";
import { MEAL_META } from "@/components/meal-meta";
import { scaleItem, type AnalyzeResult, type AnalyzedItem, type Confidence } from "@/lib/analyze";
import { mealTypeForTime } from "@/lib/nutrition";
import { MEAL_TYPES, type MealType } from "@/lib/types";

const PORTIONS = [0.5, 1, 1.5, 2] as const;

const CONFIDENCE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "Confident", className: "bg-accent-soft text-accent-ink" },
  medium: { label: "Estimate", className: "bg-track text-muted" },
  low: { label: "Rough guess", className: "bg-carbs/15 text-carbs-ink" },
};

/**
 * The AI's estimate, one card per food: pick which to log, adjust each
 * portion, choose the meal, and log them all at once.
 */
export function AnalyzeResults({
  result,
  onBack,
  onLog,
}: {
  result: AnalyzeResult;
  onBack: () => void;
  onLog: (items: AnalyzedItem[], mealType: MealType) => Promise<void>;
}) {
  const [selected, setSelected] = useState(() => result.items.map(() => true));
  const [portions, setPortions] = useState(() => result.items.map(() => 1));
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForTime(new Date()));
  const [busy, setBusy] = useState(false);

  const chosen = result.items
    .map((item, i) => ({ item: scaleItem(item, portions[i]), on: selected[i] }))
    .filter((x) => x.on)
    .map((x) => x.item);
  const total = chosen.reduce((sum, item) => sum + item.calories, 0);

  async function log() {
    setBusy(true);
    try {
      await onLog(chosen, mealType);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-2 inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <BackIcon width={16} height={16} />
        Edit description
      </button>

      {result.question && (
        <p className="mb-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          <span className="font-semibold">Worth checking:</span> {result.question}
        </p>
      )}

      {result.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No food found. Try describing it in a few more words, or use a clearer photo.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {result.items.map((raw, i) => {
            const item = scaleItem(raw, portions[i]);
            const conf = CONFIDENCE[item.confidence];
            return (
              <li
                key={i}
                className={`rounded-2xl p-3.5 ring-1 transition ${selected[i] ? "bg-surface-2 ring-line" : "bg-track/40 opacity-60 ring-transparent"}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected[i]}
                    aria-label={`Include ${item.name}`}
                    onClick={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))}
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ring-1 transition ${
                      selected[i] ? "bg-foreground text-background ring-foreground" : "ring-line"
                    }`}
                  >
                    {selected[i] && <CheckIcon width={14} height={14} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold tracking-tight">{item.name}</p>
                      <span className="num-md shrink-0">
                        {item.calories}
                        <span className="ml-0.5 text-[11px] font-medium text-muted">kcal</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {raw.portion}
                      {portions[i] !== 1 && ` × ${portions[i]}`} · {item.caloriesLow}–{item.caloriesHigh} kcal
                    </p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">
                      P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g · Fiber {item.fiber_g}g
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conf.className}`}>{conf.label}</span>
                      <span className="ml-auto flex gap-1" role="group" aria-label={`Portion of ${item.name}`}>
                        {PORTIONS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={portions[i] === p}
                            onClick={() => setPortions((s) => s.map((v, j) => (j === i ? p : v)))}
                            className={`min-h-8 min-w-10 rounded-full px-2 text-xs font-semibold tabular-nums transition ${
                              portions[i] === p ? "bg-foreground text-background" : "bg-track text-muted hover:text-foreground"
                            }`}
                          >
                            {p}×
                          </button>
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result.items.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-track p-1" role="radiogroup" aria-label="Meal">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={mealType === type}
                onClick={() => setMealType(type)}
                className={`min-h-10 rounded-xl text-[13px] font-semibold transition ${
                  mealType === type ? "bg-gradient-to-b from-surface to-surface-2 shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {MEAL_META[type].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void log()}
            disabled={busy || chosen.length === 0}
            className="mt-3 min-h-12 w-full rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy
              ? "Logging…"
              : chosen.length === 0
                ? "Pick something to log"
                : `Log ${chosen.length} item${chosen.length === 1 ? "" : "s"} · ${total.toLocaleString()} kcal`}
          </button>
          <p className="mt-2 text-center text-xs text-muted">AI estimates can be off. Tap a meal later to fix it.</p>
        </>
      )}
    </div>
  );
}
