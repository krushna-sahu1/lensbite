"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useChartColors } from "./use-chart-colors";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export interface WeekPoint {
  /** Local date key ("YYYY-MM-DD"). */
  key: string;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  /** Longer label used in tooltips, e.g. "Mon 21 Oct". */
  full: string;
  calories: number;
  goal: number;
  /** True when the day stayed within the goal. */
  onTarget: boolean;
  /** True when something was logged that day. */
  logged: boolean;
}

/** Bar chart of daily calories for a week, with a dashed goal line. */
export function WeekChart({ data, goal, onSelectDay }: { data: WeekPoint[]; goal: number; onSelectDay: (key: string) => void }) {
  const colors = useChartColors();
  const reduced = useReducedMotion();

  return (
    <div role="group" aria-label="Daily calories for the selected week">
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} accessibilityLayer>
            <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: colors.track, opacity: 0.55 }}
              content={<ChartTooltip />}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={goal}
              stroke={colors.fat}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: "Goal", position: "insideTopRight", fill: colors.muted, fontSize: 11 }}
            />
            <Bar
              dataKey="calories"
              radius={[8, 8, 4, 4]}
              maxBarSize={38}
              isAnimationActive={!reduced}
              animationDuration={700}
              animationEasing="ease-out"
              onClick={(entry: unknown) => {
                const point = entry as WeekPoint | undefined;
                if (point?.key) onSelectDay(point.key);
              }}
              cursor="pointer"
            >
              {data.map((point) => (
                <Cell
                  key={point.key}
                  fill={
                    !point.logged
                      ? (colors.track ?? "#eceee9")
                      : point.onTarget
                        ? (colors.accent ?? "#4ade80")
                        : (colors.fat ?? "#fb7185")
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Keyboard-reachable day buttons: the same data as the bars. */}
      <ul className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {data.map((point) => (
          <li key={point.key} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelectDay(point.key)}
              className="min-h-11 rounded-xl bg-track px-3 py-1.5 text-left transition hover:brightness-95"
              aria-label={`${point.full}: ${point.calories.toLocaleString()} calories. Show that day's meals.`}
            >
              <span className="block text-[11px] font-medium text-muted">{point.label}</span>
              <span className="block text-sm font-semibold tabular-nums">{point.calories.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
