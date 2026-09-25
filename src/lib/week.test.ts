import { describe, expect, it } from 'vitest';

import { buildWeek, dayKey, startOfWeek, weekState } from './week';

// Thursday, Sept 24 2026, 9pm local.
const thursday = new Date(2026, 8, 24, 21, 0);

describe('startOfWeek', () => {
  it('returns Monday for a mid-week day', () => {
    expect(dayKey(startOfWeek(thursday))).toBe('2026-09-21');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 27, 23, 0)))).toBe('2026-09-21');
  });

  it('returns the same day for Monday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 21, 0, 5)))).toBe('2026-09-21');
  });
});

describe('buildWeek', () => {
  const workouts = [
    { started_at: new Date(2026, 8, 21, 7).toISOString(), duration_s: 1800 },
    { started_at: new Date(2026, 8, 21, 18).toISOString(), duration_s: 1800 },
    { started_at: new Date(2026, 8, 22, 7).toISOString(), duration_s: 600 },
    { started_at: new Date(2026, 8, 24, 20).toISOString(), duration_s: 2700 },
  ];

  it('marks days with qualifying workouts', () => {
    const week = buildWeek(workouts, 15, thursday);
    expect(week.map((d) => d.active)).toEqual([true, false, false, true, false, false, false]);
  });

  it('flags today and future days', () => {
    const week = buildWeek(workouts, 15, thursday);
    expect(week.findIndex((d) => d.isToday)).toBe(3);
    expect(week.map((d) => d.isFuture)).toEqual([false, false, false, false, true, true, true]);
  });

  it('respects the minimum workout length', () => {
    const week = buildWeek(workouts, 5, thursday);
    expect(week[1].active).toBe(true);
  });
});

describe('weekState', () => {
  it('is done once the goal is met', () => {
    expect(weekState(3, 3, thursday)).toEqual({ kind: 'done' });
  });

  it('is on track with slack left', () => {
    // Thursday → 4 days left including today.
    expect(weekState(1, 3, thursday)).toEqual({ kind: 'on-track', needed: 2, daysLeft: 4 });
  });

  it('is at risk when at most one spare day remains', () => {
    expect(weekState(0, 3, thursday)).toEqual({ kind: 'at-risk', needed: 3, daysLeft: 4 });
  });

  it('is out of reach when there are not enough days left', () => {
    const sunday = new Date(2026, 8, 27, 10);
    expect(weekState(0, 2, sunday)).toEqual({ kind: 'out-of-reach', needed: 2, daysLeft: 1 });
  });
});
