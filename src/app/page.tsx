"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DailySummary } from "@/components/DailySummary";
import { GearIcon } from "@/components/icons";
import { MealList } from "@/components/MealList";
import { Sparkline } from "@/components/Sparkline";
import { Skeleton } from "@/components/ui";
import { localDateKey, mealsOnDay, sumNutrients } from "@/lib/nutrition";
import {
  aggregateByDay,
  refresh,
  SIGNED_OUT_MESSAGE,
  trailingRange,
  useMealsInRange,
  useStore,
} from "@/lib/storage";
import { useNow } from "@/lib/use-now";

export default function Home() {
  const { meals, goals, loaded, error, day, mealCount } = useStore();

  const now = useNow(); // null while server-rendering
  const today = useMemo(() => (now ? mealsOnDay(meals, now) : []), [meals, now]);
  const totals = useMemo(() => sumNutrients(today), [today]);

  // The last seven days, for the sparkline.
  const sparkRange = useMemo(() => (now ? trailingRange(now, 7) : null), [now]);
  const { meals: sparkMeals } = useMealsInRange(sparkRange?.from ?? "", sparkRange?.to ?? "", mealCount);
  const sparkDays = useMemo(
    () => (sparkRange ? aggregateByDay(sparkMeals, sparkRange) : []),
    [sparkMeals, sparkRange],
  );

  // The store holds one day of meals. After midnight, load the new day.
  const todayKey = now ? localDateKey(now) : null;
  useEffect(() => {
    if (loaded && todayKey && todayKey !== day) void refresh().catch(() => {});
  }, [loaded, todayKey, day]);

  return (
    <>
      <main className="mx-auto w-full max-w-md px-4 pb-nav pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-title">{now ? greeting(now) : "Welcome back"}</h1>
            <p className="mt-1 text-sm text-muted">
              {now?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card ring-1 ring-line transition hover:text-foreground"
          >
            <GearIcon width={20} height={20} />
          </Link>
        </header>

        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
            {error}{" "}
            {error === SIGNED_OUT_MESSAGE ? (
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>
            ) : (
              <button type="button" onClick={() => void refresh().catch(() => {})} className="font-semibold underline">
                Retry
              </button>
            )}
          </p>
        )}

        {loaded ? (
          <DailySummary totals={totals} goals={goals} mealCount={today.length} />
        ) : (
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-soft via-surface to-surface-2 p-5 shadow-hero ring-1 ring-accent/15 sm:p-6">
            <Skeleton className="mx-auto size-44 rounded-full sm:size-52" />
            <Skeleton className="mx-auto mt-3 h-4 w-40" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          </div>
        )}

        <div className="mt-5">
          <Sparkline days={sparkDays} goal={goals.calories} />
        </div>

        <h2 className="mb-3 mt-7 flex items-baseline justify-between px-1">
          <span className="text-lg font-semibold tracking-tight">Today&apos;s meals</span>
          {today.length > 0 && <span className="text-sm text-muted">{today.length} logged</span>}
        </h2>
        {loaded ? (
          <MealList meals={today} />
        ) : (
          <div className="space-y-2">
            <div className="h-24 animate-pulse rounded-2xl bg-track" aria-label="Loading meals" />
            <div className="h-24 animate-pulse rounded-2xl bg-track" aria-label="Loading meals" />
          </div>
        )}
      </main>
    </>
  );
}

/** "Good morning" and friends, based on the local time. */
function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
