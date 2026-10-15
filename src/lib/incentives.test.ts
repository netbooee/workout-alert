import { describe, expect, it } from 'vitest';

import { incentiveGoalText, progressFraction, timeLeft } from './incentives';

describe('incentiveGoalText', () => {
  it('matches the server wording', () => {
    expect(incentiveGoalText({ goal_kind: 'workout_days', goal_target: 3, activity_type: null, weeks: 1 })).toBe(
      'Hit 3 workout days this week',
    );
    expect(incentiveGoalText({ goal_kind: 'workout_days', goal_target: 1, activity_type: null, weeks: 1 })).toBe(
      'Hit 1 workout day this week',
    );
    expect(incentiveGoalText({ goal_kind: 'active_minutes', goal_target: 300, activity_type: null, weeks: 2 })).toBe(
      'Hit 300 active minutes in 2 weeks',
    );
    expect(incentiveGoalText({ goal_kind: 'workouts', goal_target: 3, activity_type: 'running', weeks: 1 })).toBe(
      'Hit 3 runs this week',
    );
    expect(incentiveGoalText({ goal_kind: 'workouts', goal_target: 2, activity_type: 'yoga', weeks: 1 })).toBe(
      'Hit 2 yoga sessions this week',
    );
    expect(incentiveGoalText({ goal_kind: 'streak_weeks', goal_target: 6, activity_type: null, weeks: 4 })).toBe(
      'Reach a 6-week streak in 4 weeks',
    );
  });
});

describe('timeLeft', () => {
  const now = new Date(2026, 9, 15, 12, 0);
  it('counts whole days left', () => {
    expect(timeLeft(new Date(2026, 9, 18, 23, 59).toISOString(), now)).toBe('3 days left');
    expect(timeLeft(new Date(2026, 9, 16, 13, 0).toISOString(), now)).toBe('1 day left');
    expect(timeLeft(new Date(2026, 9, 15, 23, 0).toISOString(), now)).toBe('Ends today');
    expect(timeLeft(new Date(2026, 9, 15, 11, 0).toISOString(), now)).toBe('Ended');
  });
});

describe('progressFraction', () => {
  it('is clamped to 0–1', () => {
    expect(progressFraction({ progress: 2, goal_target: 4 })).toBe(0.5);
    expect(progressFraction({ progress: 6, goal_target: 4 })).toBe(1);
  });
});
