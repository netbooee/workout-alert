// What the celebrate screen says, and how the buddy looks saying it.
// No native imports, so it stays unit-testable.

import type { LotlMood } from './lotl';

export interface CelebrationFacts {
  workouts: number;
  weekGoal: boolean;
  evidence: boolean;
  incentive: boolean;
  /** The highest step tier just reached (e.g. 8000), or 0. */
  steps: number;
  /** The new level, when this XP crossed into one. */
  newLevel: number | null;
}

const thousands = (n: number) => n.toLocaleString('en-US');

export function celebrationTitle(c: CelebrationFacts): string {
  if (c.newLevel) return `Level ${c.newLevel}!`;
  if (c.incentive) return 'Challenge complete! 🎯';
  if (c.weekGoal) return 'Week goal hit!';
  if (c.workouts > 1) return `${c.workouts} workouts logged!`;
  if (c.workouts === 1) return 'Workout logged!';
  if (c.evidence) return 'Check-in added!';
  if (c.steps) return `${thousands(c.steps)} steps!`;
  return 'Nice work!';
}

/** The buddy's speech bubble: the biggest thing that just happened. */
export function buddyLine(c: CelebrationFacts): string {
  if (c.incentive) return 'You finished the challenge! Go claim that reward 🎁';
  if (c.weekGoal) return 'Week goal smashed! Your streak is safe 🔥';
  if (c.newLevel) return `Level ${c.newLevel}! Look at you go ⭐`;
  if (c.workouts > 1) return `${c.workouts} workouts! You’ve been busy 💪`;
  if (c.workouts === 1) return 'Another one in the books 💪';
  if (c.evidence) return 'Love the photo! Your partners will too 📸';
  if (c.steps >= 12000) return `${thousands(c.steps)} steps! That’s every step bonus today 👟`;
  if (c.steps) return `${thousands(c.steps)} steps today! Keep moving 👟`;
  return 'Every bit counts!';
}

export function celebrationMood(c: CelebrationFacts): LotlMood {
  return c.incentive || c.weekGoal || c.newLevel || c.steps >= 12000 ? 'blazing' : 'happy';
}
