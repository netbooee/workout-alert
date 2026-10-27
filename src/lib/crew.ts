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
