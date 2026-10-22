import { describe, expect, it } from 'vitest';

import { nextStepTier, stepXp, tierFromRef } from './step-xp';

describe('step XP', () => {
  it('pays each tier once, up to 25 a day', () => {
    expect(stepXp(4999)).toBe(0);
    expect(stepXp(5000)).toBe(5);
    expect(stepXp(8000)).toBe(15);
    expect(stepXp(12000)).toBe(25);
    expect(stepXp(40000)).toBe(25);
  });

  it('names the next tier to reach', () => {
    expect(nextStepTier(0)).toEqual({ steps: 5000, xp: 5 });
    expect(nextStepTier(6500)).toEqual({ steps: 8000, xp: 10 });
    expect(nextStepTier(12000)).toBeNull();
  });

  it('reads the tier from an XP event ref', () => {
    expect(tierFromRef('2026-10-23:8000')).toBe(8000);
    expect(tierFromRef('junk')).toBe(0);
  });
});
