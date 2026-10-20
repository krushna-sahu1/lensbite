"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Nutrients } from "@/lib/types";
import { ChartTooltip } from "./ChartTooltip";
import { useChartColors } from "./use-chart-colors";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Calories per gram, used to turn the macro split into a share of energy. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

export interface MacroSlice {
  key: "protein" | "carbs" | "fat";
  label: string;
  grams: number;
  calories: number;
  share: number;
}

/** Splits protein, carbs and fat into a share of the period's energy. */
export function macroSlices(totals: Nutrients): MacroSlice[] {
  const calories = {
    protein: totals.protein_g * KCAL_PER_GRAM.protein,
    carbs: totals.carbs_g * KCAL_PER_GRAM.carbs,
    fat: totals.fat_g * KCAL_PER_GRAM.fat,
  };
  const total = calories.protein + calories.carbs + calories.fat;
  const slices: MacroSlice[] = [
    { key: "protein", label: "Protein", grams: totals.protein_g, calories: calories.protein, share: 0 },
    { key: "carbs", label: "Carbs", grams: totals.carbs_g, calories: calories.carbs, share: 0 },
    { key: "fat", label: "Fat", grams: totals.fat_g, calories: calories.fat, share: 0 },
  ];
  if (total > 0) for (const slice of slices) slice.share = slice.calories / total;
  return slices;
}

/** Donut chart of the protein / carbs / fat split for the selected period. */
export function MacroDonut({ totals }: { totals: Nutrients }) {
  const colors = useChartColors();
  const reduced = useReducedMotion();
  const slices = macroSlices(totals);
  const data = slices.map((slice) => ({
    name: slice.label,
    value: Math.round(slice.calories),
    grams: slice.grams,
    share: slice.share,
  }));
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  const fill = {
    protein: colors.protein ?? "#38bdf8",
    carbs: colors.carbs ?? "#fbbf24",
    fat: colors.fat ?? "#fb7185",
  };

  return (
    <div>
      <div className="relative mx-auto h-52 w-52" role="group" aria-label="Macro split for the selected period">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} isAnimationActive={false} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={700}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={fill[entry.name.toLowerCase() as keyof typeof fill]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{total.toLocaleString()}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted">kcal from macros</span>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2">
        {slices.map((slice) => (
          <li key={slice.key} className="rounded-2xl bg-track px-3 py-2 text-center">
            <span
              className="mx-auto mb-1.5 block size-2.5 rounded-full"
              style={{ background: fill[slice.key] }}
              aria-hidden="true"
            />
            <span className="block text-[11px] font-medium text-muted">{slice.label}</span>
            <span className="block text-sm font-semibold tabular-nums">{Math.round(slice.grams)}g</span>
            <span className="block text-[11px] tabular-nums text-muted">
              {slice.share > 0 ? `${Math.round(slice.share * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
