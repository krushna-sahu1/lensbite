"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from "recharts";
import { compactNumber } from "@/lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartColors, type ChartColors } from "./use-chart-colors";

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
  /** True for today, which gets the strongest bar. */
  isToday: boolean;
}

/** Rounded bar chart of daily calories for a week, with a soft goal hairline. */
export function WeekChart({
  data,
  goal,
  onSelectDay,
}: {
  data: WeekPoint[];
  goal: number;
  onSelectDay: (key: string) => void;
}) {
  const colors = useChartColors();
  const uid = useId().replace(/:/g, "");

  return (
    <div role="group" aria-label="Daily calories for the selected week">
      <div className="mb-1 flex items-center justify-end gap-1.5 text-[10px] font-medium text-muted">
        <span className="inline-block w-4 border-t border-dashed border-muted/50" aria-hidden="true" />
        Goal
      </div>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 32, bottom: 0, left: -8 }} accessibilityLayer barCategoryGap="26%">
            <defs>
              <linearGradient id={`${uid}-today`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent ?? "#4ade80"} />
                <stop offset="100%" stopColor={colors.accentInk ?? "#15803d"} />
              </linearGradient>
              <linearGradient id={`${uid}-bar`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.9} />
                <stop offset="100%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.42} />
              </linearGradient>
              <linearGradient id={`${uid}-over`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.carbs ?? "#fbbf24"} />
                <stop offset="100%" stopColor={colors.fat ?? "#fb7185"} />
              </linearGradient>
              <linearGradient id={`${uid}-empty`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.track ?? "#eceee9"} />
                <stop offset="100%" stopColor={colors.track ?? "#eceee9"} stopOpacity={0.6} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={colors.line} strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value: number) => compactNumber(value)}
            />
            <Tooltip
              cursor={{ fill: colors.track, opacity: 0.5, radius: 8 }}
              content={<ChartTooltip />}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={goal}
              stroke={colors.muted}
              strokeOpacity={0.32}
              strokeDasharray="3 5"
              strokeWidth={1}
            />
            <Bar
              dataKey="calories"
              radius={[10, 10, 10, 10]}
              maxBarSize={38}
              isAnimationActive={false}
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
                      ? `url(#${uid}-empty)`
                      : point.onTarget
                        ? point.isToday
                          ? `url(#${uid}-today)`
                          : `url(#${uid}-bar)`
                        : `url(#${uid}-over)`
                  }
                  stroke={point.isToday ? (colors.accentInk ?? "#15803d") : "none"}
                  strokeWidth={point.isToday ? 1 : 0}
                />
              ))}
              <LabelList
                dataKey="calories"
                content={(props: LabelProps) => <BarValueLabel {...props} colors={colors} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Keyboard-reachable day buttons: the same data as the bars. */}
      <ul className="mt-3 grid grid-cols-7 gap-1.5">
        {data.map((point) => (
          <li key={point.key}>
            <button
              type="button"
              onClick={() => onSelectDay(point.key)}
              className={`flex min-h-12 w-full flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center transition active:scale-95 ${
                point.isToday
                  ? "bg-accent-soft ring-1 ring-accent/25"
                  : "bg-track hover:brightness-95"
              }`}
              aria-label={`${point.full}: ${point.calories.toLocaleString()} calories. Show that day's meals.`}
            >
              <span
                className={`block text-[10px] font-medium uppercase tracking-wide ${
                  point.isToday ? "text-accent-ink" : "text-muted"
                }`}
              >
                {point.label}
              </span>
              <span className={`block text-sm font-bold tabular-nums ${point.isToday ? "text-accent-ink" : ""}`}>
                {compactNumber(point.calories)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarValueLabel({
  x = 0,
  y = 0,
  width = 0,
  value,
  colors,
}: LabelProps & { colors: ChartColors }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 7}
      textAnchor="middle"
      fill={colors.muted ?? "#6d6f68"}
      fontSize={10}
      fontWeight={700}
    >
      {compactNumber(numeric)}
    </text>
  );
}
