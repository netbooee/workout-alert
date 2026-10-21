import { describe, expect, it } from 'vitest';

import { countsAsWorkout, rulesSummary, walkChoice, walkRules, type CountRules } from './what-counts';

const defaults: CountRules = { min_workout_minutes: 15, min_walk_minutes: null, count_walks: true };
const walk = (minutes: number) => ({ activity_type: 'walking', duration_s: minutes * 60 });
const run = (minutes: number) => ({ activity_type: 'running', duration_s: minutes * 60 });

describe('countsAsWorkout', () => {
  it('uses the general bar for everything by default', () => {
    expect(countsAsWorkout(walk(12), defaults)).toBe(false);
    expect(countsAsWorkout(walk(15), defaults)).toBe(true);
    expect(countsAsWorkout(run(15), defaults)).toBe(true);
  });

  it('applies a separate bar to walks only', () => {
    const rules = { ...defaults, min_walk_minutes: 30 };
    expect(countsAsWorkout(walk(20), rules)).toBe(false);
    expect(countsAsWorkout(walk(30), rules)).toBe(true);
    expect(countsAsWorkout(run(20), rules)).toBe(true);
  });

  it('can leave walks out entirely', () => {
    expect(countsAsWorkout(walk(90), { ...defaults, count_walks: false })).toBe(false);
  });
});

describe('walk choices', () => {
  it('round-trips through the profile fields', () => {
    for (const choice of ['same', '20', '30', '45', 'never'] as const) {
      expect(walkChoice({ ...defaults, ...walkRules(choice) })).toBe(choice);
    }
  });
});

describe('rulesSummary', () => {
  it('describes the rules in a sentence', () => {
    expect(rulesSummary(defaults)).toBe('Workouts count from 15 minutes, walks included.');
    expect(rulesSummary({ ...defaults, min_walk_minutes: 30 })).toBe('Workouts count from 15 minutes; walks from 30.');
    expect(rulesSummary({ ...defaults, count_walks: false })).toBe('Workouts count from 15 minutes; walks don’t count.');
  });
});
