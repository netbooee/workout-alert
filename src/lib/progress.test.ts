import { describe, expect, it } from 'vitest';

import { niceMax, weekRangeLabel, weeklyAverage, weeklyTotals } from './progress';

// Thursday, Oct 15 2026, 9pm local. Current week starts Sunday Oct 11.
const now = new Date(2026, 9, 15, 21, 0);
const workout = (y: number, m: number, d: number, minutes: number, hour = 7) => ({
  started_at: new Date(y, m - 1, d, hour).toISOString(),
  duration_s: minutes * 60,
});

describe('weeklyTotals', () => {
  const totals = weeklyTotals(
    [
      workout(2026, 10, 12, 30), // this week
      workout(2026, 10, 15, 45, 20),
      workout(2026, 10, 10, 20, 23), // Saturday night: previous week
      workout(2026, 9, 28, 60), // three weeks back
      workout(2026, 6, 1, 90), // outside the range
    ],
    4,
    now,
  );

  it('returns one week per slot, oldest first, ending with the current week', () => {
    expect(totals.map((t) => t.weekStart)).toEqual([
      '2026-09-20',
      '2026-09-27',
      '2026-10-04',
      '2026-10-11',
    ]);
    expect(totals.map((t) => t.isCurrent)).toEqual([false, false, false, true]);
  });

  it('sums minutes and counts workouts per Sunday–Saturday week', () => {
    expect(totals.map((t) => t.minutes)).toEqual([0, 60, 20, 75]);
    expect(totals.map((t) => t.workouts)).toEqual([0, 1, 1, 2]);
  });
});

describe('weeklyAverage', () => {
  const totals = weeklyTotals(
    [workout(2026, 9, 28, 60), workout(2026, 10, 6, 30), workout(2026, 10, 13, 500)],
    6,
    now,
  );

  it('averages completed weeks from the first active week, skipping the current week', () => {
    // Weeks 09-27 (60) and 10-04 (30); 08-30 … 09-20 are before the first workout.
    expect(weeklyAverage(totals, 'minutes')).toBe(45);
    expect(weeklyAverage(totals, 'workouts')).toBe(1);
  });

  it('is zero with no completed activity', () => {
    expect(weeklyAverage(weeklyTotals([workout(2026, 10, 13, 30)], 4, now), 'minutes')).toBe(0);
  });
});

describe('niceMax', () => {
  it('rounds up to a readable axis maximum', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(10)).toBe(10);
    expect(niceMax(137)).toBe(150);
    expect(niceMax(410)).toBe(500);
  });
});

describe('labels', () => {
  it('formats week ranges within and across months', () => {
    expect(weekRangeLabel('2026-10-12')).toBe('Oct 12 – 18');
    expect(weekRangeLabel('2026-09-28')).toBe('Sep 28 – Oct 4');
  });
});
