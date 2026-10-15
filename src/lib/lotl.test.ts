import { describe, expect, it } from 'vitest';

import { lotlMessage, lotlMood, type LotlInput } from './lotl';

// Weekdays in Sept/Oct 2026 (local time).
const mon = new Date(2026, 8, 28, 9);
const wed = new Date(2026, 8, 30, 9);
const fri = new Date(2026, 9, 2, 18);
const sun = new Date(2026, 9, 4, 18);

const base: LotlInput = {
  now: wed,
  firstName: 'Jordan',
  streakWeeks: 6,
  freezes: 0,
  weekDays: 1,
  weekGoal: 4,
  daysSinceLastWorkout: 1,
  resting: false,
};

describe('lotlMood', () => {
  it('blazes once the week goal is hit', () => {
    expect(lotlMood({ ...base, now: fri, weekDays: 4 })).toBe('blazing');
  });

  it('is happy when on track', () => {
    expect(lotlMood({ ...base, weekDays: 2 })).toBe('happy');
  });

  it('is ready at the start of a week with nothing done yet', () => {
    expect(lotlMood({ ...base, now: mon, weekDays: 0, daysSinceLastWorkout: 2 })).toBe('ready');
  });

  it('worries when the streak is at risk', () => {
    expect(lotlMood({ ...base, now: fri, weekDays: 2 })).toBe('worried');
  });

  it('gets fired up after several idle days', () => {
    expect(lotlMood({ ...base, weekDays: 0, daysSinceLastWorkout: 5 })).toBe('fired_up');
  });

  it('gets fired up when the week is out of reach and no freeze can save it', () => {
    expect(lotlMood({ ...base, now: sun, weekDays: 1, daysSinceLastWorkout: 2 })).toBe('fired_up');
  });

  it('never gets angry when a freeze will cover the week', () => {
    expect(lotlMood({ ...base, now: sun, weekDays: 1, freezes: 1, daysSinceLastWorkout: 2 })).toBe('worried');
  });

  it('calms "fired up" down to "worried" after the daily greeting', () => {
    expect(lotlMood({ ...base, weekDays: 0, daysSinceLastWorkout: 5, calm: true })).toBe('worried');
  });

  it('sleeps in rest mode, whatever else is going on', () => {
    expect(lotlMood({ ...base, weekDays: 0, daysSinceLastWorkout: 9, resting: true })).toBe('sleepy');
  });

  it('does not get angry at brand-new users with no workouts yet', () => {
    expect(lotlMood({ ...base, now: mon, streakWeeks: 0, weekDays: 0, daysSinceLastWorkout: null })).toBe('ready');
  });
});

describe('lotlMessage', () => {
  it('leads with the streak and adds partner news', () => {
    const msg = lotlMessage({ ...base, nudgedBy: 'Sam', verifiedBy: 'Priya' });
    expect(msg.facts).toEqual([
      { emoji: '🔥', text: '6-week streak · 1/4 this week' },
      { emoji: '👋', text: 'Sam nudged you' },
      { emoji: '✅', text: 'Priya verified your workout' },
    ]);
    expect(msg.action).toEqual({ label: 'Log a workout', href: '/log' });
  });

  it('shows league standing when there is room', () => {
    const msg = lotlMessage({
      ...base,
      weekDays: 2,
      league: { rank: 2, size: 3, gapToNext: 44, aheadName: 'Sam' },
    });
    expect(msg.facts[1]).toEqual({ emoji: '🥈', text: '2nd in the league, 44 XP behind Sam' });
  });

  it('mentions partners who already worked out today', () => {
    const msg = lotlMessage({ ...base, partnerWorkedOutToday: 'Sam' });
    expect(msg.facts).toContainEqual({ emoji: '👀', text: 'Sam already worked out today' });
  });

  it('keeps the same headline all day and varies it across days', () => {
    const a = lotlMessage({ ...base, now: new Date(2026, 8, 30, 8) }).headline;
    const b = lotlMessage({ ...base, now: new Date(2026, 8, 30, 20) }).headline;
    expect(a).toBe(b);
    const week = [0, 1, 2, 3, 4, 5, 6].map(
      (d) => lotlMessage({ ...base, now: new Date(2026, 9, 5 + d * 7, 9), weekDays: 0, daysSinceLastWorkout: 1 }).headline,
    );
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it('fills in the numbers in the headline', () => {
    const msg = lotlMessage({ ...base, now: fri, weekDays: 2 });
    expect(msg.mood).toBe('worried');
    expect(msg.headline).not.toMatch(/undefined|NaN/);
  });

  it('protects the streak in rest mode', () => {
    const msg = lotlMessage({ ...base, resting: true });
    expect(msg.facts[0]).toEqual({ emoji: '😴', text: 'Rest mode on · 6-week streak protected' });
    expect(msg.action.href).toBeNull();
  });

  it('points a blazing user at the league', () => {
    expect(lotlMessage({ ...base, now: fri, weekDays: 4 }).action).toEqual({
      label: 'See the league',
      href: '/partners',
    });
  });

  it('never produces more than three facts', () => {
    const msg = lotlMessage({
      ...base,
      nudgedBy: 'Sam',
      verifiedBy: 'Priya',
      partnerWorkedOutToday: 'Alex',
      league: { rank: 1, size: 3, gapToNext: 0 },
    });
    expect(msg.facts).toHaveLength(3);
  });
});
