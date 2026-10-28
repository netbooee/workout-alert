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

/** Your place as of your first look at the league each day, kept on the phone. */
export interface RankMemo {
  week: string;
  day: string;
  /** Your place when the day started (your last place seen before today). */
  startRank: number;
  lastRank: number;
}

/**
 * Updates the memo for a new look at the table and says how many places you've
 * moved today (positive is up), or null the first time you look this week.
 */
export function trackRank(
  memo: RankMemo | null,
  week: string,
  day: string,
  rank: number,
): { memo: RankMemo; moved: number | null } {
  if (!memo || memo.week !== week) {
    return { memo: { week, day, startRank: rank, lastRank: rank }, moved: null };
  }
  const startRank = memo.day === day ? memo.startRank : memo.lastRank;
  return { memo: { week, day, startRank, lastRank: rank }, moved: startRank - rank };
}

export const MEDALS = ['🥇', '🥈', '🥉'] as const;

/** Made-up end-of-week results, for previewing the result screen during development. */
export function sampleLeagueResult(outcome: Zone, tier: number, myName: string, myMascot: string) {
  const names = ['Alex', 'Sam', myName, 'Jordan', 'Riley', 'Casey', 'Morgan', 'Jamie'];
  const mascots = ['capybara', 'sloth', myMascot, 'red_panda', 'lotl', 'capybara', 'sloth', 'red_panda'];
  const myRank = outcome === 'up' ? 3 : outcome === 'down' ? 8 : 5;
  const order = names.map((name, i) => ({ name, mascot: mascots[i]!, me: i === 2 }));
  // Put "you" at the rank the outcome needs.
  const me = order.splice(2, 1)[0]!;
  order.splice(myRank - 1, 0, me);
  const table = order.map((p, i) => ({
    member_key: `sample-${i}`,
    name: p.name,
    mascot: p.mascot as 'lotl' | 'capybara' | 'sloth' | 'red_panda',
    xp: 620 - i * 70,
    rank: i + 1,
    is_me: p.me,
    result: (i < 2 ? 'up' : i >= 7 ? 'down' : 'stay') as Zone,
  }));
  const mine = table[myRank - 1]!;
  mine.result = outcome;
  return {
    result: {
      week_start: '2026-10-25',
      final_rank: myRank,
      final_xp: mine.xp,
      result: outcome,
      tier: Math.min(Math.max(tier + (outcome === 'up' ? 1 : outcome === 'down' ? -1 : 0), 1), TOP_TIER),
      group_size: table.length,
    },
    table,
  };
}
