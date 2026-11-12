"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddFoodSheet } from "@/components/add/AddFoodSheet";
import { BarcodeScanner } from "@/components/add/BarcodeScanner";
import { DailySummary } from "@/components/DailySummary";
import { CompareIcon, FridgeIcon, GearIcon, MenuBookIcon, PlusIcon, SparkIcon } from "@/components/icons";
import { useLiveSessionContext } from "@/components/LiveSessionProvider";
import { MealEditor, type MealEditorTarget } from "@/components/MealEditor";
import { MealList } from "@/components/MealList";
import { Toast } from "@/components/Toast";
import { Sparkline } from "@/components/Sparkline";
import { Skeleton } from "@/components/ui";
import { WeightSummary } from "@/components/weight/WeightSummary";
import { useProfile } from "@/lib/body";
import type { LiveMode } from "@/lib/live-cards";
import { localDateKey, mealsOnDay, sumNutrients } from "@/lib/nutrition";
import {
  aggregateByDay,
  deleteMeal,
  refresh,
  SIGNED_OUT_MESSAGE,
  trailingRange,
  useMealsInRange,
  useStore,
} from "@/lib/storage";
import type { Meal } from "@/lib/types";
import { useNow } from "@/lib/use-now";

/** Live modes worth starting straight from home. */
const CAMERA_SHORTCUTS: { mode: LiveMode; label: string; hint: string; icon: typeof MenuBookIcon }[] = [
  { mode: "menu", label: "Menu", hint: "What to order", icon: MenuBookIcon },
  { mode: "fridge", label: "Fridge", hint: "What to cook", icon: FridgeIcon },
  { mode: "compare", label: "Compare", hint: "Which to buy", icon: CompareIcon },
];

export default function Home() {
  const { meals, goals, loaded, error, day, revision } = useStore();

  const now = useNow(); // null while server-rendering
  const [editing, setEditing] = useState<MealEditorTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: Meal[] } | null>(null);
  const { controller } = useLiveSessionContext();
  const { profile, available: profileAvailable, loaded: profileLoaded } = useProfile();
  const showOnboarding = loaded && profileLoaded && profileAvailable && !profile?.completedAt;

  function onLogged(logged: Meal[]) {
    if (!logged.length) return;
    const kcal = logged.reduce((sum, m) => sum + m.calories, 0);
    setToast({
      message: logged.length === 1 ? `Logged ${logged[0].name} · ${kcal} kcal` : `Logged ${logged.length} items · ${kcal} kcal`,
      undo: logged,
    });
  }

  async function undo(meals: Meal[]) {
    setToast(null);
    try {
      for (const meal of meals) await deleteMeal(meal.id);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Couldn't undo that." });
    }
  }
  const today = useMemo(() => (now ? mealsOnDay(meals, now) : []), [meals, now]);
  const totals = useMemo(() => sumNutrients(today), [today]);

  // The last seven days, for the sparkline.
  const sparkRange = useMemo(() => (now ? trailingRange(now, 7) : null), [now]);
  const { meals: sparkMeals } = useMealsInRange(sparkRange?.from ?? "", sparkRange?.to ?? "", revision);
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

        {showOnboarding && (
          <Link
            href="/onboarding"
            className="mb-4 flex items-center gap-3 rounded-3xl bg-gradient-to-br from-accent-soft to-surface p-4 shadow-card ring-1 ring-accent/20 transition active:scale-[0.99]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-black" aria-hidden="true">
              <SparkIcon width={20} height={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Personalize your goals</span>
              <span className="block text-sm text-muted">
                {goals.calories.toLocaleString()} kcal is a default. Get a target that fits your body and goal.
              </span>
            </span>
          </Link>
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

        {/* Ask the camera: Live sessions that start in a specific mode. */}
        <div className="mt-5 grid grid-cols-3 gap-2" role="group" aria-label="Ask the camera">
          {CAMERA_SHORTCUTS.map(({ mode, label, hint, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              // start() must run directly in the tap handler so mobile browsers allow audio.
              onClick={() => void controller.start(mode)}
              className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-3 text-left shadow-card ring-1 ring-line transition hover:bg-surface-2 active:scale-[0.98]"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
                <Icon width={18} height={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px] text-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <WeightSummary variant="card" />
        </div>

        <div className="mb-3 mt-7 flex items-center justify-between gap-3 px-1">
          <h2 className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">Today&apos;s meals</span>
            {today.length > 0 && <span className="text-sm text-muted">{today.length} logged</span>}
          </h2>
          <button
            type="button"
            disabled={!loaded}
            onClick={() => setAdding(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold shadow-card ring-1 ring-line transition hover:bg-surface-2 active:scale-95 disabled:opacity-60"
          >
            <PlusIcon width={16} height={16} />
            Add
          </button>
        </div>
        {loaded ? (
          <MealList meals={today} onEdit={(meal) => setEditing({ mode: "edit", meal })} />
        ) : (
          <div className="space-y-2">
            <div className="h-24 animate-pulse rounded-2xl bg-track" aria-label="Loading meals" />
            <div className="h-24 animate-pulse rounded-2xl bg-track" aria-label="Loading meals" />
          </div>
        )}
      </main>

      <AddFoodSheet
        open={adding}
        onClose={() => setAdding(false)}
        onLogged={onLogged}
        onBarcode={() => {
          setAdding(false);
          setScanning(true);
        }}
        onManual={() => {
          setAdding(false);
          setEditing({ mode: "add", at: new Date() });
        }}
      />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onLogged={onLogged} />
      <MealEditor target={editing} onClose={() => setEditing(null)} onSaved={(message) => setToast({ message })} />
      {toast && (
        <Toast
          message={toast.message}
          duration={toast.undo ? 6000 : 4000}
          action={toast.undo ? { label: "Undo", onClick: () => void undo(toast.undo!) } : undefined}
          onDismiss={() => setToast(null)}
        />
      )}
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
