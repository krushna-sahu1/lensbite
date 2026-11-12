"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { PlusIcon, ScaleIcon } from "@/components/icons";
import { useProfile, useWeights } from "@/lib/body";
import { formatWeight, fromKg, type Units } from "@/lib/energy";
import { computeTrend, summarizeTrend } from "@/lib/weight-trend";
import { WeightSheet } from "./WeightSheet";

const WeightChart = dynamic(() => import("./WeightChart").then((m) => m.WeightChart), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-track" />,
});

function rateText(rate: number | null, units: Units) {
  if (rate === null) return "Log a week of weigh-ins to see your rate";
  const value = Math.abs(fromKg(rate, units));
  if (value < 0.05) return "Holding steady";
  return `${rate < 0 ? "Down" : "Up"} ${value.toFixed(units === "imperial" ? 1 : 2)} ${units === "imperial" ? "lb" : "kg"} a week`;
}

/**
 * Weight trend: latest smoothed weight, weekly rate and a Log button.
 * `variant="card"` is the compact home card; "full" adds the chart (Insights).
 */
export function WeightSummary({ variant }: { variant: "card" | "full" }) {
  const { profile } = useProfile();
  const weights = useWeights(variant === "full" ? 180 : 60);
  const [open, setOpen] = useState(false);
  const units: Units = profile?.units ?? "metric";

  const points = useMemo(() => computeTrend(weights.entries), [weights.entries]);
  const summary = useMemo(() => summarizeTrend(points), [points]);

  // Hidden until the weights table exists (migration applied).
  if (!weights.loaded || !weights.available) return null;

  const logButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-track px-3.5 text-sm font-semibold transition hover:brightness-95 active:scale-95"
    >
      <PlusIcon width={15} height={15} />
      Log
    </button>
  );

  return (
    <>
      <section
        aria-label="Weight"
        className={variant === "card" ? "rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line" : ""}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-protein/15 text-protein-ink ring-1 ring-protein/20" aria-hidden="true">
            <ScaleIcon width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-caps">Weight trend</p>
            {summary ? (
              <>
                <p className="text-lg font-semibold tabular-nums">{formatWeight(summary.current, units)}</p>
                <p className="text-xs text-muted">{rateText(summary.weeklyRate, units)}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Weigh in to see your trend, not the daily noise.</p>
            )}
          </div>
          {logButton}
        </div>
        {variant === "full" && points.length >= 2 && (
          <div className="mt-4">
            <WeightChart points={points} units={units} />
            <p className="mt-1 text-[11px] text-muted">Dots: daily weigh-ins. Line: smoothed trend, which ignores day-to-day water swings.</p>
          </div>
        )}
      </section>
      <WeightSheet open={open} onClose={() => setOpen(false)} units={units} entries={weights.entries} />
    </>
  );
}
