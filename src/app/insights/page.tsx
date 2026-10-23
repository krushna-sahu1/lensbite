"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CalendarHeatmap } from "@/components/insights/CalendarHeatmap";
import { DaySheet } from "@/components/insights/DaySheet";
import { StatCards } from "@/components/insights/StatCards";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Card, EmptyState, SectionTitle, SegmentedControl, Skeleton } from "@/components/ui";
import { localDateKey, sumNutrients } from "@/lib/nutrition";
import {
  aggregateByDay,
  localDateFromKey,
  previousRange,
  rangeFor,
  shiftRange,
  summarize,
  useMealsInRange,
  useStore,
  type DateRange,
  type Period,
} from "@/lib/storage";
import { useNow } from "@/lib/use-now";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const PERIOD_NAME: Record<Period, string> = { day: "day", week: "week", month: "month" };
const PREVIOUS_NAME: Record<Period, string> = { day: "yesterday", week: "last week", month: "last month" };

// The charts are the heaviest part of the app, so they load on their own.
const WeekChart = dynamic(() => import("@/components/insights/WeekChart").then((m) => m.WeekChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const MonthAreaChart = dynamic(() => import("@/components/insights/MonthAreaChart").then((m) => m.MonthAreaChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const MacroDonut = dynamic(() => import("@/components/insights/MacroDonut").then((m) => m.MacroDonut), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export default function InsightsPage() {
  const { goals, mealCount, loaded } = useStore();
  const now = useNow();

  const [period, setPeriod] = useState<Period>("week");
  /** How many periods away from today the view is (0 = the current period). */
  const [offset, setOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // The anchor is derived from the real "now" (the server has no clock).
  const anchor = useMemo(() => {
    if (!now) return null;
    const shifted = new Date(now);
    if (period === "day") shifted.setDate(shifted.getDate() + offset);
    else if (period === "week") shifted.setDate(shifted.getDate() + 7 * offset);
    else shifted.setMonth(shifted.getMonth() + offset);
    return shifted;
  }, [now, period, offset]);

  const range = useMemo(() => (anchor ? rangeFor(period, anchor) : null), [period, anchor]);
  const before = useMemo(() => (range ? previousRange(range) : null), [range]);

  const current = useMealsInRange(range?.from ?? "", range?.to ?? "", mealCount);
  const previous = useMealsInRange(before?.from ?? "", before?.to ?? "", mealCount);

  const days = useMemo(() => (range ? aggregateByDay(current.meals, range) : []), [current.meals, range]);
  const previousDays = useMemo(() => (before ? aggregateByDay(previous.meals, before) : []), [previous.meals, before]);
  const stats = useMemo(() => summarize(days, goals.calories, previousDays), [days, goals.calories, previousDays]);
  const totals = useMemo(() => sumNutrients(days.flatMap((day) => day.meals)), [days]);

  const selected = useMemo(() => days.find((day) => day.day === selectedDay) ?? null, [days, selectedDay]);

  const todayKey = now ? localDateKey(now) : "";
  const canGoNext = range ? shiftRange(range, period, 1).start <= todayKey : false;
  const currentStart = now ? rangeFor(period, now).start : "";
  const isCurrentPeriod = range?.start === currentStart;

  function changePeriod(next: Period) {
    setPeriod(next);
    setOffset(0);
    setSelectedDay(null);
  }

  function move(direction: 1 | -1) {
    setOffset((current) => current + direction);
    setSelectedDay(null);
  }

  const loading = current.loading || previous.loading || !range;

  return (
    <>
      <main className="mx-auto w-full max-w-md px-4 pb-nav pt-[max(env(safe-area-inset-top),1.25rem)]">
        <header className="mb-5">
          <h1 className="page-title">Insights</h1>
          <p className="mt-1 text-sm text-muted">How your calories and macros are tracking.</p>
        </header>

        <SegmentedControl options={PERIODS} value={period} onChange={changePeriod} label="Period" />

        {/* Period navigation */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={!range}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card ring-1 ring-line transition hover:text-foreground disabled:opacity-40"
            aria-label={`Previous ${PERIOD_NAME[period]}`}
          >
            <ChevronLeftIcon />
          </button>

          <div className="min-w-0 flex-1 text-center">
            {range ? (
              <>
                <p className="truncate text-sm font-semibold">{formatRangeLabel(range, period)}</p>
                {period !== "day" && (
                  <p className="text-xs text-muted">
                    {days.filter((day) => day.logged).length} of {range.days} days logged
                  </p>
                )}
              </>
            ) : (
              <Skeleton className="mx-auto h-4 w-40" />
            )}
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            disabled={!canGoNext}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card ring-1 ring-line transition hover:text-foreground disabled:opacity-40"
            aria-label={`Next ${PERIOD_NAME[period]}`}
          >
            <ChevronRightIcon />
          </button>
        </div>

        {!isCurrentPeriod && range && now && (
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              setSelectedDay(null);
            }}
            className="mx-auto mt-3 block rounded-full bg-track px-4 py-2 text-xs font-semibold transition hover:brightness-95"
          >
            Back to today
          </button>
        )}

        {/* Stats */}
        <div className="mt-6">
          {loading || !loaded ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
              <Skeleton className="col-span-2 h-28 rounded-3xl" />
            </div>
          ) : (
            <StatCards
              stats={stats}
              goal={goals.calories}
              days={range?.days ?? 0}
              previousLabel={PREVIOUS_NAME[period]}
            />
          )}
        </div>

        {/* Period specific visuals */}
        <div className="mt-6 space-y-5">
          {period === "day" && (
            <Card>
              <SectionTitle
                title="That day"
                hint={range ? formatRangeLabel(range, "day") : undefined}
              />
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              ) : days[0] && days[0].meals.length > 0 ? (
                <ul className="space-y-2">
                  {days[0].meals.map((meal) => (
                    <li key={meal.id} className="rounded-2xl bg-track/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{meal.name}</p>
                          <p className="mt-0.5 text-xs text-muted capitalize">
                            {meal.mealType} ·{" "}
                            {new Date(meal.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {meal.calories}
                          <span className="ml-0.5 text-xs font-normal text-muted">kcal</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nothing logged that day" description="Meals logged by the AI will show up here." />
              )}
            </Card>
          )}

          {period === "week" && (
            <Card>
              <SectionTitle title="Calories per day" hint="Bars are daily totals. The dashed line is your goal." />
              {loading ? (
                <Skeleton className="h-60 rounded-2xl" />
              ) : (
                <WeekChart
                  data={days.map((day) => ({
                    key: day.day,
                    label: day.date.toLocaleDateString([], { weekday: "short" }),
                    full: day.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
                    calories: day.calories,
                    goal: goals.calories,
                    onTarget: day.logged && day.calories <= goals.calories,
                    logged: day.logged,
                    isToday: day.day === todayKey,
                  }))}
                  goal={goals.calories}
                  onSelectDay={setSelectedDay}
                />
              )}
            </Card>
          )}

          {period === "month" && (
            <>
              <Card>
                <SectionTitle title="Calendar" hint="Each square is a day, coloured by how much of your goal it hit." />
                {loading || !range ? (
                  <Skeleton className="h-64 rounded-2xl" />
                ) : (
                  <CalendarHeatmap
                    anchor={localDateFromKey(range.start)}
                    days={days}
                    goal={goals.calories}
                    onSelectDay={setSelectedDay}
                  />
                )}
              </Card>

              <Card>
                <SectionTitle title="Calories over the month" />
                {loading ? (
                  <Skeleton className="h-56 rounded-2xl" />
                ) : (
                  <MonthAreaChart
                    data={days.map((day) => ({
                      key: day.day,
                      label: String(day.date.getDate()),
                      full: day.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
                      calories: day.calories,
                      goal: goals.calories,
                      logged: day.logged,
                      isToday: day.day === todayKey,
                    }))}
                    goal={goals.calories}
                  />
                )}
              </Card>
            </>
          )}

          <Card>
            <SectionTitle
              title="Macro split"
              hint={`Protein, carbs and fat across the ${PERIOD_NAME[period]}.`}
            />
            {loading ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <MacroDonut totals={totals} />
            )}
          </Card>
        </div>
      </main>

      <DaySheet day={selected} goal={goals.calories} onClose={() => setSelectedDay(null)} />
    </>
  );
}

/** "Mon, 21 Oct", "21 – 27 Oct" or "October 2026", depending on the period. */
function formatRangeLabel(range: DateRange, period: Period): string {
  const start = localDateFromKey(range.start);
  const end = localDateFromKey(range.end);

  if (period === "month") return start.toLocaleDateString([], { month: "long", year: "numeric" });
  if (period === "day") return start.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${end.toLocaleDateString([], { month: "short" })}`;
  }
  return `${start.getDate()} ${start.toLocaleDateString([], { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString([], { month: "short" })}`;
}

/** Placeholder shown while a chart bundle is still loading. */
function ChartSkeleton() {
  return <Skeleton className="h-60 rounded-2xl" />;
}
