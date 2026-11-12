/**
 * Smoothed weight trend. Daily weigh-ins swing by a kilo or more with water
 * and food, so the app shows an exponentially weighted moving average (the
 * "trend") and the weekly rate of change of that trend. Pure functions; see
 * weight-trend.test.ts.
 */
import { localDateFromKey } from "./periods";

export interface WeightEntry {
  /** Local date key "YYYY-MM-DD". */
  day: string;
  kg: number;
}

export interface TrendPoint extends WeightEntry {
  /** Smoothed weight on that day. */
  trend: number;
}

/** Smoothing per day: 0.1 means each weigh-in moves the trend 10% of the way. */
const ALPHA = 0.1;

const DAY_MS = 86_400_000;

/** Whole days from one date key to another (DST-safe). */
export function daysBetween(a: string, b: string): number {
  const da = localDateFromKey(a);
  const db = localDateFromKey(b);
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(db) - utc(da)) / DAY_MS);
}

/**
 * Adds the trend to each entry (entries may be unsorted; one per day). A gap
 * of several days counts as several steps, so the trend catches up after a
 * break instead of crawling.
 */
export function computeTrend(entries: WeightEntry[]): TrendPoint[] {
  const sorted = [...entries].sort((x, y) => x.day.localeCompare(y.day));
  const points: TrendPoint[] = [];
  let trend = 0;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (i === 0) {
      trend = entry.kg;
    } else {
      const gap = Math.max(1, daysBetween(sorted[i - 1].day, entry.day));
      const weight = 1 - Math.pow(1 - ALPHA, gap);
      trend += weight * (entry.kg - trend);
    }
    points.push({ ...entry, trend: Math.round(trend * 100) / 100 });
  }
  return points;
}

export interface TrendSummary {
  /** Latest trend weight. */
  current: number;
  /** Change in trend over the window (kg); null without enough history. */
  change: number | null;
  /** Trend change per week over the window (kg/week); null without enough history. */
  weeklyRate: number | null;
}

/**
 * The latest trend and how fast it moved over the last `windowDays` days,
 * from the trend point closest to the start of the window. Needs at least a
 * week of history to say anything about the rate.
 */
export function summarizeTrend(points: TrendPoint[], windowDays = 28): TrendSummary | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  let base: TrendPoint | null = null;
  for (const p of points) {
    if (daysBetween(p.day, last.day) <= windowDays) {
      base = p;
      break;
    }
  }
  const span = base ? daysBetween(base.day, last.day) : 0;
  if (!base || span < 7) return { current: last.trend, change: null, weeklyRate: null };
  const change = Math.round((last.trend - base.trend) * 100) / 100;
  return { current: last.trend, change, weeklyRate: Math.round((change / span) * 7 * 100) / 100 };
}
