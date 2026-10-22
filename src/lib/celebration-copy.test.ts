import { describe, expect, it } from 'vitest';

import { buddyLine, celebrationMood, celebrationTitle, type CelebrationFacts } from './celebration-copy';

const none: CelebrationFacts = {
  workouts: 0,
  weekGoal: false,
  evidence: false,
  incentive: false,
  steps: 0,
  newLevel: null,
};

describe('celebration copy', () => {
  it('celebrates a step tier on its own', () => {
    const c = { ...none, steps: 8000 };
    expect(celebrationTitle(c)).toBe('8,000 steps!');
    expect(buddyLine(c)).toBe('8,000 steps today! Keep moving 👟');
    expect(celebrationMood(c)).toBe('happy');
  });

  it('gets fired up for the top step tier', () => {
    expect(celebrationMood({ ...none, steps: 12000 })).toBe('blazing');
  });

  it('leads with the biggest news', () => {
    const c = { ...none, workouts: 1, weekGoal: true, steps: 5000 };
    expect(celebrationTitle(c)).toBe('Week goal hit!');
    expect(buddyLine(c)).toBe('Week goal smashed! Your streak is safe 🔥');
    expect(celebrationTitle({ ...c, newLevel: 3 })).toBe('Level 3!');
  });

  it('keeps the existing titles', () => {
    expect(celebrationTitle({ ...none, workouts: 2 })).toBe('2 workouts logged!');
    expect(celebrationTitle({ ...none, evidence: true })).toBe('Check-in added!');
    expect(celebrationTitle({ ...none, incentive: true })).toBe('Challenge complete! 🎯');
  });
});
