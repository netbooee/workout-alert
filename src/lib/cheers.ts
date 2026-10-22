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

export interface CheerListState {
  /** Workouts you dismissed with ✕. */
  dismissed?: ReadonlySet<string>;
  /** Rows already on screen this visit: they stay after a cheer so you can still verify. */
  keep?: ReadonlySet<string>;
}

/**
 * Partners' workouts from the last few days still waiting on you, newest first.
 * A row is done once you verify it or dismiss it. A cheer alone also counts as
 * done, except for rows already on screen this visit, which stay so Verify is
 * still in reach.
 */
export function needsCheer<T extends CheerCandidate & { workout: { id: string } }>(
  items: readonly T[],
  me: string,
  now: Date = new Date(),
  { dismissed, keep }: CheerListState = {},
): T[] {
  const since = addDays(startOfDay(now), -(CHEER_WINDOW_DAYS - 1));
  return items
    .filter((i) => {
      if (i.workout.user_id === me || new Date(i.workout.started_at) < since) return false;
      if (dismissed?.has(i.workout.id)) return false;
      const mine = i.reactions.filter((r) => r.user_id === me);
      if (mine.some((r) => r.kind === 'verified')) return false;
      return mine.length === 0 || !!keep?.has(i.workout.id);
    })
    .sort((a, b) => b.workout.started_at.localeCompare(a.workout.started_at));
}

/** Rows you haven't touched at all (for the tab badge). */
export function untouched<T extends CheerCandidate>(items: readonly T[], me: string): T[] {
  return items.filter((i) => !i.reactions.some((r) => r.user_id === me));
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
