"use client";

import { useState, type ReactNode } from "react";
import { nutrientLevel, scoreLevel, type NutrientLevel } from "@/lib/label";
import type { MenuPicks, ProductComparison, RecipeIdeas } from "@/lib/live-cards";
import type { LabelNutrients } from "@/lib/types";
import { ChevronDownIcon, CloseIcon } from "./icons";

const LEVEL_TEXT: Record<NutrientLevel, string> = { good: "text-accent", medium: "text-carbs", bad: "text-fat" };
const LEVEL_BG: Record<NutrientLevel, string> = { good: "bg-accent text-black", medium: "bg-carbs text-black", bad: "bg-fat text-black" };

/** Glass card shell shared by the Live overlays: tap the header to collapse, ✕ to close. */
function CardShell({
  label,
  title,
  subtitle,
  badge,
  onClose,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      className="overflow-hidden rounded-3xl bg-white/12 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl"
      aria-label={label}
    >
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-expanded={open}>
          {badge}
          <span className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{label}</span>
            <span className="mt-0.5 line-clamp-2 block text-base font-semibold leading-snug">{title}</span>
            {subtitle && <span className={`mt-1 block text-sm leading-snug text-white/80 ${open ? "" : "line-clamp-1"}`}>{subtitle}</span>}
          </span>
          <ChevronDownIcon width={18} height={18} className={`mt-1 shrink-0 text-white/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
          aria-label={`Close ${label.toLowerCase()}`}
        >
          <CloseIcon width={18} height={18} />
        </button>
      </div>
      {open && <div className="border-t border-white/15 px-4 pb-4 pt-3 text-sm">{children}</div>}
    </section>
  );
}

const kcal = (n: number) => `${n.toLocaleString()} kcal`;

/** MENU mode: the dishes that fit what's left today, plus a couple to skip. */
export function MenuCard({ menu, onClose }: { menu: MenuPicks; onClose: () => void }) {
  const [top] = menu.picks;
  return (
    <CardShell
      label="Menu picks"
      title={menu.restaurant ? `Best at ${menu.restaurant}` : `Order the ${top.dish}`}
      subtitle={menu.restaurant ? `Top pick: ${top.dish}` : top.why}
      onClose={onClose}
    >
      <ol className="space-y-2.5">
        {menu.picks.map((pick, i) => (
          <li key={i} className="flex gap-3">
            <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-accent text-black" : "bg-white/15"}`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold leading-snug">{pick.dish}</p>
                <span className="shrink-0 text-xs tabular-nums text-white/75">
                  ~{kcal(pick.calories)}
                  {pick.protein_g ? ` · ${pick.protein_g} g P` : ""}
                </span>
              </div>
              <p className="mt-0.5 leading-snug text-white/75">{pick.why}</p>
              {pick.tip && <p className="mt-1 text-xs text-accent">Tip: {pick.tip}</p>}
            </div>
          </li>
        ))}
      </ol>
      {menu.avoid.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/50">Looks healthy, isn&apos;t</p>
          <ul className="space-y-1">
            {menu.avoid.map((a, i) => (
              <li key={i} className="flex gap-1.5 leading-snug">
                <span className="shrink-0 font-bold text-fat" aria-hidden="true">
                  ✕
                </span>
                <span>
                  <span className="font-medium">{a.dish}</span> <span className="text-white/70">– {a.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardShell>
  );
}

/** FRIDGE mode: meals that use what's there. */
export function RecipesCard({ recipes, onClose }: { recipes: RecipeIdeas; onClose: () => void }) {
  const [openIndex, setOpenIndex] = useState(0);
  const [first] = recipes.ideas;
  return (
    <CardShell label="Meal ideas" title={first.title} subtitle={`${recipes.ideas.length} idea${recipes.ideas.length === 1 ? "" : "s"} from what you've got`} onClose={onClose}>
      <ul className="space-y-2">
        {recipes.ideas.map((idea, i) => {
          const expanded = openIndex === i;
          return (
            <li key={i} className="rounded-2xl bg-white/8 ring-1 ring-white/10">
              <button type="button" onClick={() => setOpenIndex(expanded ? -1 : i)} aria-expanded={expanded} className="flex w-full items-start gap-2 p-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{idea.title}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-white/70">
                    ~{kcal(idea.calories)}
                    {idea.protein_g ? ` · ${idea.protein_g} g protein` : ""}
                    {idea.minutes ? ` · ${idea.minutes} min` : ""}
                  </span>
                </span>
                <ChevronDownIcon width={16} height={16} className={`mt-1 shrink-0 text-white/60 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="space-y-2 px-3 pb-3">
                  {idea.uses.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {idea.uses.map((u) => (
                        <li key={u} className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-accent">
                          {u}
                        </li>
                      ))}
                      {idea.missing.map((m) => (
                        <li key={m} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
                          + {m}
                        </li>
                      ))}
                    </ul>
                  )}
                  {idea.steps.length > 0 && (
                    <ol className="list-decimal space-y-1 pl-5 leading-snug text-white/85">
                      {idea.steps.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

const COMPARE_ROWS: { key: keyof LabelNutrients; label: string; unit: string; better: "lower" | "higher" }[] = [
  { key: "calories", label: "Calories", unit: "kcal", better: "lower" },
  { key: "sugar_g", label: "Sugars", unit: "g", better: "lower" },
  { key: "saturated_fat_g", label: "Sat. fat", unit: "g", better: "lower" },
  { key: "sodium_mg", label: "Sodium", unit: "mg", better: "lower" },
  { key: "protein_g", label: "Protein", unit: "g", better: "higher" },
  { key: "fiber_g", label: "Fiber", unit: "g", better: "higher" },
];

/** COMPARE mode: rated products side by side, per 100 g/ml, best value in each row highlighted. */
export function ComparisonCard({ comparison, onClose }: { comparison: ProductComparison; onClose: () => void }) {
  const { products, winnerIndex } = comparison;
  const winner = winnerIndex === null ? null : products[winnerIndex];
  const units = new Set(products.map((p) => p.unit));
  const unit = units.size === 1 ? [...units][0] : "g/ml";

  return (
    <CardShell
      label="Comparison"
      title={winner ? `${winner.name} wins` : "It depends"}
      subtitle={comparison.verdict}
      onClose={onClose}
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[18rem] tabular-nums">
          <thead>
            <tr className="align-bottom">
              <th className="pb-2 pl-1 text-left text-[11px] font-medium uppercase tracking-wide text-white/50">Per 100 {unit}</th>
              {products.map((p, i) => (
                <th key={i} className="px-1 pb-2 text-right">
                  <span className={`ml-auto mb-1 flex size-9 items-center justify-center rounded-xl text-sm font-bold ${LEVEL_BG[scoreLevel(p.score)]}`}>{p.score}</span>
                  <span className={`line-clamp-2 text-xs font-semibold leading-tight ${i === winnerIndex ? "text-accent" : ""}`}>
                    {i === winnerIndex && "★ "}
                    {p.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(({ key, label, unit: u, better }) => {
              const values = products.map((p) => p.per100[key]);
              const known = values.filter((v): v is number => v !== undefined);
              if (known.length < 2) return null;
              const best = better === "lower" ? Math.min(...known) : Math.max(...known);
              return (
                <tr key={key} className="border-t border-white/10">
                  <td className="py-1.5 pl-1 text-white/80">{label}</td>
                  {values.map((v, i) => {
                    const level = v === undefined ? undefined : nutrientLevel(key, products[i].per100, products[i].unit);
                    const isBest = v !== undefined && v === best && known.some((k) => k !== best);
                    return (
                      <td key={i} className={`px-1 py-1.5 text-right ${level ? LEVEL_TEXT[level] : ""} ${isBest ? "font-bold" : ""}`}>
                        {v === undefined ? "—" : `${v.toLocaleString()} ${u}`}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-white/55">Bold = best in the row. Colors follow UK traffic-light levels.</p>
    </CardShell>
  );
}
