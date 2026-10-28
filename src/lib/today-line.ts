// The one sentence on the Home streak card that says what to do today.
// No native imports, so it stays unit-testable.

import type { WeekState } from './week';

export interface TodayFacts {
  state: WeekState;
  /** Your current streak, in weeks. */
  weeks: number;
  freezes: number;
  /** A workout that counts already happened today. */
  workedOutToday: boolean;
  resting: boolean;
}

export type TodayTone = 'done' | 'urgent' | 'calm' | 'rest';

const workouts = (n: number) => (n === 1 ? '1 more workout' : `${n} more workouts`);

/** Looks forward: what the next workout does for you, in plain words. */
export function todayLine({ state, weeks, freezes, workedOutToday, resting }: TodayFacts): string {
  if (resting) return 'Rest mode is on. Your streak is safe 😴';
  switch (state.kind) {
    case 'done':
      return workedOutToday
        ? 'Goal hit! Anything extra is bonus XP ⚡'
        : 'Goal hit this week. Your streak is safe 🔥';
    case 'on-track':
    case 'at-risk': {
      const goal = weeks > 0 ? 'keeps your streak alive' : 'starts your streak';
      if (workedOutToday) return `Today counts! ${workouts(state.needed)} this week ${goal}.`;
      if (state.kind === 'at-risk' && state.daysLeft === state.needed) {
        return `${workouts(state.needed)} ${goal}, and every day left counts. Today’s the day 💪`;
      }
      return `${workouts(state.needed)} this week ${goal} 🔥`;
    }
    case 'out-of-reach':
      if (weeks === 0) return 'A fresh week starts Sunday. Workouts today still earn XP.';
      return freezes > 0
        ? 'This week is out of reach, but a freeze will cover it ❄️'
        : 'This week is out of reach. Hit next week’s goal to start a new streak.';
  }
}

export function todayTone({ state, workedOutToday, resting }: TodayFacts): TodayTone {
  if (resting) return 'rest';
  if (state.kind === 'done') return 'done';
  if (state.kind === 'at-risk' && !workedOutToday) return 'urgent';
  return 'calm';
}

/** Show a Log button under the sentence only when a workout today would help. */
export function shouldOfferLog({ state, workedOutToday, resting }: TodayFacts): boolean {
  return !resting && !workedOutToday && (state.kind === 'on-track' || state.kind === 'at-risk');
}
