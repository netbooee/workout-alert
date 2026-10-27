// What the "Tony cheered your workout" banner on Home says. No native imports.

import type { ReactionKind } from './database.types';

export interface IncomingCheer {
  user_id: string;
  kind: ReactionKind;
  workout_id: string;
  /** The workout's name, like "Strength". */
  workout: string;
  created_at: string;
}

const EMOJI: Record<ReactionKind, string> = { clap: '👏', fire: '🔥', strong: '💪', verified: '✅' };

const people = (names: string[]) =>
  names.length === 1 ? names[0]! : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;

/**
 * One line for everything new: a verification beats a cheer, one workout is
 * named, several are counted. `who` is the first person to show a face for.
 */
export function cheerBanner(
  items: readonly IncomingCheer[],
  firstName: (userId: string) => string,
): { text: string; who: string; workoutId: string | null } | null {
  if (!items.length) return null;
  const newest = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const names = [...new Set(newest.map((c) => c.user_id))].map(firstName);
  const workouts = new Set(newest.map((c) => c.workout_id));
  const top = newest.find((c) => c.kind === 'verified') ?? newest[0]!;

  if (workouts.size > 1) {
    return {
      text: `${people(names)} cheered ${workouts.size} of your workouts 🎉`,
      who: top.user_id,
      workoutId: null,
    };
  }
  const verb = top.kind === 'verified' ? 'verified' : 'cheered';
  const emoji = names.length === 1 ? ` ${EMOJI[top.kind]}` : '';
  return {
    text: `${people(names)}${emoji} ${verb} your ${top.workout.toLowerCase()}`,
    who: top.user_id,
    workoutId: top.workout_id,
  };
}
