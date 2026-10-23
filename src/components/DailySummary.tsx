"use client";

import { CalorieRing } from "@/components/CalorieRing";
import { MacroBars } from "@/components/MacroBars";
import { CameraIcon } from "@/components/icons";
import { useLiveSessionContext } from "@/components/LiveSessionProvider";
import { useCountUp } from "@/lib/use-count-up";
import type { Goals, Nutrients } from "@/lib/types";

/**
 * The hero card at the top of Home. With meals logged it shows the calorie
 * ring and macro bars; on an empty day it invites the first scan instead of
 * showing a dead grey ring.
 */
export function DailySummary({
  totals,
  goals,
  mealCount,
}: {
  totals: Nutrients;
  goals: Goals;
  mealCount: number;
}) {
  const { controller } = useLiveSessionContext();
  const eaten = Math.round(useCountUp(totals.calories));
  const hasMeals = mealCount > 0;

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-soft via-surface to-surface-2 p-5 shadow-hero ring-1 ring-accent/15 sm:p-6">
      <div
        className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-20 size-56 rounded-full bg-protein/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative">
        {hasMeals ? (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="label-caps">Today</span>
              <span className="label-caps">Goal {goals.calories.toLocaleString()} kcal</span>
            </div>

            <div className="mt-1">
              <CalorieRing value={totals.calories} goal={goals.calories} />
            </div>

            <p className="mt-2 text-center text-sm text-muted">
              <span className="font-semibold text-foreground tabular-nums">{eaten.toLocaleString()}</span> of{" "}
              <span className="tabular-nums">{goals.calories.toLocaleString()}</span> kcal eaten
            </p>

            <div className="mt-5">
              <MacroBars totals={totals} goals={goals} />
            </div>
          </>
        ) : (
          <EmptyHero goal={goals.calories} onScan={() => void controller.start()} />
        )}
      </div>
    </section>
  );
}

function EmptyHero({ goal, onScan }: { goal: number; onScan: () => void }) {
  return (
    <div className="flex flex-col items-center px-2 py-3 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent-ink ring-1 ring-accent/25">
        <CameraIcon width={28} height={28} strokeWidth={1.8} />
      </span>
      <span className="label-caps mt-4">Today</span>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">Your day starts here</h2>
      <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-muted">
        Scan your first meal and LensBite will count the calories and macros for you.
      </p>
      <button
        type="button"
        onClick={onScan}
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg shadow-accent/20 transition active:scale-[0.97]"
      >
        <CameraIcon width={18} height={18} />
        Scan your first meal
      </button>
      <p className="mt-3 text-xs text-muted">Daily goal: {goal.toLocaleString()} kcal</p>
    </div>
  );
}
