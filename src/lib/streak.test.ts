import { describe, expect, it } from 'vitest';

import { earnedFreezeAt, isMilestone, milestoneLabel, nextMilestone, weeksToNextFreeze } from './streak';

describe('weeksToNextFreeze', () => {
  it('needs 4 goal weeks from a fresh streak', () => {
    expect(weeksToNextFreeze(0)).toBe(4);
  });

  it('counts down as the streak grows', () => {
    expect(weeksToNextFreeze(1)).toBe(3);
    expect(weeksToNextFreeze(3)).toBe(1);
  });

  it('starts over right after a freeze is banked', () => {
    expect(weeksToNextFreeze(4)).toBe(4);
    expect(weeksToNextFreeze(9)).toBe(3);
  });
});

describe('earnedFreezeAt', () => {
  it('is true on every 4th week of a streak', () => {
    expect(earnedFreezeAt(4)).toBe(true);
    expect(earnedFreezeAt(8)).toBe(true);
  });

  it('is false otherwise', () => {
    expect(earnedFreezeAt(0)).toBe(false);
    expect(earnedFreezeAt(3)).toBe(false);
    expect(earnedFreezeAt(5)).toBe(false);
  });
});

describe('milestones', () => {
  it('finds the next milestone above the streak', () => {
    expect(nextMilestone(0)).toBe(2);
    expect(nextMilestone(2)).toBe(4);
    expect(nextMilestone(30)).toBe(52);
    expect(nextMilestone(104)).toBeNull();
  });

  it('recognizes a milestone week', () => {
    expect(isMilestone(8)).toBe(true);
    expect(isMilestone(9)).toBe(false);
  });

  it('labels years', () => {
    expect(milestoneLabel(12)).toBe('12 weeks');
    expect(milestoneLabel(52)).toBe('1 year');
    expect(milestoneLabel(104)).toBe('2 years');
  });
});
