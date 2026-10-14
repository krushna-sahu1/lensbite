"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DailySummary } from "@/components/DailySummary";
import { CameraIcon, SettingsIcon } from "@/components/icons";
import { LiveView } from "@/components/LiveView";
import { MealList } from "@/components/MealList";
import { localDateKey, mealsOnDay, sumNutrients } from "@/lib/nutrition";
import { refresh, SIGNED_OUT_MESSAGE, useStore } from "@/lib/storage";
import { useNow } from "@/lib/use-now";
import { useLiveSession } from "@/lib/use-live-session";

export default function Home() {
  const { meals, goals, loaded, error, day } = useStore();
  const { controller, state } = useLiveSession();

  const now = useNow(); // null while server-rendering
  const today = useMemo(() => (now ? mealsOnDay(meals, now) : []), [meals, now]);
  const totals = useMemo(() => sumNutrients(today), [today]);

  // The store holds one day of meals. After midnight, load the new day.
  const todayKey = now ? localDateKey(now) : null;
  useEffect(() => {
    if (loaded && todayKey && todayKey !== day) void refresh().catch(() => {});
  }, [loaded, todayKey, day]);

  return (
    <>
      <main className="mx-auto w-full max-w-md px-4 pb-36 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Lens<span className="text-accent-ink">Bite</span>
            </h1>
            <p className="h-5 text-sm text-muted">
              {now?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Link
            href="/settings"
            className="rounded-full bg-surface p-2.5 shadow-sm ring-1 ring-line transition hover:bg-track"
            aria-label="Settings"
          >
            <SettingsIcon />
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

        <DailySummary totals={totals} goals={goals} />

        <h2 className="mb-3 mt-7 flex items-baseline justify-between px-1">
          <span className="text-lg font-semibold">Today&apos;s meals</span>
          {today.length > 0 && <span className="text-sm text-muted">{today.length} logged</span>}
        </h2>
        {loaded ? (
          <MealList meals={today} />
        ) : (
          <div className="h-28 animate-pulse rounded-3xl bg-track" aria-label="Loading meals" />
        )}
      </main>

      {/* Sticky "Go Live" button */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-8">
        <button
          type="button"
          // start() must run directly in the tap handler so mobile browsers allow audio.
          onClick={() => void controller.start()}
          className="mx-auto flex h-16 w-full max-w-md items-center justify-center gap-3 rounded-full bg-foreground text-lg font-semibold text-background shadow-xl transition active:scale-[0.98]"
        >
          <CameraIcon width={22} height={22} />
          Go Live
        </button>
      </div>

      {state.status !== "idle" && <LiveView controller={controller} state={state} />}
    </>
  );
}
