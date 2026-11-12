"use client";

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { useChartColors } from "@/components/insights/use-chart-colors";
import { fromKg, type Units } from "@/lib/energy";
import { localDateFromKey } from "@/lib/periods";
import type { TrendPoint } from "@/lib/weight-trend";

interface Point {
  day: string;
  label: string;
  weight: number;
  trend: number;
}

/** Daily weigh-ins as dots with the smoothed trend as a line. */
export function WeightChart({ points, units }: { points: TrendPoint[]; units: Units }) {
  const colors = useChartColors();
  const unit = units === "imperial" ? "lb" : "kg";
  const data: Point[] = points.map((p) => ({
    day: p.day,
    label: localDateFromKey(p.day).toLocaleDateString([], { day: "numeric", month: "short" }),
    weight: Math.round(fromKg(p.kg, units) * 10) / 10,
    trend: Math.round(fromKg(p.trend, units) * 10) / 10,
  }));
  const values = data.flatMap((d) => [d.weight, d.trend]);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  return (
    <div role="group" aria-label={`Weight trend in ${unit}`} className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={colors.line} strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: colors.muted, fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis domain={[min, max]} tick={{ fill: colors.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg">
                  <p className="font-semibold">{p.label}</p>
                  <p className="tabular-nums">
                    Weighed {p.weight} {unit}
                  </p>
                  <p className="tabular-nums opacity-75">
                    Trend {p.trend} {unit}
                  </p>
                </div>
              );
            }}
          />
          <Scatter dataKey="weight" fill={colors.muted} fillOpacity={0.55} isAnimationActive={false} />
          <Line type="monotone" dataKey="trend" stroke={colors.accentInk} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
