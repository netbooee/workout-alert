// Private groups: limits, the squad rule, invite links and the lines shown on
// group cards. Mirrors supabase/migrations/20261102000000_groups.sql. No
// native imports, so it stays unit-testable.

import type { GroupMemberRow, MyGroup } from './database.types';
import { addDays, dayKey, startOfWeek } from './week';

export const MAX_GROUPS = 3;
export const MAX_GROUP_SIZE = 20;
export const GROUP_NAME_MAX = 30;
export const GROUP_EMOJI = ['🔥', '💪', '🏋️', '🏃', '🚴', '🧘', '⚡', '🏆', '🌮', '🐐', '🦄', '🎉'] as const;

const WEB_GROUP_BASE = 'https://sigamos.cloud/group/';

/** Members needed for a squad week: 80%, rounded up (everyone in groups of 4 or fewer). */
export function squadNeed(members: number): number {
  return Math.max(1, Math.ceil(members * 0.8));
}

/** The code in sigamos://group/join/CODE or https://sigamos.cloud/group/CODE, or null. */
export function groupCodeFromUrl(url: string): string | null {
  const match = /^(?:sigamos:\/\/group\/join\/|https:\/\/(?:www\.)?sigamos\.cloud\/group\/)([^/?#]+)/i.exec(url);
  if (!match) return null;
  const code = match[1]!.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 6 ? code : null;
}

export function groupInviteUrl(code: string): string {
  return WEB_GROUP_BASE + code;
}

export function groupInviteMessage(group: { name: string; emoji: string; invite_code: string }): string {
  return (
    `Join ${group.emoji} ${group.name} on Sigamos! We keep a squad streak going together and race for the top spot each week 🔥\n\n` +
    `${groupInviteUrl(group.invite_code)}\n` +
    `or enter the code in the app: ${group.invite_code}`
  );
}

/** Last week's winner, for the 👑: the most XP, if anyone earned any. Ties go to nobody. */
export function crownHolder(rows: readonly Pick<GroupMemberRow, 'user_id' | 'last_week_xp'>[]): string | null {
  const best = Math.max(0, ...rows.map((r) => r.last_week_xp));
  if (best === 0) return null;
  const top = rows.filter((r) => r.last_week_xp === best);
  return top.length === 1 ? top[0]!.user_id : null;
}

/** Whether someone has made this week for the squad. */
export function madeIt(row: Pick<GroupMemberRow, 'week_status' | 'this_week_days' | 'this_week_goal'>): boolean {
  return row.week_status === 'hit' || row.this_week_days >= row.this_week_goal;
}

/** The squad line on group cards: where this week stands. */
export function squadLine(g: Pick<MyGroup, 'made' | 'need' | 'member_count'>): string {
  if (g.member_count < 2) return 'Invite people to start a squad streak';
  if (g.made >= g.need) return 'Squad week made! 🔥';
  const left = g.need - g.made;
  return left === 1 ? 'One more goal keeps the squad streak alive' : `${left} more goals keep the squad streak alive`;
}

export interface PodiumPlace {
  user_id: string;
  name: string;
  xp: number;
  /** 0 = 🥇, 1 = 🥈, 2 = 🥉 (an index into MEDALS). */
  medal: number;
  is_me: boolean;
}

/**
 * Last week's medalists, as in the Sunday podium push (send_group_podiums):
 * only people who earned XP place, ties share a medal, and the next amount
 * down takes the next medal (300, 300, 200 → 🥇🥇🥈). You come first in a tie.
 */
export function podium(
  rows: readonly Pick<GroupMemberRow, 'user_id' | 'name' | 'last_week_xp' | 'is_me'>[],
): PodiumPlace[] {
  const amounts = [...new Set(rows.map((r) => r.last_week_xp).filter((xp) => xp > 0))].sort((a, b) => b - a);
  return rows
    .filter((r) => r.last_week_xp > 0 && amounts.indexOf(r.last_week_xp) < 3)
    .map((r) => ({
      user_id: r.user_id,
      name: r.name,
      xp: r.last_week_xp,
      medal: amounts.indexOf(r.last_week_xp),
      is_me: r.is_me,
    }))
    .sort((a, b) => a.medal - b.medal || Number(b.is_me) - Number(a.is_me) || a.name.localeCompare(b.name));
}

/** The podium card shows on Sunday and Monday, while last week is still news. */
export function showPodium(now: Date): boolean {
  return now.getDay() <= 1;
}

const MEDAL_NAMES = ['gold', 'silver', 'bronze'] as const;

/** The three podium steps (🥇, 🥈, 🥉), each with whoever shares it. A step can be empty. */
export function podiumSteps<T extends Pick<PodiumPlace, 'medal'>>(places: readonly T[]): T[][] {
  return [0, 1, 2].map((m) => places.filter((p) => p.medal === m));
}

/** Your line at the end of the medal ceremony, in the same words as the Sunday push. */
export function myPodiumLine(rows: readonly Pick<GroupMemberRow, 'last_week_xp' | 'is_me'>[]): string {
  const me = rows.find((r) => r.is_me);
  if (!me || me.last_week_xp <= 0) return 'Fresh week, fresh start. Let’s go 💪';
  const amounts = [...new Set(rows.map((r) => r.last_week_xp).filter((xp) => xp > 0))].sort((a, b) => b - a);
  const place = amounts.indexOf(me.last_week_xp);
  if (place === 0) return 'You won gold! 🥇';
  if (place < 3) return `You took ${MEDAL_NAMES[place]}! ${place === 1 ? '🥈' : '🥉'}`;
  return `You were ${ordinal(place + 1)} with ${me.last_week_xp} XP. Fresh week, let’s go 💪`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Which finished week the ceremony is for: the Sunday it started, e.g. "2026-11-01". */
export function podiumWeek(now: Date): string {
  return dayKey(addDays(startOfWeek(now), -7));
}

/** "Nov 1 – 7" for the ceremony's subtitle. */
export function podiumWeekLabel(now: Date): string {
  const start = addDays(startOfWeek(now), -7);
  const end = addDays(start, 6);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

/** Where you stand on this week's board, as a nudge: the lead, a tie, or the gap to the next person up. */
export function climbLine(rows: readonly Pick<GroupMemberRow, 'name' | 'xp' | 'is_me'>[]): string | null {
  const me = rows.find((r) => r.is_me);
  if (!me || rows.length < 2) return null;
  const others = rows.filter((r) => !r.is_me);
  const best = Math.max(...others.map((r) => r.xp));
  if (me.xp === 0 && best === 0) return 'Nobody’s on the board yet. Your first workout takes the lead.';
  if (me.xp > best) return `You’re in the lead by ${me.xp - best} XP 🥇`;
  if (me.xp === best) return 'You’re tied for first. One more workout breaks it.';
  // The closest person ahead of you.
  const ahead = others.filter((r) => r.xp > me.xp).sort((a, b) => a.xp - b.xp || a.name.localeCompare(b.name))[0]!;
  return `${ahead.xp - me.xp} XP to pass ${ahead.name}`;
}
