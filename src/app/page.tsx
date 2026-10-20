"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DailySummary } from "@/components/DailySummary";
import { CameraIcon } from "@/components/icons";
import { LiveView } from "@/components/LiveView";
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
import { useLiveSession } from "@/lib/use-live-session";

export default function Home() {
  const { meals, goals, loaded, error, day, mealCount } = useStore();
  const { controller, state } = useLiveSession();

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
      <main className="mx-auto w-full max-w-md px-4 pb-44 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="mb-6">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            {now ? greeting(now) : "Welcome back"}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {now?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </p>
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
          <DailySummary totals={totals} goals={goals} />
        ) : (
          <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
            <Skeleton className="mx-auto size-44 rounded-full" />
            <Skeleton className="mx-auto mt-3 h-4 w-40" />
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
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

      {/* Sticky "Go Live" button, floating above the bottom navigation. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),4.75rem)]">
        <button
          type="button"
          // start() must run directly in the tap handler so mobile browsers allow audio.
          onClick={() => void controller.start()}
          className="pointer-events-auto relative flex h-14 items-center justify-center gap-2.5 rounded-full bg-foreground px-9 text-base font-semibold text-background shadow-2xl transition active:scale-[0.97]"
        >
          <span
            className="absolute inset-0 -z-10 animate-[halo_2.6s_ease-out_infinite] rounded-full bg-accent/70"
            aria-hidden="true"
          />
          <CameraIcon width={21} height={21} />
          Go Live
        </button>
      </div>

      <BottomNav />

      {state.status !== "idle" && <LiveView controller={controller} state={state} />}
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
