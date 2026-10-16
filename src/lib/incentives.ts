// Incentive goals, wording, and deadlines. No native imports, so it stays
// unit-testable. Goal wording mirrors public.incentive_goal_text() in
// supabase/migrations/20261003000000_incentives.sql.

import type { Incentive, IncentiveGoalKind } from '@/lib/database.types';

export interface GoalOption {
  kind: IncentiveGoalKind;
  label: string;
  /** What the stepper counts, e.g. "days". */
  unit: string;
  defaultTarget: number;
  step: number;
  /** Largest target for a window of `weeks` (matches offer_incentive). */
  max: (weeks: number) => number;
}

export const GOAL_OPTIONS: GoalOption[] = [
  { kind: 'workout_days', label: 'Workout days', unit: 'days', defaultTarget: 4, step: 1, max: (w) => 7 * w },
  { kind: 'active_minutes', label: 'Active minutes', unit: 'min', defaultTarget: 150, step: 15, max: (w) => 1500 * w },
  { kind: 'workouts', label: 'Workouts', unit: 'workouts', defaultTarget: 3, step: 1, max: (w) => 14 * w },
  { kind: 'streak_weeks', label: 'Streak', unit: 'weeks', defaultTarget: 4, step: 1, max: () => 104 },
];

export function goalOption(kind: IncentiveGoalKind): GoalOption {
  return GOAL_OPTIONS.find((g) => g.kind === kind)!;
}

/** Activity types a "workouts" goal can be limited to, with the server's singular labels. */
export const GOAL_ACTIVITIES: { type: string | null; label: string; noun: string }[] = [
  { type: null, label: 'Any', noun: 'workout' },
  { type: 'running', label: 'Run', noun: 'run' },
  { type: 'walking', label: 'Walk', noun: 'walk' },
  { type: 'cycling', label: 'Ride', noun: 'ride' },
  { type: 'traditionalStrengthTraining', label: 'Strength', noun: 'strength workout' },
  { type: 'highIntensityIntervalTraining', label: 'HIIT', noun: 'HIIT workout' },
  { type: 'yoga', label: 'Yoga', noun: 'yoga session' },
  { type: 'swimming', label: 'Swim', noun: 'swim' },
  { type: 'hiking', label: 'Hike', noun: 'hike' },
];

export const WINDOW_OPTIONS = [
  { weeks: 1, label: 'This week' },
  { weeks: 2, label: '2 weeks' },
  { weeks: 4, label: '4 weeks' },
] as const;

// `edit` tiles jump into the reward text so it can be changed right away.
export const REWARD_PRESETS: readonly { emoji: string; label: string; reward: string; edit?: boolean }[] = [
  // Also the "custom" tile: keep it a surprise or type your own reward over it.
  { emoji: '🎁', label: 'Surprise or custom', reward: 'A surprise', edit: true },
  { emoji: '🤳', label: 'Selfie', reward: 'A selfie' },
  { emoji: '☕', label: 'Coffee', reward: 'Coffee on me' },
  { emoji: '🍷', label: 'Date night', reward: 'Date night, my treat' },
  { emoji: '🍝', label: 'Cook for you', reward: 'I’ll cook your favorite meal' },
  { emoji: '💆', label: 'Massage', reward: 'A massage on me' },
  // Paid in person: no money moves through Sigamos.
  { emoji: '💵', label: 'Cash prize', reward: '$20 cash prize', edit: true },
  { emoji: '👑', label: 'Your call', reward: 'You call the shots tonight' },
  { emoji: '🍽️', label: 'Dinner', reward: 'Dinner on me' },
];

/** Longest "rules and notes" a partner can add to an offer (matches the database). */
export const NOTES_MAX = 500;

const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

type GoalFields = Pick<Incentive, 'goal_kind' | 'goal_target' | 'activity_type' | 'weeks'>;

/** "Hit 5 workout days this week", "Reach a 6-week streak in 4 weeks". */
export function incentiveGoalText(i: GoalFields): string {
  const n = i.goal_target;
  let goal: string;
  switch (i.goal_kind) {
    case 'workout_days':
      goal = `Hit ${n} ${plural(n, 'workout day')}`;
      break;
    case 'active_minutes':
      goal = `Hit ${n} active minutes`;
      break;
    case 'workouts': {
      const noun = GOAL_ACTIVITIES.find((a) => a.type === (i.activity_type ?? null))?.noun ?? 'workout';
      goal = `Hit ${n} ${plural(n, noun)}`;
      break;
    }
    case 'streak_weeks':
      goal = `Reach a ${n}-week streak`;
  }
  return `${goal} ${i.weeks === 1 ? 'this week' : `in ${i.weeks} weeks`}`;
}

/** "3 days left", "Ends today", "Ended". */
export function timeLeft(endsAt: string, now: Date = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days === 0) return 'Ends today';
  return `${days} ${plural(days, 'day')} left`;
}

/** Progress toward the goal, 0–1. */
export function progressFraction(i: Pick<Incentive, 'progress' | 'goal_target'>): number {
  return Math.max(0, Math.min(1, i.progress / i.goal_target));
}

export const isOpen = (i: Pick<Incentive, 'status'>) => i.status === 'offered' || i.status === 'active';
