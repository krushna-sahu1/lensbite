"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { useChartColors } from "./use-chart-colors";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export interface MonthPoint {
  /** Local date key ("YYYY-MM-DD"). */
  key: string;
  /** Day of the month, e.g. "21". */
  label: string;
  full: string;
  calories: number;
  goal: number;
  logged: boolean;
}

/** Area chart of daily calories across a month, with a dashed goal line. */
export function MonthAreaChart({ data, goal }: { data: MonthPoint[]; goal: number }) {
  const colors = useChartColors();
  const reduced = useReducedMotion();

  return (
    <div role="group" aria-label="Daily calories across the selected month">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} accessibilityLayer>
            <defs>
              <linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.45} />
                <stop offset="100%" stopColor={colors.accent ?? "#4ade80"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.line} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ stroke: colors.muted, strokeDasharray: "3 3" }}
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
            <Area
              type="monotone"
              dataKey="calories"
              stroke={colors.accent ?? "#4ade80"}
              strokeWidth={2.5}
              fill="url(#calorieFill)"
              isAnimationActive={!reduced}
              animationDuration={800}
              animationEasing="ease-out"
              dot={false}
              activeDot={{ r: 4, fill: colors.accent ?? "#4ade80" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
