import { describe, expect, it } from 'vitest';

import { crewLine, crewOrder, crewStatus } from './crew';
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
