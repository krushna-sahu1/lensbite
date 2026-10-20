"use client";

import type { ReactNode } from "react";

/** Tooltip shown on the Recharts charts. Styled like the rest of the app. */
export function ChartTooltip({
  active,
  payload,
  label,
  footer,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    name?: string;
    payload?: { detail?: string; full?: string };
  }>;
  label?: string | number;
  footer?: ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const detail = entry.payload?.detail;
  // The charts carry a longer label ("Mon 21 Oct") than the axis tick ("Mon").
  const title = entry.payload?.full ?? label;

  return (
    <div className="rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg">
      {title !== undefined && <p className="font-semibold">{title}</p>}
      <p className="tabular-nums">
        {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value} kcal
      </p>
      {detail && <p className="mt-0.5 opacity-70">{detail}</p>}
      {footer}
    </div>
  );
}
