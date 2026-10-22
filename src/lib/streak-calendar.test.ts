import { describe, expect, it } from 'vitest';

import { monthGrid, monthSpan, monthStats, workoutRuns, type WeekStatus } from './streak-calendar';

// October 2026: the 1st is a Thursday, the 31st a Saturday.
const now = new Date(2026, 9, 22, 12);
const worked = new Set(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-21']);
const status = new Map<string, WeekStatus>([
  ['2026-09-27', 'hit'],
  ['2026-10-04', 'hit'],
  ['2026-10-11', 'frozen'],
  ['2026-10-18', 'in_progress'],
]);

describe('monthGrid', () => {
  const weeks = monthGrid(2026, 9, worked, status, now);

  it('lays the month out in Sunday-first weeks', () => {
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.weekStart).toBe('2026-09-27');
    expect(weeks[0]!.days.map((d) => d.inMonth)).toEqual([false, false, false, false, true, true, true]);
    expect(weeks[4]!.days[6]!.key).toBe('2026-10-31');
  });

  it('marks today, the future, worked days and week status', () => {
    const days = weeks.flatMap((w) => w.days);
    expect(days.find((d) => d.today)?.key).toBe('2026-10-22');
    expect(days.find((d) => d.key === '2026-10-23')?.future).toBe(true);
    expect(days.filter((d) => d.worked)).toHaveLength(6);
    expect(weeks[2]!.status).toBe('frozen');
    expect(weeks[4]!.status).toBeNull();
  });

  it('joins back-to-back workout days into runs', () => {
    expect(workoutRuns(weeks[0]!.days)).toEqual([[4, 5]]);
    expect(workoutRuns(weeks[1]!.days)).toEqual([[1, 3]]);
    expect(monthSpan(weeks[0]!.days)).toEqual([4, 6]);
  });

  it('totals the month', () => {
    expect(monthStats(weeks)).toEqual({ daysWorked: 6, freezesUsed: 1, perfect: false });
  });

  it('is perfect when every finished week hit its goal', () => {
    const good = monthGrid(2026, 9, worked, new Map<string, WeekStatus>([['2026-10-04', 'hit'], ['2026-10-11', 'rest']]), now);
    expect(monthStats(good).perfect).toBe(true);
  });
});
