// Cheer and Verify buttons on "just worked out" pushes. The server sends those
// pushes with this category (see the partner_workout_actions migration). No
// native imports, so it stays unit-testable.

import type { ReactionKind } from '@/lib/database.types';

export const PARTNER_WORKOUT_CATEGORY = 'partner_workout';

export const PARTNER_WORKOUT_ACTIONS = [
  // Opening the app is the reliable way on iOS to run our code for an action;
  // the reaction is saved right away and the workout opens showing it.
  { identifier: 'cheer', buttonTitle: '👏 Cheer', options: { opensAppToForeground: true } },
  { identifier: 'verify', buttonTitle: '✅ Verify', options: { opensAppToForeground: true } },
] as const;

/** The reaction a notification button adds, or null for a plain tap. */
export function reactionForAction(actionIdentifier: string): ReactionKind | null {
  if (actionIdentifier === 'cheer') return 'clap';
  if (actionIdentifier === 'verify') return 'verified';
  return null;
}

/** "/workout/<id>" → "<id>". */
export function workoutIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/workout\/([0-9a-f-]{36})$/i.exec(url);
  return match ? match[1]! : null;
}
