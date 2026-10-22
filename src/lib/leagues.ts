// Public league tiers and zones, mirroring
// supabase/migrations/20261028000000_public_leagues.sql. No native imports.

export const TIERS = [
  { tier: 1, name: 'Spark', emoji: '✨' },
  { tier: 2, name: 'Ember', emoji: '🔸' },
  { tier: 3, name: 'Flame', emoji: '🔥' },
  { tier: 4, name: 'Blaze', emoji: '☄️' },
  { tier: 5, name: 'Inferno', emoji: '🌋' },
] as const;

export const TOP_TIER = TIERS.length;

export function tierInfo(tier: number) {
  return TIERS[Math.min(Math.max(tier, 1), TOP_TIER) - 1]!;
}

/** How many move up at the end of the week in a group of n (public.league_promote_count). */
export function promoteCount(n: number): number {
  return Math.min(5, Math.ceil(n * 0.25));
}

/** How many move down (public.league_demote_count). Nobody drops out of the first tier. */
export function demoteCount(n: number): number {
  return Math.min(3, Math.floor(n * 0.15));
}

export type Zone = 'up' | 'stay' | 'down';

/** Where a place in the table would land if the week ended now. */
export function zoneFor(rank: number, n: number, tier: number, xp: number): Zone {
  if (xp > 0 && rank <= promoteCount(n) && tier < TOP_TIER) return 'up';
  if (tier > 1 && (xp === 0 || rank > n - demoteCount(n))) return 'down';
  return 'stay';
}

/** What the end-of-week card says. */
export function resultLine(result: Zone, tier: number): string {
  const t = tierInfo(tier);
  if (result === 'up') return `You moved up to ${t.name} ${t.emoji}`;
  if (result === 'down') return `You dropped to ${t.name}. Back up next week 💪`;
  return tier === TOP_TIER ? `You held on in ${t.name} ${t.emoji}` : `You stayed in ${t.name} ${t.emoji}`;
}

export const NICKNAME_MAX = 20;

/** null when fine, otherwise what's wrong (matches the database check). */
export function nicknameProblem(nickname: string): string | null {
  const n = nickname.trim();
  if (!n) return null;
  if (n.length < 2) return 'Use at least 2 characters';
  if (n.length > NICKNAME_MAX) return `Keep it to ${NICKNAME_MAX} characters`;
  return null;
}
