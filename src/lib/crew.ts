// Your partners at a glance on Home: one status each, and who to show first.
// No native imports.

import { weekState, type WeekDay } from './week';

export type CrewStatus = 'resting' | 'done' | 'today' | 'behind' | 'on-track';

export interface CrewMember {
  resting: boolean;
  this_week_days: number;
  this_week_goal: number;
  friend_streak: number;
}

export function crewStatus(p: CrewMember, days: readonly WeekDay[], now: Date = new Date()): CrewStatus {
  if (p.resting) return 'resting';
  if (p.this_week_days >= p.this_week_goal) return 'done';
  if (days.some((d) => d.isToday && d.active)) return 'today';
  const state = weekState(p.this_week_days, p.this_week_goal, now).kind;
  return state === 'at-risk' || state === 'out-of-reach' ? 'behind' : 'on-track';
}

/** The badge on a partner's buddy; on track needs none. */
export const CREW_BADGE: Record<CrewStatus, string | null> = {
  resting: '😴',
  done: '✅',
  today: '🔥',
  behind: '👋',
  'on-track': null,
};

/** One line about the partner you've picked. */
export function crewLine(status: CrewStatus, firstName: string, p: CrewMember): string {
  const left = Math.max(p.this_week_goal - p.this_week_days, 0);
  const days = `${left} more day${left === 1 ? '' : 's'}`;
  switch (status) {
    case 'resting':
      return `${firstName} is resting this week 😴`;
    case 'done':
      return `${firstName} hit their goal this week ✅`;
    case 'today':
      return `${firstName} worked out today · ${days} to go`;
    case 'behind':
      return `${firstName} needs ${days}. A nudge could help 👋`;
    case 'on-track':
      return `${firstName} needs ${days} this week`;
  }
}

const ORDER: Record<CrewStatus, number> = { behind: 0, today: 1, 'on-track': 2, done: 3, resting: 4 };

/** Who needs you most comes first; ties go to your longest friend streak. */
export function crewOrder<E extends { member: CrewMember; status: CrewStatus }>(members: readonly E[]): E[] {
  return [...members].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || b.member.friend_streak - a.member.friend_streak,
  );
}

/** Workouts that count this week across you and your partners, for "Together this week". */
export function crewTotals(workouts: readonly { duration_s: number; counted?: boolean }[]): {
  workouts: number;
  minutes: number;
} {
  const counted = workouts.filter((w) => w.counted !== false);
  return {
    workouts: counted.length,
    minutes: Math.round(counted.reduce((sum, w) => sum + w.duration_s, 0) / 60),
  };
}

/** "9 workouts · 4 h 20 min", or a nudge to be first. */
export function crewTotalsLine({ workouts, minutes }: { workouts: number; minutes: number }): string {
  if (!workouts) return 'Together this week: no workouts yet. Be the first!';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  return `Together this week: ${workouts} workout${workouts === 1 ? '' : 's'} · ${time}`;
}

export interface RecentWorkout {
  id: string;
  user_id: string;
  activity_type: string;
  started_at: string;
}

/** How far back holding a buddy looks for a workout to cheer. */
export const CHEER_LOOKBACK_DAYS = 14;

/**
 * What holding a buddy does: cheer their latest workout (saying when, if it
 * wasn't this week), or offer a nudge when there's nothing recent.
 */
export function holdTarget(
  partnerId: string,
  recent: readonly RecentWorkout[],
  weekStart: Date,
  now: Date = new Date(),
): { kind: 'cheer'; workout: RecentWorkout; when: string | null } | { kind: 'nudge' } {
  const since = now.getTime() - CHEER_LOOKBACK_DAYS * 86_400_000;
  const latest = recent
    .filter((w) => w.user_id === partnerId && new Date(w.started_at).getTime() >= since)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!latest) return { kind: 'nudge' };

  const started = new Date(latest.started_at);
  if (started >= weekStart) return { kind: 'cheer', workout: latest, when: null };
  const daysAgo = (now.getTime() - started.getTime()) / 86_400_000;
  const when =
    daysAgo < 7
      ? started.toLocaleDateString('en-US', { weekday: 'long' })
      : started.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { kind: 'cheer', workout: latest, when };
}
