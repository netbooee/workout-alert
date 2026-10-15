// Weekly totals for the Progress chart. Pure functions (no native imports) so
// they stay unit-testable. Weeks run Monday–Sunday in local time, like week.ts.

import { addDays, dayKey, startOfWeek, type WorkoutLike } from '@/lib/week';

export type ProgressMetric = 'minutes' | 'workouts';

export const PROGRESS_RANGES = [
  { key: '12w', label: '12W', weeks: 12 },
  { key: '6m', label: '6M', weeks: 26 },
  { key: '1y', label: '1Y', weeks: 52 },
] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number]['key'];

export interface WeekTotal {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  minutes: number;
  workouts: number;
  isCurrent: boolean;
}

/** One entry per week for the last `weeks` weeks (oldest first), including the current week. */
export function weeklyTotals(
  workouts: readonly WorkoutLike[],
  weeks: number,
  now: Date = new Date(),
): WeekTotal[] {
  const thisMonday = startOfWeek(now);
  const totals: WeekTotal[] = [];
  const byWeek = new Map<string, WeekTotal>();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = dayKey(addDays(thisMonday, -7 * i));
    const total = { weekStart, minutes: 0, workouts: 0, isCurrent: i === 0 };
    totals.push(total);
    byWeek.set(weekStart, total);
  }
  for (const w of workouts) {
    const total = byWeek.get(dayKey(startOfWeek(new Date(w.started_at))));
    if (!total) continue;
    total.minutes += w.duration_s / 60;
    total.workouts += 1;
  }
  for (const t of totals) t.minutes = Math.round(t.minutes);
  return totals;
}

export function metricValue(total: WeekTotal, metric: ProgressMetric): number {
  return metric === 'minutes' ? total.minutes : total.workouts;
}

/**
 * Weekly average over completed weeks, starting from the first week with any
 * activity, so a new user's empty history doesn't drag the average down.
 * The current week is left out because it's still in progress.
 */
export function weeklyAverage(totals: readonly WeekTotal[], metric: ProgressMetric): number {
  const done = totals.filter((t) => !t.isCurrent);
  const first = done.findIndex((t) => t.workouts > 0);
  if (first === -1) return 0;
  const counted = done.slice(first);
  return counted.reduce((sum, t) => sum + metricValue(t, metric), 0) / counted.length;
}

/** A round axis maximum at or above `value` (e.g. 137 → 150, 7 → 8). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

/** "Oct 6 – 12", or "Sep 29 – Oct 5" across months. */
export function weekRangeLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number];
  const start = new Date(y, m - 1, d);
  const end = addDays(start, 6);
  const month = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}
