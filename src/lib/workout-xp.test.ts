import { describe, expect, it } from 'vitest';

import { durationXp, isVerified, workoutXp } from './workout-xp';

describe('durationXp', () => {
  it('matches public.workout_xp', () => {
    expect(durationXp(299)).toBe(0);
    expect(durationXp(300)).toBe(12);
    expect(durationXp(1800)).toBe(25);
    expect(durationXp(1859)).toBe(25);
    expect(durationXp(3600)).toBe(40);
    expect(durationXp(7200)).toBe(40);
  });
});

describe('workoutXp', () => {
  const base = { durationS: 1800, counted: true, hasPhoto: false, verified: false };

  it('counts what is earned and what is still possible', () => {
    expect(workoutXp(base)).toEqual({ earned: 25, photoLeft: 25, verifyLeft: 5, potential: 55 });
  });

  it('adds the photo and verification bonuses once earned', () => {
    expect(workoutXp({ ...base, hasPhoto: true, verified: true })).toEqual({
      earned: 55,
      photoLeft: 0,
      verifyLeft: 0,
      potential: 55,
    });
  });

  it('gives nothing for a workout that does not count', () => {
    expect(workoutXp({ ...base, counted: false, hasPhoto: true }).potential).toBe(0);
  });
});

describe('isVerified', () => {
  it('ignores the owner and other reactions', () => {
    expect(isVerified('a', [{ kind: 'verified', user_id: 'a' }, { kind: 'fire', user_id: 'b' }])).toBe(false);
    expect(isVerified('a', [{ kind: 'verified', user_id: 'b' }])).toBe(true);
  });
});
