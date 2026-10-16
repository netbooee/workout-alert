import { describe, expect, it } from 'vitest';

import { buildWeek, dayKey, startOfWeek, weekState } from './week';

// Thursday, Sept 24 2026, 9pm local. The week runs Sun 09-20 through Sat 09-26.
const thursday = new Date(2026, 8, 24, 21, 0);

describe('startOfWeek', () => {
  it('returns Sunday for a mid-week day', () => {
    expect(dayKey(startOfWeek(thursday))).toBe('2026-09-20');
  });

  it('treats Saturday as the end of the week', () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 26, 23, 0)))).toBe('2026-09-20');
  });

  it('returns the same day for Sunday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 27, 0, 5)))).toBe('2026-09-27');
  });
});

describe('buildWeek', () => {
  const workouts = [
    { started_at: new Date(2026, 8, 21, 7).toISOString(), duration_s: 1800 },
    { started_at: new Date(2026, 8, 21, 18).toISOString(), duration_s: 1800 },
    { started_at: new Date(2026, 8, 22, 7).toISOString(), duration_s: 600 },
    { started_at: new Date(2026, 8, 24, 20).toISOString(), duration_s: 2700 },
  ];

  it('labels the days S M T W T F S', () => {
    expect(buildWeek([], 15, thursday).map((d) => d.label).join('')).toBe('SMTWTFS');
  });

  it('marks days with qualifying workouts', () => {
    const week = buildWeek(workouts, 15, thursday);
    expect(week.map((d) => d.active)).toEqual([false, true, false, false, true, false, false]);
  });

  it('flags today and future days', () => {
    const week = buildWeek(workouts, 15, thursday);
    expect(week.findIndex((d) => d.isToday)).toBe(4);
    expect(week.map((d) => d.isFuture)).toEqual([false, false, false, false, false, true, true]);
  });

  it('respects the minimum workout length', () => {
    const week = buildWeek(workouts, 5, thursday);
    expect(week[2].active).toBe(true);
  });
});

describe('weekState', () => {
  it('is done once the goal is met', () => {
    expect(weekState(3, 3, thursday)).toEqual({ kind: 'done' });
  });

  it('is on track with slack left', () => {
    // Thursday → 3 days left including today.
    expect(weekState(2, 3, thursday)).toEqual({ kind: 'on-track', needed: 1, daysLeft: 3 });
  });

  it('is at risk when at most one spare day remains', () => {
    expect(weekState(1, 3, thursday)).toEqual({ kind: 'at-risk', needed: 2, daysLeft: 3 });
  });

  it('is out of reach when there are not enough days left', () => {
    const saturday = new Date(2026, 8, 26, 10);
    expect(weekState(0, 2, saturday)).toEqual({ kind: 'out-of-reach', needed: 2, daysLeft: 1 });
  });
});
