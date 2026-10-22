// Which partner workouts are still waiting for your cheer. No native imports,
// so it stays unit-testable.

import type { ReactionKind } from '@/lib/database.types';
import { addDays, dayKey, startOfDay } from '@/lib/week';

/** Partner workouts older than this drop out of the "cheer on" list. */
export const CHEER_WINDOW_DAYS = 3;

/** The reactions that count as a cheer (Verify is separate). */
export const CHEER_KINDS: ReactionKind[] = ['clap', 'fire', 'strong'];

interface CheerCandidate {
  workout: { user_id: string; started_at: string };
  reactions: { kind: ReactionKind; user_id: string }[];
}

/**
 * Partners' workouts from the last few days that you haven't reacted to yet,
 * newest first. Any reaction from you (a cheer or a verify) counts as seen.
 */
export function needsCheer<T extends CheerCandidate>(items: readonly T[], me: string, now: Date = new Date()): T[] {
  const since = addDays(startOfDay(now), -(CHEER_WINDOW_DAYS - 1));
  return items
    .filter(
      (i) =>
        i.workout.user_id !== me &&
        new Date(i.workout.started_at) >= since &&
        !i.reactions.some((r) => r.user_id === me),
    )
    .sort((a, b) => b.workout.started_at.localeCompare(a.workout.started_at));
}

/** "Today 7:10 PM", "Yesterday 6:05 AM", "Mon 8:30 AM". */
export function whenLabel(startedAt: string, now: Date = new Date()): string {
  const date = new Date(startedAt);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day = dayKey(date);
  if (day === dayKey(now)) return `Today ${time}`;
  if (day === dayKey(addDays(now, -1))) return `Yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}
