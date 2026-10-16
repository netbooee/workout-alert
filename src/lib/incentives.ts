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

export interface RewardPreset {
  id: string;
  emoji: string;
  label: string;
  reward: string;
  /** Jump into the reward text so it can be changed right away (amounts, custom). */
  edit?: boolean;
}

const r = (id: string, emoji: string, label: string, reward: string, edit?: boolean): RewardPreset => ({
  id,
  emoji,
  label,
  reward,
  ...(edit ? { edit } : {}),
});

/** Every suggested reward, grouped for the "More…" sheet. All are editable after picking. */
export const REWARD_LIBRARY: { title: string; rewards: RewardPreset[] }[] = [
  {
    title: 'Popular',
    rewards: [
      // Custom: starts as "A surprise"; keep it, or type your own reward over it.
      r('custom', '🎁', 'Custom', 'A surprise', true),
      r('selfie', '🤳', 'Selfie', 'A selfie'),
      r('coffee', '☕', 'Coffee', 'Coffee on me'),
      r('date-night', '🍷', 'Date night', 'Date night, my treat'),
      r('cook', '🍝', 'Cook for you', 'I’ll cook your favorite meal'),
      r('massage', '💆', 'Massage', 'A massage on me'),
      // Paid in person: no money moves through Sigamos.
      r('cash', '💵', 'Cash prize', '$20 cash prize', true),
      r('your-call', '👑', 'Your call', 'You call the shots tonight'),
      r('dinner', '🍽️', 'Dinner', 'Dinner on me'),
    ],
  },
  {
    title: 'Food and treats',
    rewards: [
      r('pizza', '🍕', 'Pizza', 'Pizza night on me'),
      r('ice-cream', '🍦', 'Ice cream', 'Ice cream on me'),
      r('smoothie', '🥤', 'Smoothie', 'Smoothie on me'),
      r('tacos', '🌮', 'Tacos', 'Taco night on me'),
      r('sushi', '🍣', 'Sushi', 'Sushi on me'),
      r('donuts', '🍩', 'Donuts', 'Donuts on me'),
      r('chocolate', '🍫', 'Chocolate', 'Your favorite chocolate'),
      r('brunch', '🥞', 'Brunch', 'Brunch on me'),
      r('burger', '🍔', 'Burger', 'Burgers on me'),
      r('bake', '🧁', 'Bake for you', 'I’ll bake you something'),
    ],
  },
  {
    title: 'Time together',
    rewards: [
      r('movie', '🎬', 'Movie', 'Movie night, my treat'),
      r('sunset-walk', '🌅', 'Sunset walk', 'A sunset walk together'),
      r('picnic', '🧺', 'Picnic', 'A picnic, I’ll pack it'),
      r('game-night', '🎲', 'Game night', 'Game night, you pick the game'),
      r('adventure', '🥾', 'Adventure', 'A hike or day trip together'),
      r('bowling', '🎳', 'Bowling', 'Bowling, my treat'),
      r('karaoke', '🎤', 'Karaoke', 'Karaoke night'),
      r('beach', '🏖️', 'Beach day', 'A beach day together'),
    ],
  },
  {
    title: 'Pampering and rest',
    rewards: [
      r('spa', '🛁', 'Spa night', 'A spa night at home'),
      r('foot-rub', '🦶', 'Foot rub', 'A foot rub, no time limit'),
      r('mani-pedi', '💅', 'Mani-pedi', 'Mani-pedi on me'),
      r('sleep-in', '🛌', 'Sleep in', 'I take the morning, you sleep in'),
      r('breakfast-in-bed', '🍳', 'Breakfast in bed', 'Breakfast in bed'),
    ],
  },
  {
    title: 'Chores and favors',
    rewards: [
      r('chore-pass', '🧺', 'Chore pass', 'I’ll do one of your chores'),
      r('dishes', '🍽️', 'Dishes', 'I’ll do the dishes for a week'),
      r('errands', '🚗', 'Errands', 'I’ll run your errands this weekend'),
      r('dog-walk', '🐕', 'Dog walk', 'I’ll walk the dog for a week'),
      r('clean-up', '🧹', 'Clean-up', 'I’ll clean up, you relax'),
    ],
  },
  {
    title: 'Sweet and personal',
    rewards: [
      r('note', '💌', 'Love note', 'A handwritten note'),
      r('playlist', '🎵', 'Playlist', 'A playlist I made for you'),
      r('flowers', '💐', 'Flowers', 'Flowers for you'),
      r('photo-shoot', '📸', 'Photo shoot', 'I’ll take your photos'),
    ],
  },
  {
    title: 'Fitness',
    rewards: [
      r('workout-buddy', '🏃', 'Workout buddy', 'I’ll join your next workout'),
      r('gear', '👟', 'New gear', 'New workout gear'),
      r('class', '🧘', 'Class pass', 'A fitness class on me'),
      r('earbuds', '🎧', 'Headphones', 'New earbuds'),
    ],
  },
  {
    title: 'Bigger stakes',
    rewards: [
      r('tickets', '🎟️', 'Tickets', 'Tickets to a show or game'),
      r('shopping', '🛍️', 'Shopping', 'A shopping trip on me'),
      r('gift-card', '💳', 'Gift card', 'A $25 gift card', true),
      r('trip', '✈️', 'Trip', 'A weekend getaway'),
    ],
  },
];

export const ALL_REWARDS: RewardPreset[] = REWARD_LIBRARY.flatMap((c) => c.rewards);

export const rewardById = (id: string): RewardPreset | undefined => ALL_REWARDS.find((p) => p.id === id);

/** The tiles on the offer screen; the last slot is "More…", which opens the whole library. */
export const REWARD_PRESETS: RewardPreset[] = [
  'custom',
  'selfie',
  'coffee',
  'date-night',
  'cook',
  'massage',
  'cash',
  'your-call',
].map((id) => rewardById(id)!);

/** The library filtered by a search ("pizza", "walk"), keeping only groups with matches. */
export function searchRewards(query: string): { title: string; rewards: RewardPreset[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return REWARD_LIBRARY;
  return REWARD_LIBRARY.map((c) => ({
    title: c.title,
    rewards: c.rewards.filter((p) => p.label.toLowerCase().includes(q) || p.reward.toLowerCase().includes(q)),
  })).filter((c) => c.rewards.length > 0);
}

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
