"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactNumber } from "@/lib/format";
import { ChartTooltip } from "./ChartTooltip";
import { useChartColors } from "./use-chart-colors";

export interface MonthPoint {
  /** Local date key ("YYYY-MM-DD"). */
  key: string;
  /** Day of the month, e.g. "21". */
  label: string;
  full: string;
  calories: number;
  goal: number;
  logged: boolean;
  /** True for today, which gets the strongest bar and a value label. */
  isToday: boolean;
}

/** Rounded bars of daily calories across a month, with a soft goal hairline. */
export function MonthAreaChart({ data, goal }: { data: MonthPoint[]; goal: number }) {
  const colors = useChartColors();
  const uid = useId().replace(/:/g, "");
  const today = data.find((point) => point.isToday);

  return (
    <div role="group" aria-label="Daily calories across the selected month">
      <div className="mb-1 flex items-center justify-end gap-1.5 text-[10px] font-medium text-muted">
        <span className="inline-block w-4 border-t border-dashed border-muted/50" aria-hidden="true" />
        Goal
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 32, bottom: 0, left: -8 }} accessibilityLayer barCategoryGap="18%">
            <defs>
              <linearGradient id={`${uid}-today`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent ?? "#4ade80"} />
                <stop offset="100%" stopColor={colors.accentInk ?? "#15803d"} />
              </linearGradient>
              <linearGradient id={`${uid}-bar`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.85} />
                <stop offset="100%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id={`${uid}-over`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.carbs ?? "#fbbf24"} />
                <stop offset="100%" stopColor={colors.fat ?? "#fb7185"} />
              </linearGradient>
              <linearGradient id={`${uid}-empty`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.track ?? "#eceee9"} />
                <stop offset="100%" stopColor={colors.track ?? "#eceee9"} stopOpacity={0.5} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={colors.line} strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value: number) => compactNumber(value)}
            />
            <Tooltip
              cursor={{ fill: colors.track, opacity: 0.5, radius: 6 }}
              content={<ChartTooltip />}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={goal}
              stroke={colors.muted}
              strokeOpacity={0.3}
              strokeDasharray="3 5"
              strokeWidth={1}
            />
            {today && today.logged && (
              <ReferenceDot
                x={today.label}
                y={today.calories}
                r={2.5}
                fill={colors.accentInk ?? "#15803d"}
                stroke="none"
                ifOverflow="extendDomain"
                label={{
                  value: compactNumber(today.calories),
                  position: "top",
                  fill: colors.accentInk ?? "#15803d",
                  fontSize: 10,
                  fontWeight: 700,
                  offset: 6,
                }}
              />
            )}
            <Bar
              dataKey="calories"
              radius={[4, 4, 4, 4]}
              maxBarSize={14}
              isAnimationActive={false}
            >
              {data.map((point) => (
                <Cell
                  key={point.key}
                  fill={
                    !point.logged
                      ? `url(#${uid}-empty)`
                      : point.calories > goal
                        ? `url(#${uid}-over)`
                        : point.isToday
                          ? `url(#${uid}-today)`
                          : `url(#${uid}-bar)`
                  }
                  stroke={point.isToday ? (colors.accentInk ?? "#15803d") : "none"}
                  strokeWidth={point.isToday ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
