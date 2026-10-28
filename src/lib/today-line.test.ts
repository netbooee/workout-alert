import { describe, expect, it } from 'vitest';

import { shouldOfferLog, todayLine, todayTone, type TodayFacts } from './today-line';

const base: TodayFacts = {
  state: { kind: 'on-track', needed: 2, daysLeft: 5 },
  weeks: 3,
  freezes: 0,
  workedOutToday: false,
  resting: false,
};

describe('todayLine', () => {
  it('says how many workouts keep a streak alive', () => {
    expect(todayLine(base)).toBe('2 more workouts this week keeps your streak alive 🔥');
  });

  it('says a workout starts the streak when there is none', () => {
    expect(todayLine({ ...base, weeks: 0, state: { kind: 'on-track', needed: 1, daysLeft: 5 } })).toBe(
      '1 more workout this week starts your streak 🔥',
    );
  });

  it('credits a workout already done today', () => {
    expect(todayLine({ ...base, workedOutToday: true })).toBe(
      'Today counts! 2 more workouts this week keeps your streak alive.',
    );
  });

  it('pushes for today when every day left is needed', () => {
    const line = todayLine({ ...base, state: { kind: 'at-risk', needed: 2, daysLeft: 2 } });
    expect(line).toMatch(/Today’s the day/);
  });

  it('calls extra workouts bonus XP once the goal is hit', () => {
    expect(todayLine({ ...base, state: { kind: 'done' }, workedOutToday: true })).toMatch(/bonus XP/);
    expect(todayLine({ ...base, state: { kind: 'done' } })).toMatch(/streak is safe/);
  });

  it('mentions a freeze when the week is out of reach', () => {
    const state = { kind: 'out-of-reach', needed: 3, daysLeft: 1 } as const;
    expect(todayLine({ ...base, state, freezes: 1 })).toMatch(/freeze will cover it/);
    expect(todayLine({ ...base, state, weeks: 0 })).toMatch(/fresh week/i);
  });

  it('puts rest mode first', () => {
    expect(todayLine({ ...base, resting: true })).toMatch(/Rest mode/);
  });
});

describe('todayTone and shouldOfferLog', () => {
  it('is urgent only when at risk and nothing logged today', () => {
    const atRisk = { ...base, state: { kind: 'at-risk', needed: 2, daysLeft: 2 } } as const;
    expect(todayTone(atRisk)).toBe('urgent');
    expect(todayTone({ ...atRisk, workedOutToday: true })).toBe('calm');
    expect(todayTone({ ...base, state: { kind: 'done' } })).toBe('done');
    expect(todayTone({ ...base, resting: true })).toBe('rest');
  });

  it('offers Log only when a workout today would help', () => {
    expect(shouldOfferLog(base)).toBe(true);
    expect(shouldOfferLog({ ...base, workedOutToday: true })).toBe(false);
    expect(shouldOfferLog({ ...base, state: { kind: 'done' } })).toBe(false);
    expect(shouldOfferLog({ ...base, resting: true })).toBe(false);
    expect(shouldOfferLog({ ...base, state: { kind: 'out-of-reach', needed: 3, daysLeft: 1 } })).toBe(false);
  });
});
