import { describe, expect, it } from 'vitest';

import { xpBreakdown } from './xp-rules';

describe('xpBreakdown', () => {
  it('lists what earned XP, biggest first', () => {
    expect(xpBreakdown({ steps: 45, workout: 120, evidence: 25, week_goal: 0 })).toEqual([
      { kind: 'workout', emoji: '🏃', label: 'Workouts', xp: 120 },
      { kind: 'steps', emoji: '👟', label: 'Steps', xp: 45 },
      { kind: 'evidence', emoji: '📸', label: 'Photos', xp: 25 },
    ]);
  });

  it('is empty with no XP, and labels unknown kinds', () => {
    expect(xpBreakdown({})).toEqual([]);
    expect(xpBreakdown({ mystery: 3 })[0]).toMatchObject({ label: 'Other', xp: 3 });
  });
});
