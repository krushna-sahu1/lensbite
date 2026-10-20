"use client";

import { useRef, useState } from "react";
import { Toast } from "@/components/Toast";
import { deleteMeal, restoreMeal } from "@/lib/storage";
import { MEAL_TYPES, type Meal, type MealType } from "@/lib/types";
import { TrashIcon } from "./icons";

const TYPE_STYLES: Record<MealType, string> = {
  breakfast: "bg-carbs/15 text-carbs-ink",
  lunch: "bg-accent/15 text-accent-ink",
  dinner: "bg-protein/15 text-protein-ink",
  snack: "bg-fat/15 text-fat-ink",
};

const TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/** How far the row has to travel before the swipe counts as a delete. */
const DELETE_THRESHOLD = 96;

/**
 * Today's meals, grouped by type. A row can be swiped left to delete it; the
 * delete can be undone from the toast that pops up afterwards.
 */
export function MealList({ meals }: { meals: Meal[] }) {
  const [toast, setToast] = useState<{ message: string; error?: boolean; action?: { label: string; onClick: () => void } } | null>(
    null,
  );

  async function remove(meal: Meal) {
    try {
      await deleteMeal(meal.id);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Couldn't delete that meal.", error: true });
      return;
    }
    setToast({
      message: `"${meal.name}" deleted`,
      action: {
        label: "Undo",
        onClick: () => {
          void restoreMeal(meal).catch((err: unknown) => {
            setToast({
              message: err instanceof Error ? err.message : "Couldn't bring that meal back.",
              error: true,
            });
          });
          setToast(null);
        },
      },
    });
  }

  if (meals.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-medium">No meals logged today</p>
        <p className="mt-1 text-sm text-muted">
          Tap <span className="font-medium text-foreground">Go Live</span>, point your camera at your food and ask
          &ldquo;How many calories is this?&rdquo;
        </p>
      </div>
    );
  }

  const groups = MEAL_TYPES.map((type) => ({
    type,
    meals: meals.filter((meal) => meal.mealType === type),
  })).filter((group) => group.meals.length > 0);

  return (
    <>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.type} aria-labelledby={`group-${group.type}`}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 id={`group-${group.type}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
                {TYPE_LABELS[group.type]}
              </h3>
              <span className="text-xs text-muted tabular-nums">
                {group.meals.reduce((sum, meal) => sum + meal.calories, 0).toLocaleString()} kcal
              </span>
            </div>
            <ul className="space-y-2">
              {[...group.meals].reverse().map((meal) => (
                <MealRow key={meal.id} meal={meal} onDelete={() => void remove(meal)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          error={toast.error}
          action={toast.action}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

/**
 * One meal. It can be swiped left to delete it; the trash button does the
 * same thing for anyone not using a touch screen.
 */
function MealRow({ meal, onDelete }: { meal: Meal; onDelete: () => void }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  /** The offset as it is right now, so a fast swipe can't read a stale value. */
  const liveOffset = useRef(0);

  function apply(next: number) {
    liveOffset.current = next;
    setOffset(next);
  }

  function onPointerDown(event: React.PointerEvent<HTMLLIElement>) {
    startX.current = event.clientX;
    startOffset.current = liveOffset.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLLIElement>) {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    // Only swiping left does anything.
    if (delta > 0 && startOffset.current === 0) return;
    apply(Math.max(-140, Math.min(0, startOffset.current + delta)));
  }

  function onPointerUp() {
    if (startX.current === null) return;
    startX.current = null;
    const current = liveOffset.current;
    if (current <= -DELETE_THRESHOLD) {
      apply(0);
      onDelete();
      return;
    }
    // Snap back, or stay open just enough to show the delete hint.
    apply(current < -24 ? -DELETE_THRESHOLD : 0);
  }

  return (
    <li
      className="relative touch-pan-y overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Revealed by the swipe. */}
      <div
        className="absolute inset-y-0 right-0 flex w-28 items-center justify-center gap-1.5 bg-fat text-sm font-semibold text-white"
        aria-hidden="true"
      >
        <TrashIcon width={16} height={16} />
        Delete
      </div>

      <div
        className="relative flex items-start gap-3 bg-surface p-4 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${TYPE_STYLES[meal.mealType]}`}>
              {meal.mealType}
            </span>
            <span className="text-xs text-muted">
              {new Date(meal.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <p className="mt-1.5 truncate font-medium">{meal.name}</p>
          <p className="mt-0.5 text-xs text-muted tabular-nums">
            P {meal.protein_g}g · C {meal.carbs_g}g · F {meal.fat_g}g · Fiber {meal.fiber_g}g
          </p>
          {meal.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{meal.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-semibold tabular-nums">
            {meal.calories}
            <span className="ml-0.5 text-xs font-normal text-muted">kcal</span>
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="-mr-1.5 -mt-0.5 flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-track hover:text-fat-ink"
            aria-label={`Delete ${meal.name}`}
          >
            <TrashIcon width={17} height={17} />
          </button>
        </div>
      </div>
    </li>
  );
}
