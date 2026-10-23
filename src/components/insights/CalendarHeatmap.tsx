"use client";

import type { DayTotals } from "@/lib/storage";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEGEND = [
  { className: "bg-heat-0", label: "Nothing logged" },
  { className: "bg-heat-1/80", label: "Under half the goal" },
  { className: "bg-heat-2/70", label: "Half to the goal" },
  { className: "bg-heat-3/70", label: "Just over the goal" },
  { className: "bg-heat-4/70", label: "Well over the goal" },
];

/** Background step for a day, based on how much of the goal it hit. */
function heatClass(day: DayTotals | undefined, goal: number): string {
  if (!day?.logged || goal <= 0) return "bg-heat-0";
  const ratio = day.calories / goal;
  if (ratio < 0.5) return "bg-heat-1/80";
  if (ratio <= 1) return "bg-heat-2/70";
  if (ratio <= 1.25) return "bg-heat-3/70";
  return "bg-heat-4/70";
}

/**
 * Calendar heatmap for a month. Every cell is a button, so tapping a day (or
 * tabbing to it and pressing Enter) opens that day's meals.
 */
export function CalendarHeatmap({
  anchor,
  days,
  goal,
  onSelectDay,
}: {
  /** Any day inside the month to draw. */
  anchor: Date;
  days: DayTotals[];
  goal: number;
  onSelectDay: (key: string) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Math.ceil((leading + daysInMonth) / 7) * 7;

  const byKey = new Map(days.map((day) => [day.day, day]));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Month calendar">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="label-caps pb-1 text-center" aria-hidden="true">
            {weekday.slice(0, 1)}
          </div>
        ))}

        {Array.from({ length: cells }, (_, index) => {
          const dayNumber = index - leading + 1;
          if (dayNumber < 1 || dayNumber > daysInMonth) {
            return <div key={`blank-${index}`} className="aspect-square" aria-hidden="true" />;
          }

          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
          const day = byKey.get(key);
          const calories = day?.calories ?? 0;
          const percent = goal > 0 ? Math.round((calories / goal) * 100) : 0;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={`${dayNumber} ${new Date(year, month, dayNumber).toLocaleDateString([], {
                month: "long",
              })}: ${calories.toLocaleString()} calories, ${percent}% of goal. Show that day's meals.`}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums transition hover:scale-[1.04] active:scale-95 ${
                heatClass(day, goal)
              } ${isToday ? "ring-2 ring-accent-ink ring-offset-1 ring-offset-surface" : ""}`}
            >
              <span>{dayNumber}</span>
              {calories > 0 && <span className="text-[9px] font-medium opacity-70">{percent}%</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="label-caps">Less</span>
        {LEGEND.map((step) => (
          <span key={step.label} className="flex items-center gap-1.5">
            <span className={`size-3 rounded ${step.className}`} aria-hidden="true" />
            <span className="sr-only">{step.label}</span>
          </span>
        ))}
        <span className="label-caps">More</span>
      </div>
    </div>
  );
}
