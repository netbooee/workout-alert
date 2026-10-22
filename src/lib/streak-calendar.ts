// The streak screen's month calendar: a Sunday-first grid, runs of workout
// days to draw as joined pills, and the month's totals. No native imports.

import type { StreakWeek } from './database.types';
import { addDays, dayKey, startOfWeek } from './week';

export type WeekStatus = StreakWeek['status'];

export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
  future: boolean;
  today: boolean;
  worked: boolean;
}

export interface CalendarWeek {
  /** The Sunday, YYYY-MM-DD, as in streak_weeks.week_start. */
  weekStart: string;
  days: CalendarDay[];
  status: WeekStatus | null;
}

/** Sunday-first weeks covering `month` (0–11) of `year`. */
export function monthGrid(
  year: number,
  month: number,
  workedDays: ReadonlySet<string>,
  weekStatus: ReadonlyMap<string, WeekStatus>,
  now: Date = new Date(),
): CalendarWeek[] {
  const todayKey = dayKey(now);
  const last = new Date(year, month + 1, 0);
  const weeks: CalendarWeek[] = [];
  for (let start = startOfWeek(new Date(year, month, 1)); start <= last; start = addDays(start, 7)) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const key = dayKey(date);
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        future: key > todayKey,
        today: key === todayKey,
        worked: workedDays.has(key),
      };
    });
    const weekStart = dayKey(start);
    weeks.push({ weekStart, days, status: weekStatus.get(weekStart) ?? null });
  }
  return weeks;
}

/** Runs of back-to-back workout days in this month, as [first, last] column indexes. */
export function workoutRuns(days: readonly CalendarDay[]): [number, number][] {
  const runs: [number, number][] = [];
  days.forEach((d, i) => {
    if (!d.worked || !d.inMonth) return;
    const prev = runs[runs.length - 1];
    if (prev && prev[1] === i - 1) prev[1] = i;
    else runs.push([i, i]);
  });
  return runs;
}

/** The columns of a week that fall in the month, as [first, last]. */
export function monthSpan(days: readonly CalendarDay[]): [number, number] {
  const first = days.findIndex((d) => d.inMonth);
  let lastIdx = first;
  days.forEach((d, i) => {
    if (d.inMonth) lastIdx = i;
  });
  return [first, lastIdx];
}

export interface MonthStats {
  daysWorked: number;
  freezesUsed: number;
  /** Every finished week of the month hit its goal (rest weeks don't spoil it). */
  perfect: boolean;
}

export function monthStats(weeks: readonly CalendarWeek[]): MonthStats {
  const days = weeks.flatMap((w) => w.days).filter((d) => d.inMonth);
  // A week belongs to the month its Sunday is in, so no week counts twice across months.
  const own = weeks.filter((w) => w.days[0]!.inMonth && w.status);
  const finished = own.filter((w) => w.status !== 'in_progress');
  return {
    daysWorked: days.filter((d) => d.worked).length,
    freezesUsed: own.filter((w) => w.status === 'frozen').length,
    perfect: finished.some((w) => w.status === 'hit') && finished.every((w) => w.status === 'hit' || w.status === 'rest'),
  };
}
