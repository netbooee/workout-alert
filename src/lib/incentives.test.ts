import { describe, expect, it } from 'vitest';

import {
  ALL_REWARDS,
  incentiveGoalText,
  progressFraction,
  REWARD_PRESETS,
  searchRewards,
  timeLeft,
} from './incentives';

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

describe('reward library', () => {
  it('gives every reward its own id, short enough labels, and no drinks', () => {
    const ids = ALL_REWARDS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ALL_REWARDS.length).toBe(49);
    expect(ALL_REWARDS.every((p) => p.label.length <= 16 && p.reward.length <= 80)).toBe(true);
    expect(ALL_REWARDS.some((p) => /drink|cocktail|bubbly|beer|wine/i.test(p.label + p.reward))).toBe(false);
  });

  it('leaves room for "More…" after the favorites, starting with Custom', () => {
    expect(REWARD_PRESETS).toHaveLength(8);
    expect(REWARD_PRESETS[0]).toMatchObject({ id: 'custom', edit: true });
  });

  it('searches labels and reward text, keeping only groups with matches', () => {
    expect(searchRewards('walk').flatMap((c) => c.rewards.map((p) => p.id))).toEqual(['sunset-walk', 'dog-walk']);
    expect(searchRewards('PIZZA')).toEqual([{ title: 'Food and treats', rewards: [expect.objectContaining({ id: 'pizza' })] }]);
    expect(searchRewards('zzz')).toEqual([]);
    expect(searchRewards('  ')).toHaveLength(8);
  });
});
