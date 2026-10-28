import { describe, expect, it } from 'vitest';

import { crewLine, crewOrder, crewStatus, crewTotals, crewTotalsLine, holdTarget } from './crew';
import { buildWeek } from './week';

// Thursday, so three days are left including today.
const now = new Date(2026, 9, 22, 12);
const p = (days: number, extra: object = {}) => ({
  resting: false,
  this_week_days: days,
  this_week_goal: 3,
  friend_streak: 0,
  ...extra,
});
const week = (startedAt?: string) =>
  buildWeek(startedAt ? [{ started_at: startedAt, duration_s: 1800 }] : [], 0, now);

describe('crewStatus', () => {
  it('reads each partner’s week', () => {
    expect(crewStatus(p(0, { resting: true }), week(), now)).toBe('resting');
    expect(crewStatus(p(3), week(), now)).toBe('done');
    expect(crewStatus(p(1), week(new Date(2026, 9, 22, 8).toISOString()), now)).toBe('today');
    expect(crewStatus(p(0), week(), now)).toBe('behind');
    expect(crewStatus(p(2), week(), now)).toBe('on-track');
  });

  it('says it in words', () => {
    expect(crewLine('behind', 'Tony', p(1))).toBe('Tony needs 2 more days. A nudge could help 👋');
    expect(crewLine('done', 'Sharon', p(3))).toBe('Sharon hit their goal this week ✅');
  });
});

describe('crewOrder', () => {
  it('puts whoever needs a nudge first, then longest friend streak', () => {
    const order = crewOrder([
      { member: p(3, { friend_streak: 9 }), status: 'done' as const },
      { member: p(2, { friend_streak: 1 }), status: 'on-track' as const },
      { member: p(2, { friend_streak: 5 }), status: 'on-track' as const },
      { member: p(0), status: 'behind' as const },
    ]);
    expect(order.map((o) => o.status)).toEqual(['behind', 'on-track', 'on-track', 'done']);
    expect(order[1]!.member.friend_streak).toBe(5);
  });
});

describe('crew totals', () => {
  it('adds up the workouts that count', () => {
    const totals = crewTotals([
      { duration_s: 1800 },
      { duration_s: 3600, counted: true },
      { duration_s: 600, counted: false },
      { duration_s: 4200 },
    ]);
    expect(totals).toEqual({ workouts: 3, minutes: 160 });
    expect(crewTotalsLine(totals)).toBe('Together this week: 3 workouts · 2 h 40 min');
    expect(crewTotalsLine({ workouts: 1, minutes: 45 })).toBe('Together this week: 1 workout · 45 min');
    expect(crewTotalsLine({ workouts: 0, minutes: 0 })).toMatch(/Be the first/);
  });
});

describe('holdTarget', () => {
  // Tuesday Oct 27; the week started Sunday Oct 25.
  const now = new Date(2026, 9, 27, 12);
  const weekStart = new Date(2026, 9, 25);
  const w = (id: string, user_id: string, d: Date) => ({ id, user_id, activity_type: 'running', started_at: d.toISOString() });

  it('cheers this week’s latest workout', () => {
    const t = holdTarget('a', [w('1', 'a', new Date(2026, 9, 25, 9)), w('2', 'a', new Date(2026, 9, 26, 9))], weekStart, now);
    expect(t).toMatchObject({ kind: 'cheer', when: null, workout: { id: '2' } });
  });

  it('falls back to a recent one and says when', () => {
    expect(holdTarget('a', [w('1', 'a', new Date(2026, 9, 22, 9))], weekStart, now)).toMatchObject({
      kind: 'cheer',
      when: 'Thursday',
    });
    expect(holdTarget('a', [w('1', 'a', new Date(2026, 9, 16, 9))], weekStart, now)).toMatchObject({
      kind: 'cheer',
      when: 'Oct 16',
    });
  });

  it('offers a nudge when there’s nothing in two weeks', () => {
    expect(holdTarget('a', [w('1', 'a', new Date(2026, 9, 1, 9)), w('2', 'b', new Date(2026, 9, 26))], weekStart, now)).toEqual({
      kind: 'nudge',
    });
  });
});
